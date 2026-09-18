import axios from 'axios';
import { apiClient } from '@/lib/api-client';
import { AuthUser, ApiResponse } from '@/types/models';
import Cookies from 'js-cookie';

export interface LoginResponseData {
  user: AuthUser;
  accessToken: string;
  // refreshToken is now stripped by the Next.js Proxy and stored securely in HttpOnly cookie
}

export interface RefreshResponseData {
  accessToken: string;
}

export const authService = {
  login: async (credentials: any): Promise<LoginResponseData> => {
    // Call the local Next.js proxy route, which intercepts the refreshToken
    const response = await axios.post<ApiResponse<LoginResponseData>>(
      '/api/auth/login',
      credentials,
    );

    // Set accessToken securely in js-cookie for API Client interception
    if (response.data?.success !== false && response.data?.data?.accessToken) {
      Cookies.set('accessToken', response.data.data.accessToken, {
        expires: 1,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'strict',
      });
    }

    return response.data.data;
  },

  refresh: async (): Promise<RefreshResponseData> => {
    // The Next.js proxy extracts the refreshToken automatically from the HttpOnly cookie.
    const response = await axios.post<ApiResponse<RefreshResponseData>>('/api/auth/refresh');

    if (response.data?.success !== false && response.data?.data?.accessToken) {
      Cookies.set('accessToken', response.data.data.accessToken, {
        expires: 1,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'strict',
      });
    }

    return response.data.data;
  },

  // Note: The endpoints below are implemented in the Express backend, but are not formally
  // documented in the Swagger api-docs.json. We keep them available here for convenience.

  /**
   * Fire-and-forget. The local `accessToken` cookie is removed synchronously so
   * the caller can redirect immediately; the request to the BFF (which clears
   * the HttpOnly refresh cookie and asks the backend to revoke the refresh
   * token) runs in the background and its outcome is not awaited.
   */
  logout: (): void => {
    const token = Cookies.get('accessToken');
    Cookies.remove('accessToken');
    axios
      .post(
        '/api/auth/logout',
        {},
        token ? { headers: { Authorization: `Bearer ${token}` } } : undefined,
      )
      .catch(() => {
        /* best-effort — the session is already torn down client-side */
      });
  },

  me: async (): Promise<AuthUser> => {
    // This goes straight to the Express backend via apiClient (attaches Authorization header)
    const response = await apiClient.get<ApiResponse<AuthUser>>('/auth/me');
    return response.data.data;
  },

  // Neither of the two below touches a cookie, so — unlike login/refresh/logout —
  // there's no need to go via the Next proxy; they hit the Express backend directly.

  /** The backend should always resolve with 200 here regardless of whether the
   *  email is registered, so a caller can't enumerate accounts by trying emails. */
  forgotPassword: async (email: string): Promise<void> => {
    await apiClient.post('/auth/forgot-password', { email });
  },

  /** Consumes a one-time token from either an invitation or a password-reset
   *  email. Backend field is `password` (singular) — `confirmPassword` never
   *  goes over the wire; matching is a client-side-only check. */
  resetPassword: async (payload: { token: string; password: string }): Promise<void> => {
    await apiClient.post('/auth/reset-password', payload);
  },
};
