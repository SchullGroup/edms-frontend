import axios from 'axios';
import { apiClient, invalidateInFlightAuth } from '@/lib/api-client';
import { AuthUser, ApiResponse, MfaChallenge } from '@/types/models';
import { useUIStore } from '@/store/useUIStore';
import Cookies from 'js-cookie';

export interface LoginResponseData {
  user: AuthUser;
  accessToken: string;
  // refreshToken is now stripped by the Next.js Proxy and stored securely in HttpOnly cookie
}

export interface RefreshResponseData {
  accessToken: string;
}

/** Stores the access token and clears state left over from any earlier session. */
function startSession(accessToken: string): void {
  // Set accessToken securely in js-cookie for API Client interception
  Cookies.set('accessToken', accessToken, {
    expires: 1,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
  });
  // A refresh still in flight from an ended session must not act on this one.
  invalidateInFlightAuth();

  // The proxy's redirect for a dead token isn't a logout, so `sessionExpired` can still be set.
  useUIStore.getState().setSessionExpired(false);
}

export const authService = {
  /** Either a session, or `MfaChallenge` when the account has two-step sign-in on. */
  login: async (credentials: any): Promise<LoginResponseData | MfaChallenge> => {
    // Call the local Next.js proxy route, which intercepts the refreshToken
    const response = await axios.post<ApiResponse<LoginResponseData | MfaChallenge>>(
      '/api/auth/login',
      credentials,
    );
    const data = response.data.data;
    if (response.data?.success !== false && 'accessToken' in data && data.accessToken) {
      startSession(data.accessToken);
    }
    return data;
  },

  /** Second sign-in step (via the BFF, which keeps the refresh cookie). Exactly one of code/recoveryCode. */
  verifyMfa: async (
    body: { mfaToken: string } & ({ code: string } | { recoveryCode: string }),
  ): Promise<LoginResponseData> => {
    const response = await axios.post<ApiResponse<LoginResponseData>>('/api/auth/mfa/verify', body);
    const data = response.data.data;
    if (response.data?.success !== false && data?.accessToken) startSession(data.accessToken);
    return data;
  },

  /** Starts enrolment; the secret is stored but not active until `enableMfa`. */
  setupMfa: async (): Promise<{ secret: string; otpauthUri: string }> => {
    const response = await apiClient.post<ApiResponse<{ secret: string; otpauthUri: string }>>(
      '/auth/mfa/setup',
    );
    return response.data.data;
  },

  /** Recovery codes come back once, here only. */
  enableMfa: async (code: string): Promise<{ recoveryCodes: string[] }> => {
    const response = await apiClient.post<ApiResponse<{ recoveryCodes: string[] }>>(
      '/auth/mfa/enable',
      { code },
    );
    return response.data.data;
  },

  /** `password` is required for accounts that have one; exactly one of code/recoveryCode. */
  disableMfa: async (
    body: { password?: string } & ({ code: string } | { recoveryCode: string }),
  ): Promise<void> => {
    await apiClient.post('/auth/mfa/disable', body);
  },

  /** Admin reset (`user:edit`) for someone who lost their device and recovery codes. */
  resetUserMfa: async (userId: string): Promise<void> => {
    await apiClient.delete(`/auth/mfa/users/${userId}`);
  },

  refresh: async (): Promise<RefreshResponseData> => {
    // The Next.js proxy extracts the refreshToken automatically from the HttpOnly cookie.
    const response = await axios.post<ApiResponse<RefreshResponseData>>('/api/auth/refresh');

    if (response.data?.success !== false && response.data?.data?.accessToken) {
      Cookies.set('accessToken', response.data.data.accessToken, {
        expires: 1,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'strict',
      });
    }

    return response.data.data;
  },

  // Note: The endpoints below are implemented in the Express backend, but are not formally
  // documented in the Swagger api-docs.json. We keep them available here for convenience.

  /**
   * Fire-and-forget. The local `accessToken` cookie is removed synchronously so
   * the caller can redirect immediately; the request to the BFF (which clears
   * the HttpOnly refresh cookie and asks the backend to revoke the refresh
   * token) runs in the background and its outcome is not awaited.
   */
  logout: (): void => {
    // Bump the auth epoch first — any refresh still in flight for this
    // (outgoing) session must not be allowed to act on whatever session comes
    // next, including a fresh login moments later. See `api-client.ts`.
    invalidateInFlightAuth();
    const token = Cookies.get('accessToken');
    Cookies.remove('accessToken');
    axios
      .post(
        '/api/auth/logout',
        {},
        token ? { headers: { Authorization: `Bearer ${token}` } } : undefined,
      )
      .catch(() => {
        /* best-effort — the session is already torn down client-side */
      });
  },

  me: async (): Promise<AuthUser> => {
    // This goes straight to the Express backend via apiClient (attaches Authorization header)
    const response = await apiClient.get<ApiResponse<AuthUser>>('/auth/me');
    return response.data.data;
  },

  // Neither of the two below touches a cookie, so — unlike login/refresh/logout —
  // there's no need to go via the Next proxy; they hit the Express backend directly.

  /** The backend should always resolve with 200 here regardless of whether the
   *  email is registered, so a caller can't enumerate accounts by trying emails. */
  forgotPassword: async (email: string): Promise<void> => {
    await apiClient.post('/auth/forgot-password', { email });
  },

  /** Consumes a one-time token from either an invitation or a password-reset
   *  email. Backend field is `password` (singular) — `confirmPassword` never
   *  goes over the wire; matching is a client-side-only check. */
  resetPassword: async (payload: { token: string; password: string }): Promise<void> => {
    await apiClient.post('/auth/reset-password', payload);
  },
};
