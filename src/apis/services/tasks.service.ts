import { apiClient } from '@/lib/api-client';
import {
  ApiResponse,
  PaginatedResponse,
  Task,
  TaskActionRequest,
  TaskSlaStatsResponse,
  TaskStatus,
} from '@/types/models';

export interface TaskStatsParams {
  groupBy?: 'department';
  departmentId?: string;
  /** ISO date — filters on `completedAt`. */
  from?: string;
  to?: string;
}

/** Mirrors `listTasksQuerySchema` on the backend, which is `.strict()` — any key
 *  not listed here is rejected with a 400. */
export interface TaskFilters {
  page?: number;
  limit?: number;
  status?: TaskStatus;
  workflowInstanceId?: string;
  assigneeId?: string;
  assignedRoleId?: string;
  stage?: string;
  scope?: 'mine' | 'all';
}

/** The backend caps `limit` at 100. */
const MAX_LIMIT = 100;

/** Safety valve so a large tenant can never spin the browser forever. */
const MAX_PAGES = 20;

export const tasksService = {
  getAll: async (params?: TaskFilters): Promise<PaginatedResponse<Task>> => {
    const response = await apiClient.get<PaginatedResponse<Task>>('/tasks', { params });
    return response.data;
  },

  /**
   * Walks every page of `GET /tasks` and returns the flattened list.
   *
   * The supervisor dashboards aggregate over the whole task set (counts, ageing
   * buckets, per-member rollups), so a single 20-row page would silently produce
   * wrong numbers. `truncated` is true when we hit MAX_PAGES and stopped early,
   * so callers can warn instead of quietly under-reporting.
   */
  getAllPages: async (
    params?: Omit<TaskFilters, 'page' | 'limit'>,
  ): Promise<{ items: Task[]; total: number; truncated: boolean }> => {
    const items: Task[] = [];
    let page = 1;
    let total = 0;
    let totalPages = 1;

    while (page <= totalPages && page <= MAX_PAGES) {
      const response = await apiClient.get<PaginatedResponse<Task>>('/tasks', {
        params: { ...params, page, limit: MAX_LIMIT },
      });

      items.push(...response.data.data);
      total = response.data.pagination.total;
      totalPages = response.data.pagination.totalPages;
      page += 1;
    }

    return { items, total, truncated: totalPages > MAX_PAGES };
  },

  getById: async (id: string): Promise<Task> => {
    const response = await apiClient.get<ApiResponse<Task>>(`/tasks/${id}`);
    return response.data.data;
  },

  // Completed-task SLA rollup by department (`GET /tasks/stats`).
  getStats: async (params?: TaskStatsParams): Promise<TaskSlaStatsResponse> => {
    const response = await apiClient.get<ApiResponse<TaskSlaStatsResponse>>('/tasks/stats', {
      params,
    });
    return response.data.data;
  },

  action: async (id: string, actionReq: TaskActionRequest): Promise<Task> => {
    const response = await apiClient.post<ApiResponse<Task>>(`/tasks/${id}/action`, actionReq);
    return response.data.data;
  },

  // PATCH, not POST — matches `tasksRouter.patch('/:taskId/reassign', ...)`.
  reassign: async (id: string, assigneeId: string, note?: string): Promise<Task> => {
    const response = await apiClient.patch<ApiResponse<Task>>(`/tasks/${id}/reassign`, {
      assigneeId,
      ...(note ? { note } : {}),
    });
    return response.data.data;
  },
};
