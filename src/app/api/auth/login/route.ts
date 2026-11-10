import { NextResponse } from 'next/server';
import { authServer } from '@/apis/server/auth.server';
import { respondWithTokens } from '@/apis/server/tokenResponse';

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

    // With MFA on there's no refreshToken yet: `{ mfaRequired, mfaToken }` passes through.
    return respondWithTokens(data);
  } catch (error) {
    console.error('Login Proxy Error:', error);
    return NextResponse.json(
      { success: false, message: 'Internal server error during login' },
      { status: 500 },
    );
  }
}
