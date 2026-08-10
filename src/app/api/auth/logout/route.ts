import { NextResponse } from "next/server";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001";

export async function POST(request: Request) {
  try {
    const authHeader = request.headers.get("Authorization");

    // Call backend logout
    if (authHeader) {
      await fetch(`${API_URL}/api/v1/auth/logout`, {
        method: "POST",
        headers: {
          Authorization: authHeader,
        },
      }).catch((err) => console.error("Backend logout call failed:", err));
    }

    // Clear the HttpOnly cookie
    const res = NextResponse.json(
      { success: true, message: "Logged out successfully" },
      { status: 200 },
    );
    res.cookies.delete("refreshToken");
    return res;
  } catch (error) {
    console.error("Logout Proxy Error:", error);
    return NextResponse.json(
      { success: false, message: "Internal server error during logout" },
      { status: 500 },
    );
  }
}
