import { apiClient } from '@/lib/api-client';
import {
  ApiResponse,
  Notification,
  NotificationChannel,
  NotificationPreferences,
  NotificationStatus,
  PaginatedResponse,
  UpdateNotificationPreferencesRequest,
} from '@/types/models';

/** Mirrors the query schema on `GET /notifications`. */
export interface NotificationFilters {
  page?: number;
  limit?: number;
  channel?: NotificationChannel;
  status?: NotificationStatus;
  unreadOnly?: boolean;
}

export const notificationsService = {
  getAll: async (params?: NotificationFilters): Promise<PaginatedResponse<Notification>> => {
    const res = await apiClient.get<PaginatedResponse<Notification>>('/notifications', {
      // The backend query schema coerces `unreadOnly` from the strings 'true'/'false',
      // so send it as a string rather than a raw boolean, and omit it when not set.
      params: params
        ? { ...params, unreadOnly: params.unreadOnly ? 'true' : undefined }
        : undefined,
    });
    return res.data;
  },

  /** `GET /notifications/unread-count` — in-app unread only. The response body
   *  isn't documented in the spec, so accept either a bare number or the usual
   *  `{ count }` envelope. */
  getUnreadCount: async (): Promise<number> => {
    const res = await apiClient.get<ApiResponse<number | { count?: number; unread?: number }>>(
      '/notifications/unread-count',
    );
    const data = res.data.data;
    if (typeof data === 'number') return data;
    return data?.count ?? data?.unread ?? 0;
  },

  markAsRead: async (id: string): Promise<Notification> => {
    const res = await apiClient.patch<ApiResponse<Notification>>(`/notifications/${id}/read`);
    return res.data.data;
  },

  // POST /notifications/read-all — marks every in-app notification read. It pairs
  // with /unread-count; the frontend previously called /mark-all-read, which
  // matched no route and 404'd silently.
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
    data: UpdateNotificationPreferencesRequest,
  ): Promise<NotificationPreferences> => {
    const res = await apiClient.put<ApiResponse<NotificationPreferences>>(
      '/notifications/preferences',
      data,
    );
    return res.data.data;
  },
};

// ── Payload helpers ───────────────────────────────────────────────────────────
// `payload` is rendered server-side and only loosely specified, so the shape
// knowledge lives here rather than being repeated in every component.

export const isUnread = (n: Notification): boolean => n.status !== 'read' && !n.readAt;

export const notificationTitle = (n: Notification): string =>
  n.payload?.title || n.payload?.message || n.type;

export const notificationMessage = (n: Notification): string =>
  n.payload?.message || n.payload?.title || n.type;

/**
 * In-app destination for a notification, or `null` when it doesn't deep-link.
 * Absolute URLs pointing at another origin are dropped — `router.push` can't
 * use them and they'd be an open-redirect if the payload were ever tampered with.
 */
export const notificationHref = (n: Notification): string | null => {
  const url = n.payload?.actionUrl;
  if (!url) return null;
  if (url.startsWith('/')) return url;
  try {
    const parsed = new URL(url);
    if (typeof window !== 'undefined' && parsed.origin !== window.location.origin) return null;
    return `${parsed.pathname}${parsed.search}${parsed.hash}`;
  } catch {
    return null;
  }
};

/** Maps the `type` event key (`task.assigned`, `workflow.on_hold`, …) onto an
 *  icon name from `@/components/ui/Icons`. */
export const notificationIcon = (type: string): string => {
  const group = (type || '').split('.')[0];
  const icons: Record<string, string> = {
    task: 'inbox',
    workflow: 'flow',
    document: 'doc',
    sla: 'alert',
    comment: 'edit',
    circular: 'speaker',
    delegation: 'users',
    audit: 'finding',
  };
  return icons[group] || 'bell';
};

// NOTE: there is deliberately no `send()` here.
//
// The old implementation POSTed to `/notifications` with an arbitrary `userId`,
// which matched no backend route (silent 404). It should not be restored as-is:
// letting a client mint a notification addressed to another user is a spoofing
// vector. The "Request access" flow that used it needs a backend endpoint that
// derives the actor from the session — see docs/BACKEND_REQUESTS.md.
