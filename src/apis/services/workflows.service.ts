import { apiClient } from '@/lib/api-client';
import { WorkflowDefinition, PaginatedResponse, ApiResponse } from '@/types/models';

export const workflowsService = {
  getAll: async (params?: Record<string, any>): Promise<PaginatedResponse<WorkflowDefinition>> => {
    const response = await apiClient.get<PaginatedResponse<WorkflowDefinition>>('/workflows', {
      params,
    });
    return response.data;
  },

  getById: async (id: string): Promise<WorkflowDefinition> => {
    const response = await apiClient.get<ApiResponse<WorkflowDefinition>>(`/workflows/${id}`);
    return response.data.data;
  },

  create: async (data: any): Promise<WorkflowDefinition> => {
    const response = await apiClient.post<ApiResponse<WorkflowDefinition>>('/workflows', data);
    return response.data.data;
  },

  update: async (id: string, updates: Partial<WorkflowDefinition>): Promise<WorkflowDefinition> => {
    const response = await apiClient.patch<ApiResponse<WorkflowDefinition>>(
      `/workflows/${id}`,
      updates,
    );
    return response.data.data;
  },

  publish: async (id: string): Promise<WorkflowDefinition> => {
    const response = await apiClient.post<ApiResponse<WorkflowDefinition>>(
      `/workflows/${id}/publish`,
    );
    return response.data.data;
  },

  archive: async (id: string): Promise<WorkflowDefinition> => {
    const response = await apiClient.post<ApiResponse<WorkflowDefinition>>(
      `/workflows/${id}/archive`,
    );
    return response.data.data;
  },
};
