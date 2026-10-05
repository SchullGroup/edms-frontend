import { apiClient } from '@/lib/api-client';
import {
  ApiResponse,
  CreateFolderRequest,
  Folder,
  UpdateFolderRequest,
} from '@/types/models';

export const foldersService = {
  // --- Cabinet folders ---

  // `GET /cabinets/{id}/folders` returns `{ success, data: Folder[] }` — not paginated.
  // Returns the wrapper (callers read `.data`) to stay consistent with the other
  // list services (`cabinetsService.getAll`, `departmentsService.getAll`).
  listByCabinet: async (cabinetId: string): Promise<ApiResponse<Folder[]>> => {
    const res = await apiClient.get<ApiResponse<Folder[]>>(`/cabinets/${cabinetId}/folders`);
    return res.data;
  },

  create: async (cabinetId: string, data: CreateFolderRequest): Promise<Folder> => {
    const res = await apiClient.post<ApiResponse<Folder>>(
      `/cabinets/${cabinetId}/folders`,
      data,
    );
    return res.data.data;
  },

  // --- Global folder endpoints ---

  getById: async (id: string): Promise<Folder> => {
    const res = await apiClient.get<ApiResponse<Folder>>(`/folders/${id}`);
    return res.data.data;
  },

  update: async (id: string, updates: UpdateFolderRequest): Promise<Folder> => {
    const res = await apiClient.patch<ApiResponse<Folder>>(`/folders/${id}`, updates);
    return res.data.data;
  },

  // 409 if the folder still contains documents.
  delete: async (id: string): Promise<void> => {
    await apiClient.delete(`/folders/${id}`);
  },
};
