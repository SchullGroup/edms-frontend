import { apiClient } from '@/lib/api-client';
import {
  Document,
  PaginatedResponse,
  ApiResponse,
  DocumentVersion,
  CheckoutLock,
  DocumentMetadataField,
  DocumentMetadataValueInput,
  CreateVersionRequest,
  UploadDocumentRequest,
  DocumentStatsResponse,
  AccessRequest,
} from '@/types/models';

export interface AccessRequestInboxFilters {
  status?: 'pending' | 'approved' | 'denied';
  page?: number;
  limit?: number;
}

export interface DocumentStatsParams {
  groupBy?: 'month' | 'department';
  /** Only applied when `groupBy=month`. */
  departmentId?: string;
  from?: string;
  to?: string;
}

export interface DocumentFilters {
  cabinetId?: string;
  folderId?: string;
  status?: 'pending' | 'in_progress' | 'on_hold' | 'closed';
  confidentiality?: 'public' | 'internal' | 'confidential' | 'restricted' | 'top_secret';
  urgency?: 'low' | 'normal' | 'high' | 'critical';
  documentType?: string;
  createdBy?: string;
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

  // Spec supports `q`, `cabinetId`, `page`, `limit`; kept permissive for call sites
  // that pass a wider `DocumentFilters` object.
  search: async (
    query: string,
    params?: DocumentFilters,
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

  // Server-side count aggregates for the management dashboards — see
  // `DocumentStatsResponse` for the (verified) shape.
  getStats: async (params?: DocumentStatsParams): Promise<DocumentStatsResponse> => {
    const response = await apiClient.get<ApiResponse<DocumentStatsResponse>>('/documents/stats', {
      params,
    });
    return response.data.data;
  },

  // Registers a document whose file is already in storage (S3). See `UploadDocumentRequest`
  // for the documented shape; kept loose because the upload page passes string-typed enums.
  create: async (data: UploadDocumentRequest | Record<string, any>): Promise<Document> => {
    const response = await apiClient.post<ApiResponse<Document>>('/documents', data);
    return response.data.data;
  },

  // Documented fields: `title`, `documentType`, `folderId`, `confidentiality`, `urgency`,
  // `status` (see `UpdateDocumentRequest`). Kept as `Partial<Document>` for existing callers.
  update: async (id: string, updates: Partial<Document>): Promise<Document> => {
    const response = await apiClient.patch<ApiResponse<Document>>(`/documents/${id}`, updates);
    return response.data.data;
  },

  // Soft-archive — `DELETE /documents/{id}` sets `archivedAt`.
  archive: async (id: string): Promise<Document> => {
    const response = await apiClient.delete<ApiResponse<Document>>(`/documents/${id}`);
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

  // `PUT /documents/{id}/metadata` takes a raw array of `{ fieldId, value }`.
  updateMetadata: async (
    id: string,
    values: DocumentMetadataValueInput[],
  ): Promise<DocumentMetadataField[]> => {
    const response = await apiClient.put<ApiResponse<DocumentMetadataField[]>>(
      `/documents/${id}/metadata`,
      values,
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

  // Registers a new version whose file is already in storage, and makes it current.
  addVersion: async (id: string, data: CreateVersionRequest): Promise<DocumentVersion> => {
    const response = await apiClient.post<ApiResponse<DocumentVersion>>(
      `/documents/${id}/versions`,
      data,
    );
    return response.data.data;
  },

  restoreVersion: async (id: string, versionId: string): Promise<DocumentVersion> => {
    const response = await apiClient.post<ApiResponse<DocumentVersion>>(
      `/documents/${id}/versions/${versionId}/restore`,
    );
    return response.data.data;
  },

  // Access requests — any authenticated user may request access to any
  // document by id (409 if they already have a pending request on it);
  // grant/deny is client_admin-only. Verified live 2026-09-18.
  requestAccess: async (id: string, reason?: string): Promise<AccessRequest> => {
    const response = await apiClient.post<ApiResponse<AccessRequest>>(
      `/documents/${id}/access-requests`,
      reason ? { reason } : {},
    );
    return response.data.data;
  },

  getAccessRequests: async (id: string): Promise<AccessRequest[]> => {
    const response = await apiClient.get<ApiResponse<AccessRequest[]>>(
      `/documents/${id}/access-requests`,
    );
    return response.data.data;
  },

  grantAccessRequest: async (id: string, requestId: string): Promise<AccessRequest> => {
    const response = await apiClient.post<ApiResponse<AccessRequest>>(
      `/documents/${id}/access-requests/${requestId}/grant`,
    );
    return response.data.data;
  },

  denyAccessRequest: async (id: string, requestId: string): Promise<AccessRequest> => {
    const response = await apiClient.post<ApiResponse<AccessRequest>>(
      `/documents/${id}/access-requests/${requestId}/deny`,
    );
    return response.data.data;
  },

  /** `GET /documents/access-requests` — client_admin-only admin inbox across
   *  every document, newest first. */
  getAccessRequestsInbox: async (
    filters?: AccessRequestInboxFilters,
  ): Promise<PaginatedResponse<AccessRequest>> => {
    const response = await apiClient.get<PaginatedResponse<AccessRequest>>(
      '/documents/access-requests',
      { params: filters },
    );
    return response.data;
  },
};
