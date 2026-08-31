import { apiClient } from '@/lib/api-client';
import {
  Cabinet,
  CabinetAccessGrant,
  CabinetMetadataField,
  CreateCabinetRequest,
  CreateMetadataFieldRequest,
  GrantAccessRequest,
  UpdateCabinetRequest,
  UpdateMetadataFieldRequest,
  ApiResponse,
} from '@/types/models';

export const cabinetsService = {
  // `GET /cabinets` is not paginated (no `pagination` key on the live response).
  getAll: async (params?: Record<string, any>): Promise<ApiResponse<Cabinet[]>> => {
    const res = await apiClient.get<ApiResponse<Cabinet[]>>('/cabinets', { params });
    return res.data;
  },

  getById: async (id: string): Promise<Cabinet> => {
    const res = await apiClient.get<ApiResponse<Cabinet>>(`/cabinets/${id}`);
    return res.data.data;
  },

  create: async (data: CreateCabinetRequest): Promise<Cabinet> => {
    const res = await apiClient.post<ApiResponse<Cabinet>>('/cabinets', data);
    return res.data.data;
  },

  update: async (id: string, updates: UpdateCabinetRequest): Promise<Cabinet> => {
    const res = await apiClient.patch<ApiResponse<Cabinet>>(`/cabinets/${id}`, updates);
    return res.data.data;
  },

  // 409 "Cabinet contains documents" if it is not empty.
  delete: async (id: string): Promise<void> => {
    await apiClient.delete(`/cabinets/${id}`);
  },

  // --- Metadata fields ---

  addMetadataField: async (
    cabinetId: string,
    data: CreateMetadataFieldRequest,
  ): Promise<CabinetMetadataField> => {
    const res = await apiClient.post<ApiResponse<CabinetMetadataField>>(
      `/cabinets/${cabinetId}/metadata-fields`,
      data,
    );
    return res.data.data;
  },

  updateMetadataField: async (
    cabinetId: string,
    fieldId: string,
    updates: UpdateMetadataFieldRequest,
  ): Promise<CabinetMetadataField> => {
    const res = await apiClient.patch<ApiResponse<CabinetMetadataField>>(
      `/cabinets/${cabinetId}/metadata-fields/${fieldId}`,
      updates,
    );
    return res.data.data;
  },

  deleteMetadataField: async (cabinetId: string, fieldId: string): Promise<void> => {
    await apiClient.delete(`/cabinets/${cabinetId}/metadata-fields/${fieldId}`);
  },

  // --- Access grants ---

  getAccessGrants: async (cabinetId: string): Promise<CabinetAccessGrant[]> => {
    const res = await apiClient.get<ApiResponse<CabinetAccessGrant[]>>(
      `/cabinets/${cabinetId}/access`,
    );
    return res.data.data;
  },

  // Exactly one of `roleId` / `userId` must be set (422 otherwise).
  grantAccess: async (
    cabinetId: string,
    data: GrantAccessRequest,
  ): Promise<CabinetAccessGrant> => {
    const res = await apiClient.post<ApiResponse<CabinetAccessGrant>>(
      `/cabinets/${cabinetId}/access`,
      data,
    );
    return res.data.data;
  },

  revokeAccess: async (cabinetId: string, grantId: string): Promise<void> => {
    await apiClient.delete(`/cabinets/${cabinetId}/access/${grantId}`);
  },
};
