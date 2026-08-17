import { apiClient } from '@/lib/api-client';
import { ApiResponse, PaginatedResponse, Task, TaskActionRequest } from '@/types/models';

export const tasksService = {
  getAll: async (params?: Record<string, any>): Promise<PaginatedResponse<Task>> => {
    const response = await apiClient.get<PaginatedResponse<Task>>('/tasks', { params });
    return response.data;
  },

  getById: async (id: string): Promise<Task> => {
    const response = await apiClient.get<ApiResponse<Task>>(`/tasks/${id}`);
    return response.data.data;
  },

  action: async (id: string, actionReq: TaskActionRequest): Promise<void> => {
    await apiClient.post(`/tasks/${id}/action`, actionReq);
  },

  reassign: async (id: string, assigneeId: string): Promise<Task> => {
    const response = await apiClient.post<ApiResponse<Task>>(`/tasks/${id}/reassign`, { assigneeId });
    return response.data.data;
  },
};
