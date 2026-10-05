import { apiClient } from '@/lib/api-client';
import {
  ApiResponse,
  PaginatedResponse,
  Task,
  TaskActionRequest,
  TaskSlaStatsResponse,
  TaskStatus,
  TaskWorkloadData,
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

/** Query for `GET /tasks/approvals` — the purpose-built supervisor queue. */
export interface ApprovalTaskFilters {
  page?: number;
  limit?: number;
  status?: 'pending' | 'escalated';
  scope?: 'mine' | 'all';
}

/** A supervisor should normally omit `departmentId` — the backend resolves
 *  their own department automatically. */
export interface DepartmentScopedTaskParams {
  departmentId?: string;
}

export const tasksService = {
  getAll: async (params?: TaskFilters): Promise<PaginatedResponse<Task>> => {
    const response = await apiClient.get<PaginatedResponse<Task>>('/tasks', { params });
    return response.data;
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

  /** Purpose-built supervisor approvals queue — ordered by urgency then due
   *  date server-side. Prefer this over `getAll({status:'pending'})` for the
   *  Approvals Queue screen. */
  getApprovals: async (params?: ApprovalTaskFilters): Promise<PaginatedResponse<Task>> => {
    const response = await apiClient.get<PaginatedResponse<Task>>('/tasks/approvals', { params });
    return response.data;
  },

  /** Per-member open-task counts against a fixed capacity, for Workload &
   *  Reassign. Only directly assigned, active, current-stage tasks count. */
  getWorkload: async (params?: DepartmentScopedTaskParams): Promise<TaskWorkloadData> => {
    const response = await apiClient.get<ApiResponse<TaskWorkloadData>>('/tasks/workload', {
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
