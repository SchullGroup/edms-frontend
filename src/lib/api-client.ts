import axios, { AxiosResponse, AxiosError } from 'axios';
import Cookies from 'js-cookie';
import { useUIStore } from '@/store/useUIStore';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

// ── Cross-tab refresh coordination ───────────────────────────────────────────
const LAST_REFRESH_TS_KEY = '__edms_last_refresh_ts';

function stampRefreshTime(): void {
  try {
    localStorage.setItem(LAST_REFRESH_TS_KEY, Date.now().toString());
  } catch {}
}

function anotherTabJustRefreshed(): boolean {
  try {
    const ts = Number(localStorage.getItem(LAST_REFRESH_TS_KEY) ?? 0);
    return Date.now() - ts < 4_000;
  } catch {
    return false;
  }
}

// ── Session epoch ──────────────────────────────────────────────────────────
// `_refreshPromise`/`isRefreshing`/`failedQueue` below are module-level state
// that outlives logout→login — `performLogout` navigates client-side, no page
// reload. Without this, a refresh request still in flight from a session that
// just logged out can resolve *after* a fresh login and get treated as a
// failure of the NEW session, signing the just-logged-in user back out. Every
// login/logout bumps `authEpoch`; a refresh captures the epoch it started
// under and, if that epoch has moved on by the time it resolves, its result
// is discarded — it's answering a question nobody's asking anymore.
let authEpoch = 0;

// ── Shared refresh singleton ──────────────────────────────────────────────────
let _refreshPromise: Promise<string> | null = null;
let isRefreshing = false;
let failedQueue: Array<{
  resolve: (value?: unknown) => void;
  reject: (reason?: any) => void;
}> = [];

const processQueue = (error: any, token: string | null = null) => {
  failedQueue.forEach((prom) => {
    if (error) {
      prom.reject(error);
    } else {
      prom.resolve(token);
    }
  });
  failedQueue = [];
};

/** Called on every logout and every successful login (see `auth.service.ts`)
 *  so a stale in-flight refresh from the session that just ended can't act on
 *  the one that's now current. */
export function invalidateInFlightAuth(): void {
  authEpoch++;
  _refreshPromise = null;
  if (isRefreshing) {
    isRefreshing = false;
    processQueue(new Error('Session changed'), null);
  }
}

export function refreshAccessToken(): Promise<string> {
  if (_refreshPromise) return _refreshPromise;

  const epochAtStart = authEpoch;
  _refreshPromise = axios
    .post<{ success: boolean; data?: { accessToken?: string } }>('/api/auth/refresh')
    .then(({ data }) => {
      const tokenData: any = data.data ?? data;
      const token = tokenData.accessToken;

      if (!token) throw new Error('No token in refresh response');

      // A logout or fresh login happened while this request was in flight —
      // applying its token now would silently overwrite whatever session is
      // actually current. Treat it the same as a failed refresh; the caller
      // (the response interceptor below) also checks the epoch before doing
      // anything session-affecting with the rejection.
      if (authEpoch !== epochAtStart) {
        throw new Error('Stale refresh — session changed while in flight');
      }

      Cookies.set('accessToken', token, {
        expires: 1,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'strict',
      });

      stampRefreshTime();
      return token;
    })
    .finally(() => {
      _refreshPromise = null;
    });

  return _refreshPromise;
}

export const apiClient = axios.create({
  baseURL: `${API_URL}/api/v1`,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Request Interceptor: Attach Token
apiClient.interceptors.request.use(
  (config) => {
    const token = Cookies.get('accessToken');
    if (token && config.headers) {
      config.headers['Authorization'] = `Bearer ${token}`;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  },
);

// Response Interceptor: Handle 401s and Token Refresh
apiClient.interceptors.response.use(
  (response: AxiosResponse) => {
    return response;
  },
  async (error: AxiosError<any>) => {
    const originalRequest = error.config as any;

    if (error.response?.status === 401 && !originalRequest._retry) {
      // Captured before joining/starting a refresh — if a login or logout
      // happens while this 401 is being handled, the eventual outcome no
      // longer says anything about whether the *current* session is valid.
      const epochAtEntry = authEpoch;
      if (isRefreshing) {
        return new Promise((resolve, reject) => {
          failedQueue.push({ resolve, reject });
        })
          .then((token) => {
            originalRequest.headers['Authorization'] = 'Bearer ' + token;
            return apiClient(originalRequest);
          })
          .catch((err) => {
            return Promise.reject(err);
          });
      }

      originalRequest._retry = true;
      isRefreshing = true;

      try {
        const newAccessToken = await refreshAccessToken();

        apiClient.defaults.headers.common['Authorization'] = 'Bearer ' + newAccessToken;
        originalRequest.headers['Authorization'] = 'Bearer ' + newAccessToken;

        processQueue(null, newAccessToken);
        return apiClient(originalRequest);
      } catch (refreshError: any) {
        processQueue(refreshError, null);

        // A login or logout happened while this refresh was in flight — its
        // outcome belongs to a session that's no longer current. Any followers
        // were already rejected synchronously by `invalidateInFlightAuth` when
        // the epoch moved on, so there's nothing left to do here but bail out
        // quietly; in particular, never fire `setSessionExpired` for the
        // session the user is *now* in over a request that predates it.
        if (authEpoch !== epochAtEntry) {
          return Promise.reject(refreshError);
        }

        const httpStatus = refreshError?.response?.status;
        const isAuthFailure =
          httpStatus === 401 ||
          httpStatus === 403 ||
          refreshError?.message === 'No token in refresh response';

        if (isAuthFailure) {
          if (anotherTabJustRefreshed()) {
            const freshToken = Cookies.get('accessToken');
            if (freshToken) {
              apiClient.defaults.headers.common['Authorization'] = 'Bearer ' + freshToken;
              originalRequest.headers['Authorization'] = 'Bearer ' + freshToken;
              return apiClient(originalRequest);
            }
          }

          // A live backend explicitly rejected the refresh — the session is
          // genuinely over, not just unreachable. Hand off to
          // `SessionExpiredModal` (mounted in AppShell) instead of silently
          // clearing the cookie and hard-redirecting: the user gets a clear
          // "sign in again" prompt rather than being bounced without
          // explanation mid-task. The modal owns the actual teardown
          // (`performLogout`) once they act on it or dismiss it.
          if (typeof window !== 'undefined') {
            useUIStore.getState().setSessionExpired(true);
          }
        }
        // Network error / timeout / 5xx reaching the refresh endpoint falls
        // through here without touching the session — that's the backend
        // being unreachable, not the user being logged out. The original
        // request's own caller (a React Query hook, typically) sees this
        // rejection and shows its normal error state; `ServiceUnavailableOverlay`
        // picks up the broader pattern if it keeps happening across queries.
        return Promise.reject(refreshError);
      } finally {
        // Only clear the flag if this cycle is still the current epoch's — a
        // stale (late-resolving) cycle's `finally` shouldn't stomp on a
        // legitimately in-progress refresh started under a newer epoch (that
        // one already set `isRefreshing = true` for itself, after
        // `invalidateInFlightAuth` reset it).
        if (authEpoch === epochAtEntry) {
          isRefreshing = false;
        }
      }
    }

    return Promise.reject(error);
  },
);
