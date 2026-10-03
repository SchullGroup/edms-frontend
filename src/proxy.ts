import { NextRequest, NextResponse } from 'next/server';
import { authServer } from '@/apis/server/auth.server';
import { evaluateRouteAccess } from '@/lib/routeAccess';
import { normalizePermission } from '@/lib/permissions';
import type { AuthUser } from '@/types/models';

/**
 * Server-side route protection (DRIFT-02). `middleware.ts` was renamed to
 * `proxy.ts` in Next.js 16 (the `middleware` file convention is deprecated —
 * confirmed against `node_modules/next/dist/docs`, this project's own
 * AGENTS.md says to heed exactly this kind of notice); the export is now
 * named `proxy`, not `middleware`. Same behavior either name.
 *
 * The `AppShell` guard is client-side only and reads `currentUser` out of
 * `localStorage` — trivially forgeable, and was never anything but a UX
 * nicety. This is the real gate: it runs before any protected page is
 * served, and resolves roles/permissions from the live `GET /auth/me`
 * response every time, deliberately uncached — the whole reason `/auth/me`
 * returns `permissions` is so a grant toggled on or off for a user takes
 * effect on their very next navigation, not after some staleness window.
 * `evaluateRouteAccess` (`@/lib/routeAccess`) is the same rule-matching
 * `routeConfig` logic `AppShell` uses, so the two can never disagree about
 * what a given path requires.
 *
 * Fail-open vs fail-closed. A backend that's unreachable (network error,
 * timeout, cold start, 5xx) is not the same thing as a token that's actually
 * invalid — conflating them means a routine backend blip logs out every
 * signed-in user on their very next navigation, which is a worse failure
 * mode than the forgeable guard this replaces. So: a confirmed `401`/`403`
 * from a backend that's actually responding fails closed (redirect — the
 * token really is dead). A response we can't get at all — network exception,
 * or any non-2xx/401/403 status like a 500 — fails open: the request is
 * allowed through unauthenticated-as-far-as-proxy-knows, and whatever that
 * page's own client-side data calls do (which hit the same backend) is what
 * the user sees — the same graceful error/retry handling those already
 * have, escalating to `ServiceUnavailableOverlay` if the pattern keeps
 * happening. Nothing here can show a modal; there's no React tree yet.
 */

const PUBLIC_PATHS = ['/', '/forgot-password', '/set-password', '/user-stories'];

const isPublicPath = (pathname: string): boolean =>
  PUBLIC_PATHS.some((p) => pathname === p || pathname.startsWith(`${p}/`));

const ACCESS_COOKIE_OPTS = {
  secure: process.env.NODE_ENV === 'production',
  sameSite: 'strict' as const,
  path: '/',
  maxAge: 24 * 60 * 60, // 1 day — matches authService.login/refresh's Cookies.set
};

const REFRESH_COOKIE_OPTS = {
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  sameSite: 'lax' as const,
  path: '/',
  maxAge: 7 * 24 * 60 * 60, // 7 days — matches the BFF's login/refresh routes
};

type AuthOutcome<T> =
  | { kind: 'ok'; data: T }
  | { kind: 'unauthorized' } // a responding backend confirmed the token is dead
  | { kind: 'unreachable' }; // network error, timeout, or a 5xx — infra, not auth

/**
 * `authServer`'s functions throw `{status, data}` for an HTTP error response
 * and let a raw exception (no `.status`) propagate for a network-level
 * failure — that distinction is exactly what's needed here, so this just
 * reads it rather than changing either function's contract (both are shared
 * with the login/refresh BFF routes, which already depend on the throw shape).
 */
async function callAuth<T>(fn: () => Promise<T>): Promise<AuthOutcome<T>> {
  try {
    return { kind: 'ok', data: await fn() };
  } catch (err) {
    const status = (err as { status?: number } | undefined)?.status;
    if (status === 401 || status === 403) return { kind: 'unauthorized' };
    return { kind: 'unreachable' }; // no status (network exception) or >=500
  }
}

const extractUser = (data: unknown): AuthUser =>
  ((data as { data?: AuthUser })?.data ?? data) as AuthUser;

export async function proxy(req: NextRequest) {
  const { pathname } = req.nextUrl;

  if (isPublicPath(pathname)) {
    return NextResponse.next();
  }

  const accessToken = req.cookies.get('accessToken')?.value;
  const refreshToken = req.cookies.get('refreshToken')?.value;

  let user: AuthUser | null = null;
  let unreachable = false;
  let rotatedAccessToken: string | undefined;
  let rotatedRefreshToken: string | undefined;

  if (accessToken) {
    const me = await callAuth(() => authServer.meWithBackend(accessToken));
    if (me.kind === 'ok') user = extractUser(me.data);
    else if (me.kind === 'unreachable') unreachable = true;
    // 'unauthorized' falls through to the refresh attempt below.
  }

  // The access-token cookie outlives the 15-minute JWT inside it, so this is
  // the common case on any request more than ~15 minutes into a session —
  // not a rare fallback path. Mirrors the client's own refresh interceptor
  // (`api-client.ts`), just server-side, for a single incoming request.
  if (!user && !unreachable && refreshToken) {
    const refreshed = await callAuth(() => authServer.refreshWithBackend(refreshToken));
    if (refreshed.kind === 'ok') {
      const tokenData = (refreshed.data as { data?: { accessToken?: string; refreshToken?: string } })
        .data ?? (refreshed.data as { accessToken?: string; refreshToken?: string });
      rotatedAccessToken = tokenData.accessToken;
      rotatedRefreshToken = tokenData.refreshToken;
      if (rotatedAccessToken) {
        const me2 = await callAuth(() => authServer.meWithBackend(rotatedAccessToken!));
        if (me2.kind === 'ok') user = extractUser(me2.data);
        else if (me2.kind === 'unreachable') unreachable = true;
      }
    } else if (refreshed.kind === 'unreachable') {
      unreachable = true;
    }
    // refreshed.kind === 'unauthorized' -> refresh token itself is genuinely
    // expired/revoked. user stays null, unreachable stays false: fails
    // closed correctly, same as today.
  }

  if (unreachable) {
    return NextResponse.next();
  }

  if (!user) {
    return NextResponse.redirect(new URL('/', req.url));
  }

  const permissions = (user.permissions ?? []).map(normalizePermission);
  const { matched, allowed } = evaluateRouteAccess(pathname, {
    roles: user.roles ?? [],
    permissions,
  });

  if (matched && !allowed) {
    return NextResponse.redirect(new URL('/unauthorized', req.url));
  }

  const res = NextResponse.next();
  // Propagate a rotated access token back to the browser so the client's own
  // axios interceptor doesn't immediately trigger a second, redundant refresh
  // on the next API call this same page makes.
  if (rotatedAccessToken) res.cookies.set('accessToken', rotatedAccessToken, ACCESS_COOKIE_OPTS);
  if (rotatedRefreshToken) res.cookies.set('refreshToken', rotatedRefreshToken, REFRESH_COOKIE_OPTS);
  return res;
}

export const config = {
  // Everything except the BFF's own /api/auth/* routes, Next internals, and
  // static assets. Public app pages are excluded inside the function itself
  // (isPublicPath), not here, so this stays a single source of truth.
  matcher: ['/((?!api|_next/static|_next/image|favicon.ico).*)'],
};
