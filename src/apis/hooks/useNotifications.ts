import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { notificationsService, NotificationFilters } from '@/apis/services/notifications.service';
import { UpdateNotificationPreferencesRequest } from '@/types/models';
import { useUIStore } from '@/store/useUIStore';

export const notificationKeys = {
  all: ['notifications'] as const,
  lists: () => [...notificationKeys.all, 'list'] as const,
  list: (params: NotificationFilters = {}) => [...notificationKeys.lists(), params] as const,
  unreadCount: () => [...notificationKeys.all, 'unreadCount'] as const,
  preferences: () => [...notificationKeys.all, 'preferences'] as const,
};

export function useNotifications(
  params: NotificationFilters = {},
  options?: { enabled?: boolean },
) {
  return useQuery({
    queryKey: notificationKeys.list(params),
    queryFn: () => notificationsService.getAll(params),
    enabled: options?.enabled ?? true,
  });
}

/**
 * Unread in-app count for the bell badge. Polled so a notification raised by
 * another user's workflow action shows up without a reload.
 */
export function useUnreadNotificationCount(options?: { enabled?: boolean }) {
  return useQuery({
    queryKey: notificationKeys.unreadCount(),
    queryFn: () => notificationsService.getUnreadCount(),
    enabled: options?.enabled ?? true,
    refetchInterval: 60_000,
    refetchOnWindowFocus: true,
  });
}

export function useMarkNotificationRead() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => notificationsService.markAsRead(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: notificationKeys.all });
    },
    // A 404 here just means it was already read (the backend returns 404 for
    // "not found, not owned, or already read"), so there's nothing to say.
  });
}

export function useMarkAllNotificationsRead() {
  const queryClient = useQueryClient();
  const { addToast } = useUIStore.getState();

  return useMutation({
    mutationFn: () => notificationsService.markAllAsRead(),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: notificationKeys.all });
      addToast('All notifications marked as read', 'info');
    },
    onError: (err: any) => {
      addToast(err.response?.data?.message || 'Failed to mark notifications as read', 'error');
    },
  });
}

export function useNotificationPreferences(options?: { enabled?: boolean }) {
  return useQuery({
    queryKey: notificationKeys.preferences(),
    queryFn: () => notificationsService.getPreferences(),
    enabled: options?.enabled ?? true,
  });
}

export function useUpdateNotificationPreferences() {
  const queryClient = useQueryClient();
  const { addToast } = useUIStore.getState();

  return useMutation({
    mutationFn: (data: UpdateNotificationPreferencesRequest) =>
      notificationsService.updatePreferences(data),
    onSuccess: (prefs) => {
      queryClient.setQueryData(notificationKeys.preferences(), prefs);
      addToast('Notification preferences updated', 'success');
    },
    onError: (err: any) => {
      addToast(err.response?.data?.message || 'Failed to update preferences', 'error');
    },
  });
}
