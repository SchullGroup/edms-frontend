import { apiClient } from '@/lib/api-client';
import { User, PaginatedResponse, ApiResponse } from '@/types/models';

export interface UserFilters {
  departmentId?: string;
  status?: 'active' | 'inactive' | 'suspended';
  page?: number;
  limit?: number;
}

export const usersService = {
  getAll: async (params?: UserFilters): Promise<PaginatedResponse<User>> => {
    const res = await apiClient.get<PaginatedResponse<User>>('/users', { params });
    return res.data;
  },

  getById: async (id: string): Promise<User> => {
    const response = await apiClient.get<ApiResponse<User>>(`/users/${id}`);
    return response.data.data;
  },

  create: async (data: any): Promise<User> => {
    const response = await apiClient.post<ApiResponse<User>>('/users', data);
    return response.data.data;
  },

  update: async (id: string, updates: Partial<User>): Promise<User> => {
    const response = await apiClient.patch<ApiResponse<User>>(`/users/${id}`, updates);
    return response.data.data;
  },

  delete: async (id: string): Promise<User> => {
    const response = await apiClient.delete<ApiResponse<User>>(`/users/${id}`);
    return response.data.data;
  },

  assignRoles: async (id: string, roleIds: string[]): Promise<User> => {
    const response = await apiClient.post<ApiResponse<User>>(`/users/${id}/roles`, { roleIds });
    return response.data.data;
  },

  removeRole: async (id: string, roleId: string): Promise<void> => {
    await apiClient.delete(`/users/${id}/roles/${roleId}`);
  },
};
