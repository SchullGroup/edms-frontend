import { apiClient } from '@/lib/api-client';
import {
  ApiResponse,
  Circular,
  CircularAcknowledgement,
  CircularInboxDetail,
  CircularInboxFilter,
  CircularInboxItem,
  CircularInboxSummary,
  CircularListItem,
  CircularRecipient,
  CircularRecipientFilter,
  CircularStatus,
  CreateCircularRequest,
  DocumentConfidentiality,
  DocumentUrgency,
  PaginatedResponse,
  UpdateCircularRequest,
} from '@/types/models';

/** `GET /circulars` — the authoring/oversight archive, bounded by `circular:view` scope. */
export interface CircularFilters {
  status?: CircularStatus;
  category?: string;
  confidentiality?: DocumentConfidentiality;
  urgency?: DocumentUrgency;
  /** Matches reference number, title, category or body. */
  search?: string;
  publishedFrom?: string;
  publishedTo?: string;
  createdBy?: string;
  /** Every version of one circular — its revision history. */
  seriesId?: string;
  page?: number;
  limit?: number;
}

/** `GET /circulars/inbox` — circulars sent to the signed-in user. */
export interface CircularInboxFilters {
  filter?: CircularInboxFilter;
  /** false: circulars currently in force. true: expired and superseded ones. */
  archived?: boolean;
  category?: string;
  urgency?: DocumentUrgency;
  search?: string;
  page?: number;
  limit?: number;
}

export interface CircularRecipientFilters {
  /** `outstanding` = required to acknowledge and hasn't yet. */
  status?: CircularRecipientFilter;
  departmentId?: string;
  search?: string;
  page?: number;
  limit?: number;
}

export const circularsService = {
  // --- Recipient inbox. No permission needed: being a recipient is the grant. ---

  getInbox: async (
    params?: CircularInboxFilters,
  ): Promise<PaginatedResponse<CircularInboxItem>> => {
    const res = await apiClient.get<PaginatedResponse<CircularInboxItem>>('/circulars/inbox', {
      params,
    });
    return res.data;
  },

  getInboxSummary: async (): Promise<CircularInboxSummary> => {
    const res = await apiClient.get<ApiResponse<CircularInboxSummary>>('/circulars/inbox/summary');
    return res.data.data;
  },

  /** The first open records the caller's read receipt. */
  getInboxItem: async (id: string): Promise<CircularInboxDetail> => {
    const res = await apiClient.get<ApiResponse<CircularInboxDetail>>(`/circulars/inbox/${id}`);
    return res.data.data;
  },

  acknowledge: async (id: string): Promise<CircularAcknowledgement> => {
    const res = await apiClient.post<ApiResponse<CircularAcknowledgement>>(
      `/circulars/inbox/${id}/acknowledge`,
    );
    return res.data.data;
  },

  // --- Authoring, publication and oversight. Each needs a `circular` permission. ---

  getAll: async (params?: CircularFilters): Promise<PaginatedResponse<CircularListItem>> => {
    const res = await apiClient.get<PaginatedResponse<CircularListItem>>('/circulars', { params });
    return res.data;
  },

  getById: async (id: string): Promise<Circular> => {
    const res = await apiClient.get<ApiResponse<Circular>>(`/circulars/${id}`);
    return res.data.data;
  },

  /** Creates a draft. Who the audience may reach is checked on publish, not here. */
  create: async (data: CreateCircularRequest): Promise<Circular> => {
    const res = await apiClient.post<ApiResponse<Circular>>('/circulars', data);
    return res.data.data;
  },

  update: async (id: string, data: UpdateCircularRequest): Promise<Circular> => {
    const res = await apiClient.patch<ApiResponse<Circular>>(`/circulars/${id}`, data);
    return res.data.data;
  },

  /** Drafts only — anything that has gone out is withdrawn instead. */
  remove: async (id: string): Promise<void> => {
    await apiClient.delete(`/circulars/${id}`);
  },

  /** No `publishAt` (or one in the past) publishes now; a future one schedules. */
  publish: async (id: string, publishAt?: string): Promise<Circular> => {
    const res = await apiClient.post<ApiResponse<Circular>>(
      `/circulars/${id}/publish`,
      publishAt ? { publishAt } : {},
    );
    return res.data.data;
  },

  cancelSchedule: async (id: string): Promise<Circular> => {
    const res = await apiClient.post<ApiResponse<Circular>>(`/circulars/${id}/cancel-schedule`);
    return res.data.data;
  },

  withdraw: async (id: string, reason: string): Promise<Circular> => {
    const res = await apiClient.post<ApiResponse<Circular>>(`/circulars/${id}/withdraw`, {
      reason,
    });
    return res.data.data;
  },

  /** Starts a revision draft of a published or expired circular. Returns the new draft. */
  revise: async (id: string): Promise<Circular> => {
    const res = await apiClient.post<ApiResponse<Circular>>(`/circulars/${id}/revisions`);
    return res.data.data;
  },

  getRecipients: async (
    id: string,
    params?: CircularRecipientFilters,
  ): Promise<PaginatedResponse<CircularRecipient>> => {
    const res = await apiClient.get<PaginatedResponse<CircularRecipient>>(
      `/circulars/${id}/recipients`,
      { params },
    );
    return res.data;
  },

  /** Queues a reminder to everyone outstanding; anyone reminded in the last hour is skipped. */
  sendReminders: async (id: string): Promise<{ circularId: string; outstanding: number }> => {
    const res = await apiClient.post<ApiResponse<{ circularId: string; outstanding: number }>>(
      `/circulars/${id}/reminders`,
    );
    return res.data.data;
  },
};
