const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

export const authServer = {
  loginWithBackend: async (body: any): Promise<any> => {
    const response = await fetch(`${API_URL}/api/v1/auth/login`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });

    const data = await response.json();

    if (!response.ok) {
      throw { status: response.status || 400, data };
    }

    return data;
  },

  logoutWithBackend: async (authHeader: string): Promise<void> => {
    try {
      await fetch(`${API_URL}/api/v1/auth/logout`, {
        method: 'POST',
        headers: {
          Authorization: authHeader,
        },
      });
    } catch (err) {
      console.error('Backend logout call failed:', err);
    }
  },

  refreshWithBackend: async (refreshToken: string): Promise<any> => {
    const response = await fetch(`${API_URL}/api/v1/auth/refresh`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refreshToken }),
    });

    const data = await response.json();
    if (!response.ok) {
      throw { status: response.status || 401, data };
    }
    return data;
  },
};
