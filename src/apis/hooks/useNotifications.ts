import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { notificationsService } from '../services/notifications.service';

export const useNotifications = () => {
  return useQuery({
    queryKey: ['notifications'],
    queryFn: notificationsService.getAll,
  });
};

export const useMarkNotificationRead = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => notificationsService.markAsRead(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notifications'] });
    },
  });
};

export const useMarkAllNotificationsRead = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => notificationsService.markAllAsRead(),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notifications'] });
    },
  });
};

export const useSendNotification = () => {
  return useMutation({
    mutationFn: ({
      userId,
      type,
      message,
      docId,
    }: {
      userId: string;
      type: string;
      message: string;
      docId?: string;
    }) => notificationsService.send(userId, type, message, docId),
  });
};
