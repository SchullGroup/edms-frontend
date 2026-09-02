import { apiClient } from '@/lib/api-client';
import { ApiResponse, PaginatedResponse, WorkflowHistoryRecord } from '@/types/models';

export interface WorkflowHistoryFilters {
  page?: number;
  limit?: number;
  workflowInstanceId?: string;
  documentId?: string;
  taskId?: string;
  actorId?: string;
  action?: string;
  fromStage?: string;
  toStage?: string;
  /** ISO date-time bounds on `occurredAt`. */
  occurredFrom?: string;
  occurredTo?: string;
  order?: 'asc' | 'desc';
  /** Oversight roles may pass `'all'`; staff default to `'mine'`. */
  scope?: 'mine' | 'all';
}

export const workflowHistoryService = {
  getAll: async (
    params?: WorkflowHistoryFilters,
  ): Promise<PaginatedResponse<WorkflowHistoryRecord>> => {
    const res = await apiClient.get<PaginatedResponse<WorkflowHistoryRecord>>('/workflow-history', {
      params,
    });
    return res.data;
  },

  getById: async (historyId: string): Promise<WorkflowHistoryRecord> => {
    const res = await apiClient.get<ApiResponse<WorkflowHistoryRecord>>(
      `/workflow-history/${historyId}`,
    );
    return res.data.data;
  },
};
