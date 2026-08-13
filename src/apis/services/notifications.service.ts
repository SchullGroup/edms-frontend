import { PaginatedResponse } from '@/types/models';
import { SEED } from '@/store/initialData';

export const notificationsService = {
  getAll: async (): Promise<PaginatedResponse<any>> => {
    // Simulate latency
    await new Promise((resolve) => setTimeout(resolve, 400));

    return {
      success: true,
      message: 'Fetched notifications successfully',
      data: SEED.notifications as any,
      pagination: { page: 1, limit: 10, total: SEED.notifications.length, totalPages: 1 },
    };
  },

  markAsRead: async (id: string): Promise<any> => {
    await new Promise((resolve) => setTimeout(resolve, 400));
    return { success: true, message: 'Marked as read' };
  },

  markAllAsRead: async (): Promise<any> => {
    await new Promise((resolve) => setTimeout(resolve, 400));
    return { success: true, message: 'All notifications marked as read' };
  },
};
