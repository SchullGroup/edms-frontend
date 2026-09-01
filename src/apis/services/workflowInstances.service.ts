import { apiClient } from '@/lib/api-client';
import {
  ApiResponse,
  CreateWorkflowInstanceRequest,
  PaginatedResponse,
  WorkflowInstance,
  WorkflowInstanceStatsResponse,
} from '@/types/models';

export interface WorkflowInstanceFilters {
  page?: number;
  limit?: number;
  status?: 'pending' | 'in_progress' | 'on_hold' | 'closed';
  documentId?: string;
  workflowDefinitionId?: string;
}

export interface WorkflowInstanceStatsParams {
  groupBy?: 'month';
  status?: 'closed';
  departmentId?: string;
}

export const workflowInstancesService = {
  getAll: async (
    params?: WorkflowInstanceFilters,
  ): Promise<PaginatedResponse<WorkflowInstance>> => {
    const response = await apiClient.get<PaginatedResponse<WorkflowInstance>>(
      '/workflow-instances',
      { params },
    );
    return response.data;
  },

  getById: async (id: string): Promise<WorkflowInstance> => {
    const response = await apiClient.get<ApiResponse<WorkflowInstance>>(
      `/workflow-instances/${id}`,
    );
    return response.data.data;
  },

  getStats: async (
    params?: WorkflowInstanceStatsParams,
  ): Promise<WorkflowInstanceStatsResponse> => {
    const response = await apiClient.get<ApiResponse<WorkflowInstanceStatsResponse>>(
      '/workflow-instances/stats',
      { params },
    );
    return response.data.data;
  },

  // Creates a pending instance. Call `start()` afterwards to kick off the first stage.
  create: async (data: CreateWorkflowInstanceRequest): Promise<WorkflowInstance> => {
    const response = await apiClient.post<ApiResponse<WorkflowInstance>>(
      '/workflow-instances',
      data,
    );
    return response.data.data;
  },

  start: async (instanceId: string): Promise<WorkflowInstance> => {
    const response = await apiClient.post<ApiResponse<WorkflowInstance>>(
      `/workflow-instances/${instanceId}/start`,
    );
    return response.data.data;
  },

  /** Convenience: `POST /workflow-instances` then `POST /workflow-instances/{id}/start`. */
  createAndStart: async (
    workflowDefinitionId: string,
    documentId: string,
  ): Promise<WorkflowInstance> => {
    const instance = await workflowInstancesService.create({ workflowDefinitionId, documentId });
    return workflowInstancesService.start(instance.id);
  },

  // `hold` / `resume` / `close` take no request body per the spec.
  hold: async (id: string): Promise<WorkflowInstance> => {
    const response = await apiClient.post<ApiResponse<WorkflowInstance>>(
      `/workflow-instances/${id}/hold`,
    );
    return response.data.data;
  },

  resume: async (id: string): Promise<WorkflowInstance> => {
    const response = await apiClient.post<ApiResponse<WorkflowInstance>>(
      `/workflow-instances/${id}/resume`,
    );
    return response.data.data;
  },

  close: async (id: string): Promise<WorkflowInstance> => {
    const response = await apiClient.post<ApiResponse<WorkflowInstance>>(
      `/workflow-instances/${id}/close`,
    );
    return response.data.data;
  },
};
