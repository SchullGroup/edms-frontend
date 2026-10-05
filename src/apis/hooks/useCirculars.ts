import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  circularsService,
  CircularFilters,
  CircularInboxFilters,
  CircularRecipientFilters,
} from '@/apis/services/circulars.service';
import { CircularInboxDetail, CreateCircularRequest, UpdateCircularRequest } from '@/types/models';
import { useUIStore } from '@/store/useUIStore';

export const circularKeys = {
  all: ['circulars'] as const,
  lists: () => [...circularKeys.all, 'list'] as const,
  list: (params: CircularFilters = {}) => [...circularKeys.lists(), params] as const,
  detail: (id: string) => [...circularKeys.all, 'detail', id] as const,
  recipients: (id: string, params: CircularRecipientFilters = {}) =>
    [...circularKeys.all, 'recipients', id, params] as const,
  inbox: () => [...circularKeys.all, 'inbox'] as const,
  inboxList: (params: CircularInboxFilters = {}) =>
    [...circularKeys.inbox(), 'list', params] as const,
  inboxSummary: () => [...circularKeys.inbox(), 'summary'] as const,
  inboxItem: (id: string) => [...circularKeys.inbox(), 'item', id] as const,
};

const errorMessage = (err: any, fallback: string) => err?.response?.data?.message || fallback;

// --- Recipient inbox ---

export function useCircularInbox(params: CircularInboxFilters = {}) {
  return useQuery({
    queryKey: circularKeys.inboxList(params),
    queryFn: () => circularsService.getInbox(params),
  });
}

/** Unread / unacknowledged counts — drives the sidebar badge. */
export function useCircularInboxSummary(options?: { enabled?: boolean }) {
  return useQuery({
    queryKey: circularKeys.inboxSummary(),
    queryFn: () => circularsService.getInboxSummary(),
    enabled: options?.enabled ?? true,
  });
}

/**
 * Opens a circular sent to the user. The backend records the read receipt on
 * the first open, so when this fetch is the one that marked it read, the inbox
 * list and badge are refreshed. Later refetches (window focus) leave them be.
 */
export function useCircularInboxItem(id?: string) {
  const queryClient = useQueryClient();
  return useQuery({
    queryKey: circularKeys.inboxItem(id || ''),
    queryFn: async () => {
      const previous = queryClient.getQueryData<CircularInboxDetail>(
        circularKeys.inboxItem(id as string),
      );
      const item = await circularsService.getInboxItem(id as string);
      if (!previous?.receipt.readAt) {
        queryClient.invalidateQueries({ queryKey: [...circularKeys.inbox(), 'list'] });
        queryClient.invalidateQueries({ queryKey: circularKeys.inboxSummary() });
      }
      return item;
    },
    enabled: !!id,
  });
}

export function useAcknowledgeCircular() {
  const queryClient = useQueryClient();
  const { addToast } = useUIStore.getState();

  return useMutation({
    mutationFn: (id: string) => circularsService.acknowledge(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: circularKeys.all });
      addToast('Acknowledgement recorded', 'success');
    },
    onError: (err: any) => {
      addToast(errorMessage(err, 'Failed to acknowledge circular'), 'error');
    },
  });
}

// --- Authoring, publication and oversight ---

export function useCirculars(params: CircularFilters = {}, options?: { enabled?: boolean }) {
  return useQuery({
    queryKey: circularKeys.list(params),
    queryFn: () => circularsService.getAll(params),
    enabled: options?.enabled ?? true,
  });
}

export function useCircular(id?: string) {
  return useQuery({
    queryKey: circularKeys.detail(id || ''),
    queryFn: () => circularsService.getById(id as string),
    enabled: !!id,
  });
}

export function useCircularRecipients(id: string, params: CircularRecipientFilters = {}) {
  return useQuery({
    queryKey: circularKeys.recipients(id, params),
    queryFn: () => circularsService.getRecipients(id, params),
    enabled: !!id,
  });
}

/**
 * Every lifecycle change (publish, withdraw, revise, …) can move a circular
 * between lists, change its stats and change what recipients see, so they all
 * invalidate the whole `circulars` family rather than picking keys.
 */
function useCircularMutation<TVars, TResult>(
  mutationFn: (vars: TVars) => Promise<TResult>,
  messages: { success?: string | ((result: TResult) => string); error: string },
) {
  const queryClient = useQueryClient();
  const { addToast } = useUIStore.getState();

  return useMutation({
    mutationFn,
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: circularKeys.all });
      const success =
        typeof messages.success === 'function' ? messages.success(result) : messages.success;
      if (success) addToast(success, 'success');
    },
    onError: (err: any) => {
      addToast(errorMessage(err, messages.error), 'error');
    },
  });
}

export function useCreateCircular() {
  return useCircularMutation((data: CreateCircularRequest) => circularsService.create(data), {
    success: 'Draft saved',
    error: 'Failed to save the circular',
  });
}

export function useUpdateCircular() {
  return useCircularMutation(
    ({ id, data }: { id: string; data: UpdateCircularRequest }) =>
      circularsService.update(id, data),
    { success: 'Draft updated', error: 'Failed to update the circular' },
  );
}

export function useDeleteCircular() {
  return useCircularMutation((id: string) => circularsService.remove(id), {
    success: 'Draft deleted',
    error: 'Failed to delete the draft',
  });
}

export function usePublishCircular() {
  return useCircularMutation(
    ({ id, publishAt }: { id: string; publishAt?: string }) =>
      circularsService.publish(id, publishAt),
    {
      success: (c) =>
        c.status === 'scheduled'
          ? `Scheduled as ${c.referenceNumber ?? 'a circular'}`
          : `Published ${c.referenceNumber ?? ''} to ${c.stats?.recipients ?? 0} recipient(s)`.trim(),
      error: 'Failed to publish the circular',
    },
  );
}

export function useCancelCircularSchedule() {
  return useCircularMutation((id: string) => circularsService.cancelSchedule(id), {
    success: 'Schedule cancelled — the circular is a draft again',
    error: 'Failed to cancel the schedule',
  });
}

export function useWithdrawCircular() {
  return useCircularMutation(
    ({ id, reason }: { id: string; reason: string }) => circularsService.withdraw(id, reason),
    { success: 'Circular withdrawn', error: 'Failed to withdraw the circular' },
  );
}

export function useReviseCircular() {
  return useCircularMutation((id: string) => circularsService.revise(id), {
    success: (c) => `Revision v${c.versionNumber} started as a draft`,
    error: 'Failed to start a revision',
  });
}

export function useSendCircularReminders() {
  return useCircularMutation((id: string) => circularsService.sendReminders(id), {
    success: (r) =>
      r.outstanding > 0
        ? `Reminders queued for ${r.outstanding} outstanding recipient(s)`
        : 'Everyone has already acknowledged',
    error: 'Failed to send reminders',
  });
}
