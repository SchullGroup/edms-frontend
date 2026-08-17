import { apiClient } from '@/lib/api-client';
import { PaginatedResponse } from '@/types/models';

export const notificationsService = {
  getAll: async (params?: Record<string, any>): Promise<PaginatedResponse<any>> => {
    const res = await apiClient.get<PaginatedResponse<any>>('/notifications', { params });
    return res.data;
  },

  markAsRead: async (id: string): Promise<any> => {
    const res = await apiClient.patch(`/notifications/${id}/read`);
    return res.data;
  },

  markAllAsRead: async (): Promise<any> => {
    const res = await apiClient.post('/notifications/mark-all-read');
    return res.data;
  },

  send: async (userId: string, type: string, message: string, docId?: string): Promise<any> => {
    // This might be better as an admin endpoint, but implemented for parity
    const res = await apiClient.post('/notifications', { userId, type, message, docId });
    return res.data;
  },
};
