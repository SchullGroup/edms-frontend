import { NextResponse } from 'next/server';
import { authServer } from '@/apis/server/auth.server';
import { respondWithTokens } from '@/apis/server/tokenResponse';

/** The second sign-in step: same response as a password login, so same cookie handling. */
export async function POST(request: Request) {
  try {
    const body = await request.json();
    let data;

    try {
      data = await authServer.verifyMfaWithBackend(body);
    } catch (error: any) {
      return NextResponse.json(error.data || { success: false, message: 'Invalid request' }, { status: error.status || 400 });
    }

    if (data.success === false) {
      return NextResponse.json(data, { status: 400 });
    }

    return respondWithTokens(data);
  } catch (error) {
    console.error('MFA Verify Proxy Error:', error);
    return NextResponse.json(
      { success: false, message: 'Internal server error during sign-in' },
      { status: 500 },
    );
  }
}
