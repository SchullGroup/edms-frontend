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

  // Drafts that were never started only (409 otherwise); 204.
  deleteDraft: async (id: string): Promise<void> => {
    await apiClient.delete(`/workflows/${id}`);
  },

  // A draft copy of the latest published version, numbered v+1 (409 from any other).
  createVersion: async (id: string): Promise<WorkflowDefinition> => {
    const response = await apiClient.post<ApiResponse<WorkflowDefinition>>(
      `/workflows/${id}/versions`,
    );
    return response.data.data;
  },

  // Every version sharing this workflow's `familyId`, newest first.
  getVersions: async (
    id: string,
    params?: { page?: number; limit?: number },
  ): Promise<PaginatedResponse<WorkflowDefinition>> => {
    const response = await apiClient.get<PaginatedResponse<WorkflowDefinition>>(
      `/workflows/${id}/versions`,
      { params },
    );
    return response.data;
  },

  // Back to `published`; 422 if a stage's department has since been deleted.
  unarchive: async (id: string): Promise<WorkflowDefinition> => {
    const response = await apiClient.post<ApiResponse<WorkflowDefinition>>(
      `/workflows/${id}/unarchive`,
    );
    return response.data.data;
  },
};
