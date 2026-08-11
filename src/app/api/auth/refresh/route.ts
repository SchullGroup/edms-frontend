import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import { authServer } from '@/apis/server/auth.server';

const COOKIE_OPTS = {
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  sameSite: 'lax' as const,
  path: '/',
  maxAge: 7 * 24 * 60 * 60, // 7 days
};

export async function POST(request: Request) {
  try {
    // Read the refresh token from the HttpOnly cookie
    const cookieStore = await cookies();
    const refreshToken = cookieStore.get('refreshToken')?.value;

    if (!refreshToken) {
      return NextResponse.json(
        { success: false, message: 'No refresh token found' },
        { status: 401 },
      );
    }

    let data;
    try {
      data = await authServer.refreshWithBackend(refreshToken);
    } catch (error: any) {
      // Don't delete cookie yet to handle cross-tab race conditions
      return NextResponse.json(error.data || { success: false, message: 'Invalid refresh token' }, {
        status: error.status || 401,
      });
    }

    if (data.success === false) {
      return NextResponse.json(data, { status: 401 });
    }

    // Parse the wrapped or flat token shapes
    const tokenData = data.data ?? data;
    const { refreshToken: newRefreshToken, ...restData } = tokenData;

    const res = NextResponse.json({ ...data, data: restData }, { status: 200 });

    // Rotate cookie
    res.cookies.set('refreshToken', newRefreshToken ?? refreshToken, COOKIE_OPTS);

    return res;
  } catch (error) {
    console.error('Refresh Proxy Error:', error);
    return NextResponse.json(
      { success: false, message: 'Internal server error during refresh' },
      { status: 500 },
    );
  }
}
