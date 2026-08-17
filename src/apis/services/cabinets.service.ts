import { apiClient } from '@/lib/api-client';
import { Cabinet, PaginatedResponse, ApiResponse } from '@/types/models';

export const cabinetsService = {
  getAll: async (params?: Record<string, any>): Promise<PaginatedResponse<Cabinet>> => {
    const res = await apiClient.get<PaginatedResponse<Cabinet>>('/cabinets', { params });
    return res.data;
  },
  
  getById: async (id: string): Promise<Cabinet> => {
    const res = await apiClient.get<ApiResponse<Cabinet>>(`/cabinets/${id}`);
    return res.data.data;
  },

  create: async (data: any): Promise<Cabinet> => {
    const res = await apiClient.post<ApiResponse<Cabinet>>('/cabinets', data);
    return res.data.data;
  },

  update: async (id: string, updates: Partial<Cabinet>): Promise<Cabinet> => {
    const res = await apiClient.patch<ApiResponse<Cabinet>>(`/cabinets/${id}`, updates);
    return res.data.data;
  },
  
  delete: async (id: string): Promise<void> => {
    await apiClient.delete(`/cabinets/${id}`);
  }
};
