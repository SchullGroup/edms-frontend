import { NextResponse } from 'next/server';

/** Relays a backend login body to the browser, moving `refreshToken` into the httpOnly cookie.
 *  A body without one (an MFA challenge) passes through unchanged. */
export function respondWithTokens(data: any): NextResponse {
  const tokenData = data.data ?? data;
  const { refreshToken, ...restData } = tokenData;

  const res = NextResponse.json({ ...data, data: restData }, { status: 200 });

  if (refreshToken) {
    res.cookies.set('refreshToken', refreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax', // lax allows the cookie on same-site navigations
      path: '/',
      maxAge: 7 * 24 * 60 * 60, // 7 days — matches backend TTL
    });
  }

  return res;
}
