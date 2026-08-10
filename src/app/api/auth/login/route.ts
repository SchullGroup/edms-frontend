import { NextResponse } from 'next/server';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

export async function POST(request: Request) {
  try {
    const body = await request.json();

    const response = await fetch(`${API_URL}/api/v1/auth/login`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });

    const data = await response.json();

    if (!response.ok || data.success === false) {
      return NextResponse.json(data, { status: response.status || 400 });
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
