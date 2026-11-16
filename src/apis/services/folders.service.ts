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

/** One page of `GET /cabinets/{id}/folders`; `nextCursor` is null on the last page. */
export interface FolderPage {
  folders: Folder[];
  nextCursor: string | null;
}

export interface FolderPageQuery {
  /** `null` = top-level folders; omitted = every level. */
  parentId?: string | null;
  cursor?: string;
  limit?: number;
}

const FOLDER_PAGE_LIMIT = 100; // the API's maximum
const MAX_FOLDER_PAGES = 200; // a safety stop: 20,000 folders

export const foldersService = {
  // --- Cabinet folders ---

  // Paged rows carry no `children` or `_count`. A page can come back short, even empty,
  // with a cursor: the API scans 500 rows per call and drops folders the caller can't see.
  listPage: async (cabinetId: string, query: FolderPageQuery = {}): Promise<FolderPage> => {
    const params: Record<string, string | number> = { limit: query.limit ?? FOLDER_PAGE_LIMIT };
    if (query.cursor) params.cursor = query.cursor;
    if (query.parentId !== undefined) params.parentId = query.parentId ?? 'root';
    const res = await apiClient.get<ApiResponse<FolderPage>>(`/cabinets/${cabinetId}/folders`, {
      params,
    });
    return res.data.data;
  },

  /** Every folder in the cabinet the caller can see, flat, following the cursor to the end. */
  listAllByCabinet: async (cabinetId: string): Promise<Folder[]> => {
    const all: Folder[] = [];
    let cursor: string | undefined;
    for (let i = 0; i < MAX_FOLDER_PAGES; i++) {
      const page = await foldersService.listPage(cabinetId, { cursor });
      all.push(...page.folders);
      if (!page.nextCursor || page.nextCursor === cursor) break;
      cursor = page.nextCursor;
    }
    return all;
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
