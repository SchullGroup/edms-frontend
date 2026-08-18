import { apiClient } from '@/lib/api-client';
import { ApiResponse, PaginatedResponse, CabinetFolder } from '@/types/models';

export const foldersService = {
  // Cabinet Folders
  listByCabinet: async (
    cabinetId: string,
    params?: Record<string, any>,
  ): Promise<PaginatedResponse<CabinetFolder>> => {
    const res = await apiClient.get<PaginatedResponse<CabinetFolder>>(
      `/cabinets/${cabinetId}/folders`,
      { params },
    );
    return res.data;
  },

  create: async (cabinetId: string, data: Partial<CabinetFolder>): Promise<CabinetFolder> => {
    const res = await apiClient.post<ApiResponse<CabinetFolder>>(
      `/cabinets/${cabinetId}/folders`,
      data,
    );
    return res.data.data;
  },

  // Global Folders
  getById: async (id: string): Promise<CabinetFolder> => {
    const res = await apiClient.get<ApiResponse<CabinetFolder>>(`/folders/${id}`);
    return res.data.data;
  },

  update: async (id: string, updates: Partial<CabinetFolder>): Promise<CabinetFolder> => {
    const res = await apiClient.patch<ApiResponse<CabinetFolder>>(`/folders/${id}`, updates);
    return res.data.data;
  },

  delete: async (id: string): Promise<void> => {
    await apiClient.delete(`/folders/${id}`);
  },
};
