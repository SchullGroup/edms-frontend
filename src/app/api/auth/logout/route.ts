import { NextResponse } from 'next/server';
import { authServer } from '@/apis/server/auth.server';

export async function POST(request: Request) {
  try {
    const authHeader = request.headers.get('Authorization');

    if (authHeader) {
      await authServer.logoutWithBackend(authHeader);
    }

    // Clear the HttpOnly cookie
    const res = NextResponse.json(
      { success: true, message: 'Logged out successfully' },
      { status: 200 },
    );
    res.cookies.delete('refreshToken');
    return res;
  } catch (error) {
    console.error('Logout Proxy Error:', error);
    return NextResponse.json(
      { success: false, message: 'Internal server error during logout' },
      { status: 500 },
    );
  }
}
