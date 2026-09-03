import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

import {
  notificationsService,
  type ListNotificationsParams,
} from '../services/notifications.service';

import type { NotificationPreferences } from '@/types/models';

export const notificationKeys = {
  all: ['notifications'] as const,
  list: (params?: ListNotificationsParams) => ['notifications', 'list', params ?? {}] as const,
  unreadCount: ['notifications', 'unread-count'] as const,
  preferences: ['notifications', 'preferences'] as const,
};

export const useNotifications = (params?: ListNotificationsParams) => {
  return useQuery({
    queryKey: notificationKeys.list(params),
    queryFn: () => notificationsService.getAll(params),
  });
};

/**
 * Drives the bell badge. Previously this count was derived from the seeded
 * store, so it never reflected real notifications; the backend exposes a
 * purpose-built endpoint for it.
 */
export const useUnreadNotificationCount = () => {
  return useQuery({
    queryKey: notificationKeys.unreadCount,
    queryFn: notificationsService.getUnreadCount,
    // The badge is ambient — refresh it periodically rather than only on
    // navigation, but not so often that it's chatty.
    refetchInterval: 60_000,
    staleTime: 30_000,
  });
};

export const useMarkNotificationRead = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => notificationsService.markAsRead(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: notificationKeys.all });
    },
  });
};

export const useMarkAllNotificationsRead = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => notificationsService.markAllAsRead(),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: notificationKeys.all });
    },
  });
};

export const useNotificationPreferences = () => {
  return useQuery({
    queryKey: notificationKeys.preferences,
    queryFn: notificationsService.getPreferences,
  });
};

export const useUpdateNotificationPreferences = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (
      updates: Partial<
        Pick<NotificationPreferences, 'emailEnabled' | 'inAppEnabled' | 'digestMode'>
      >,
    ) => notificationsService.updatePreferences(updates),
    onSuccess: (preferences) => {
      queryClient.setQueryData(notificationKeys.preferences, preferences);
    },
  });
};
