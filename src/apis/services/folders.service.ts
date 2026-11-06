import { apiClient } from '@/lib/api-client';
import {
  ApiResponse,
  CreateFolderRequest,
  DocumentConfidentiality,
  Folder,
  FolderAccessGrant,
  GrantAccessRequest,
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

  // --- Folder access (needs `folder:edit` plus `edit` on the folder) ---

  getAccessGrants: async (id: string): Promise<FolderAccessGrant[]> => {
    const res = await apiClient.get<ApiResponse<FolderAccessGrant[]>>(`/folders/${id}/access`);
    return res.data.data;
  },

  // Exactly one of `roleId` / `userId`. Non-admins: no self, held role, or above own level.
  grantAccess: async (id: string, data: GrantAccessRequest): Promise<FolderAccessGrant> => {
    const res = await apiClient.post<ApiResponse<FolderAccessGrant>>(`/folders/${id}/access`, data);
    return res.data.data;
  },

  revokeAccess: async (id: string, grantId: string): Promise<void> => {
    await apiClient.delete(`/folders/${id}/access/${grantId}`);
  },

  // client_admin only (403 otherwise). `null` clears the folder's own tier.
  updateConfidentiality: async (
    id: string,
    confidentiality: DocumentConfidentiality | null,
  ): Promise<Folder> => {
    const res = await apiClient.patch<ApiResponse<Folder>>(`/folders/${id}/confidentiality`, {
      confidentiality,
    });
    return res.data.data;
  },

  // client_admin only (403 otherwise).
  updateInheritance: async (id: string, inheritsPermissions: boolean): Promise<Folder> => {
    const res = await apiClient.patch<ApiResponse<Folder>>(`/folders/${id}/inheritance`, {
      inheritsPermissions,
    });
    return res.data.data;
  },
};
