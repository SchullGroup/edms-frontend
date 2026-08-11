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

  logout: async (): Promise<void> => {
    // The Next.js proxy will clear the HttpOnly cookie
    await axios.post('/api/auth/logout');
    Cookies.remove('accessToken');
  },

  me: async (): Promise<AuthUser> => {
    // This goes straight to the Express backend via apiClient (attaches Authorization header)
    const response = await apiClient.get<ApiResponse<AuthUser>>('/auth/me');
    return response.data.data;
  },
};
