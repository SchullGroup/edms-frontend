import { cookies } from "next/headers";
import { NextResponse } from "next/server";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001";

const COOKIE_OPTS = {
  httpOnly: true,
  secure:   process.env.NODE_ENV === "production",
  sameSite: "lax" as const,
  path:     "/",
  maxAge:   7 * 24 * 60 * 60, // 7 days
};

export async function POST(request: Request) {
  try {
    // Read the refresh token from the HttpOnly cookie
    const cookieStore = await cookies();
    const refreshToken = cookieStore.get("refreshToken")?.value;

    if (!refreshToken) {
      return NextResponse.json(
        { success: false, message: "No refresh token found" },
        { status: 401 },
      );
    }

    const response = await fetch(`${API_URL}/api/v1/auth/refresh`, {
      method:  "POST",
      headers: { "Content-Type": "application/json" },
      body:    JSON.stringify({ refreshToken }),
    });

    const data = await response.json();
    const backendStatus = response.status;

    if (!response.ok || data.success === false) {
      // Don't delete cookie yet to handle cross-tab race conditions
      return NextResponse.json(data, { status: backendStatus || 401 });
    }

    // Parse the wrapped or flat token shapes
    const tokenData = data.data ?? data;
    const { refreshToken: newRefreshToken, ...restData } = tokenData;

    const res = NextResponse.json({ ...data, data: restData }, { status: 200 });

    // Rotate cookie
    res.cookies.set("refreshToken", newRefreshToken ?? refreshToken, COOKIE_OPTS);

    return res;
  } catch (error) {
    console.error("Refresh Proxy Error:", error);
    return NextResponse.json(
      { success: false, message: "Internal server error during refresh" },
      { status: 500 },
    );
  }
}
