import { apiClient } from '@/lib/api-client';
import { Role, ApiResponse } from '@/types/models';

export const rolesService = {
  getAll: async (): Promise<Role[]> => {
    const response = await apiClient.get<ApiResponse<Role[]>>('/roles');
    return response.data.data;
  },

  getById: async (id: string): Promise<Role> => {
    const response = await apiClient.get<ApiResponse<Role>>(`/roles/${id}`);
    return response.data.data;
  },

  create: async (data: any): Promise<Role> => {
    const response = await apiClient.post<ApiResponse<Role>>('/roles', data);
    return response.data.data;
  },

  update: async (id: string, updates: Partial<Role>): Promise<Role> => {
    const response = await apiClient.patch<ApiResponse<Role>>(`/roles/${id}`, updates);
    return response.data.data;
  },

  setPermissions: async (id: string, permissions: any[]): Promise<Role> => {
    const response = await apiClient.put<ApiResponse<Role>>(`/roles/${id}/permissions`, {
      permissions,
    });
    return response.data.data;
  },

  delete: async (id: string): Promise<void> => {
    await apiClient.delete(`/roles/${id}`);
  },
};
