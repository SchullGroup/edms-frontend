import { apiClient } from '@/lib/api-client';
import { ApiResponse, PaginatedResponse, Department } from '@/types/models';

export const departmentsService = {
  getAll: async (params?: Record<string, any>): Promise<PaginatedResponse<Department>> => {
    const res = await apiClient.get<PaginatedResponse<Department>>('/departments', { params });
    return res.data;
  },
  
  getById: async (id: string): Promise<Department> => {
    const res = await apiClient.get<ApiResponse<Department>>(`/departments/${id}`);
    return res.data.data;
  },

  create: async (data: Partial<Department>): Promise<Department> => {
    const res = await apiClient.post<ApiResponse<Department>>('/departments', data);
    return res.data.data;
  },

  update: async (id: string, updates: Partial<Department>): Promise<Department> => {
    const res = await apiClient.patch<ApiResponse<Department>>(`/departments/${id}`, updates);
    return res.data.data;
  },
  
  delete: async (id: string): Promise<void> => {
    await apiClient.delete(`/departments/${id}`);
  }
};
