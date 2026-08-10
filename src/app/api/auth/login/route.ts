import { NextResponse } from 'next/server';
import { authServer } from '@/apis/server/auth.server';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    let data;

    try {
      data = await authServer.loginWithBackend(body);
    } catch (error: any) {
      return NextResponse.json(error.data || { success: false, message: 'Invalid request' }, { status: error.status || 400 });
    }

    if (data.success === false) {
      return NextResponse.json(data, { status: 400 });
    }

    // Unpack data from the backend's standard ApiResponse wrapper
    const tokenData = data.data ?? data;
    const { refreshToken, ...restData } = tokenData;

    // Build response first, then set the HttpOnly cookie directly on it.
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
  } catch (error) {
    console.error('Login Proxy Error:', error);
    return NextResponse.json(
      { success: false, message: 'Internal server error during login' },
      { status: 500 },
    );
  }
}
