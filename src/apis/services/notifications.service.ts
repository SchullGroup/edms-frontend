import { apiClient } from '@/lib/api-client';
import {
  ApiResponse,
  Notification,
  NotificationPreferences,
  PaginatedResponse,
} from '@/types/models';

export interface ListNotificationsParams {
  page?: number;
  limit?: number;
  unreadOnly?: boolean;
  channel?: 'in_app' | 'email';
  status?: 'pending' | 'sent' | 'read' | 'failed';
}

export const notificationsService = {
  getAll: async (params?: ListNotificationsParams): Promise<PaginatedResponse<Notification>> => {
    const res = await apiClient.get<PaginatedResponse<Notification>>('/notifications', {
      // The backend query schema coerces `unreadOnly` from the strings 'true'/'false',
      // so send it as a string rather than a raw boolean.
      params: params
        ? { ...params, unreadOnly: params.unreadOnly ? 'true' : undefined }
        : undefined,
    });
    return res.data;
  },

  getUnreadCount: async (): Promise<number> => {
    const res = await apiClient.get<ApiResponse<{ count: number }>>('/notifications/unread-count');
    return res.data.data?.count ?? 0;
  },

  markAsRead: async (id: string): Promise<void> => {
    await apiClient.patch(`/notifications/${id}/read`);
  },

  // Backend route is `/read-all` — it pairs with `/unread-count`. The frontend
  // previously called `/mark-all-read`, which matched no route and 404'd silently.
  markAllAsRead: async (): Promise<void> => {
    await apiClient.post('/notifications/read-all');
  },

  getPreferences: async (): Promise<NotificationPreferences> => {
    const res = await apiClient.get<ApiResponse<NotificationPreferences>>(
      '/notifications/preferences',
    );
    return res.data.data;
  },

  updatePreferences: async (
    updates: Partial<Pick<NotificationPreferences, 'emailEnabled' | 'inAppEnabled' | 'digestMode'>>,
  ): Promise<NotificationPreferences> => {
    const res = await apiClient.put<ApiResponse<NotificationPreferences>>(
      '/notifications/preferences',
      updates,
    );
    return res.data.data;
  },
};

// NOTE: there is deliberately no `send()` here any more.
//
// The old implementation POSTed to `/notifications` with an arbitrary `userId`,
// which matched no backend route (silent 404). It should not be restored as-is:
// letting a client mint a notification addressed to another user is a spoofing
// vector. The "Request access" flow that used it needs a backend endpoint that
// derives the actor from the session — see docs/BACKEND_REQUESTS.md.
