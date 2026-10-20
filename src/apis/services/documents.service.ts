import { apiClient } from '@/lib/api-client';
import {
  Document,
  PaginatedResponse,
  ApiResponse,
  DocumentVersion,
  DocumentSummary,
  CheckoutLock,
  DocumentMetadataField,
  DocumentMetadataValueInput,
  CreateVersionRequest,
  UploadDocumentRequest,
  DocumentStatsResponse,
  AccessRequest,
  DocumentAccessKind,
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
  /** Documents in a cabinet belonging to this department (edms-backend PR #51).
   *  Narrows what the caller can already see — scope and clearance still apply. */
  departmentId?: string;
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

  // Since edms-backend PR #51 (live 2026-10-14) `/documents/search` takes the same
  // list filters as `GET /documents` — cabinet, department, folder, status,
  // confidentiality, urgency and type — so a text search can be narrowed like a browse.
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

  /** `POST /documents/batch` — files up to 20 documents in one transaction: all
   *  of them are created, or none are. Returns them in the order sent. */
  createBatch: async (documents: UploadDocumentRequest[]): Promise<Document[]> => {
    const response = await apiClient.post<ApiResponse<Document[]>>('/documents/batch', {
      documents,
    });
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

  // Same document as `GET /documents/:id`, through routes that also check
  // `document:export` / `document:print` and are audited as `document.exported` /
  // `document.printed` (edms-backend `0dab81a`). Call before exporting or printing.
  exportDocument: async (id: string): Promise<Document> => {
    const response = await apiClient.get<ApiResponse<Document>>(`/documents/${id}/export`);
    return response.data.data;
  },

  printDocument: async (id: string): Promise<Document> => {
    const response = await apiClient.get<ApiResponse<Document>>(`/documents/${id}/print`);
    return response.data.data;
  },

  // Audited as `document.summary_viewed`, so callers should poll sparingly.
  getSummary: async (id: string): Promise<DocumentSummary> => {
    const response = await apiClient.get<ApiResponse<DocumentSummary>>(`/documents/${id}/summary`);
    return response.data.data;
  },

  // 202: queues a fresh summary; the returned status is `pending`, the old text kept.
  requestSummary: async (id: string): Promise<DocumentSummary> => {
    const response = await apiClient.post<ApiResponse<DocumentSummary>>(`/documents/${id}/summary`);
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
  // document by id, one request per kind (409 if one of that kind is already
  // pending); grant/deny is client_admin-only. `permission` is required since
  // edms-backend `3014b89` (422 without it).
  requestAccess: async (
    id: string,
    permission: DocumentAccessKind,
    reason?: string,
  ): Promise<AccessRequest> => {
    const response = await apiClient.post<ApiResponse<AccessRequest>>(
      `/documents/${id}/access-requests`,
      reason ? { permission, reason } : { permission },
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
