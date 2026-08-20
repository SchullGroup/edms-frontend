import { apiClient } from '@/lib/api-client';
import {
  Document,
  PaginatedResponse,
  ApiResponse,
  DocumentVersion,
  CheckoutLock,
  DocumentMetadataField,
} from '@/types/models';

export interface DocumentFilters {
  cabinetId?: string;
  folderId?: string;
  status?: 'pending' | 'in_progress' | 'on_hold' | 'closed';
  confidentiality?: 'public' | 'internal' | 'confidential' | 'restricted';
  urgency?: 'low' | 'normal' | 'high' | 'critical';
  documentType?: string;
  createdBy?: string;
  assignee?: string;
  includeArchived?: 'true' | 'false';
  page?: number;
  limit?: number;
}

export const documentsService = {
  // Core Document Endpoints
  getAll: async (params?: DocumentFilters): Promise<PaginatedResponse<Document>> => {
    const res = await apiClient.get<PaginatedResponse<Document>>('/documents', { params });
    return res.data;
  },

  search: async (
    query: string,
    params?: Omit<DocumentFilters, 'page' | 'limit'> & { page?: number; limit?: number },
  ): Promise<PaginatedResponse<Document>> => {
    const res = await apiClient.get<PaginatedResponse<Document>>('/documents/search', {
      params: { q: query, ...params },
    });
    return res.data;
  },

  getById: async (id: string): Promise<Document> => {
    const response = await apiClient.get<ApiResponse<Document>>(`/documents/${id}`);
    return response.data.data;
  },

  create: async (data: any): Promise<Document> => {
    const response = await apiClient.post<ApiResponse<Document>>('/documents', data);
    return response.data.data;
  },

  update: async (id: string, updates: Partial<Document>): Promise<Document> => {
    const response = await apiClient.patch<ApiResponse<Document>>(`/documents/${id}`, updates);
    return response.data.data;
  },

  // Check-in / Check-out Flow
  checkout: async (id: string, expectedReturnAt?: string): Promise<CheckoutLock> => {
    const response = await apiClient.post<ApiResponse<CheckoutLock>>(`/documents/${id}/checkout`, {
      expectedReturnAt,
    });
    return response.data.data;
  },

  checkin: async (id: string): Promise<void> => {
    await apiClient.post(`/documents/${id}/checkin`);
  },

  // Metadata Management
  getMetadata: async (id: string): Promise<DocumentMetadataField[]> => {
    const response = await apiClient.get<ApiResponse<DocumentMetadataField[]>>(
      `/documents/${id}/metadata`,
    );
    return response.data.data;
  },

  updateMetadata: async (
    id: string,
    fields: DocumentMetadataField[],
  ): Promise<DocumentMetadataField[]> => {
    const response = await apiClient.put<ApiResponse<DocumentMetadataField[]>>(
      `/documents/${id}/metadata`,
      { fields },
    );
    return response.data.data;
  },

  // Version Control
  getVersions: async (id: string): Promise<DocumentVersion[]> => {
    const response = await apiClient.get<ApiResponse<DocumentVersion[]>>(
      `/documents/${id}/versions`,
    );
    return response.data.data;
  },

  getVersion: async (id: string, versionId: string): Promise<DocumentVersion> => {
    const response = await apiClient.get<ApiResponse<DocumentVersion>>(
      `/documents/${id}/versions/${versionId}`,
    );
    return response.data.data;
  },

  restoreVersion: async (id: string, versionId: string): Promise<DocumentVersion> => {
    const response = await apiClient.post<ApiResponse<DocumentVersion>>(
      `/documents/${id}/versions/${versionId}/restore`,
    );
    return response.data.data;
  },

  // Comments & Signatures
  addComment: async (id: string, text: string): Promise<any> => {
    const response = await apiClient.post<ApiResponse<any>>(`/documents/${id}/comments`, { text });
    return response.data.data;
  },

  addSignature: async (
    id: string,
    data: { fieldName: string; method?: string; password: string },
  ): Promise<any> => {
    const response = await apiClient.post<ApiResponse<any>>(`/documents/${id}/signatures`, data);
    return response.data.data;
  },
};
