import { apiClient } from '@/lib/api-client';
import { ApiResponse, PaginatedResponse, WorkflowInstance } from '@/types/models';

export const workflowInstancesService = {
  getAll: async (params?: Record<string, any>): Promise<PaginatedResponse<WorkflowInstance>> => {
    const response = await apiClient.get<PaginatedResponse<WorkflowInstance>>('/workflow-instances', { params });
    return response.data;
  },

  getById: async (id: string): Promise<WorkflowInstance> => {
    const response = await apiClient.get<ApiResponse<WorkflowInstance>>(`/workflow-instances/${id}`);
    return response.data.data;
  },

  start: async (workflowId: string, documentId: string): Promise<WorkflowInstance> => {
    const response = await apiClient.post<ApiResponse<WorkflowInstance>>(`/workflow-instances/start`, { workflowId, documentId });
    return response.data.data;
  },

  hold: async (id: string, reason?: string): Promise<WorkflowInstance> => {
    const response = await apiClient.post<ApiResponse<WorkflowInstance>>(`/workflow-instances/${id}/hold`, { reason });
    return response.data.data;
  },

  resume: async (id: string): Promise<WorkflowInstance> => {
    const response = await apiClient.post<ApiResponse<WorkflowInstance>>(`/workflow-instances/${id}/resume`);
    return response.data.data;
  },

  close: async (id: string): Promise<WorkflowInstance> => {
    const response = await apiClient.post<ApiResponse<WorkflowInstance>>(`/workflow-instances/${id}/close`);
    return response.data.data;
  },
};
