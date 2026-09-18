import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  documentsService,
  DocumentFilters,
  AccessRequestInboxFilters,
} from '@/apis/services/documents.service';
import { CreateVersionRequest, Document, DocumentMetadataValueInput } from '@/types/models';
import { useUIStore } from '@/store/useUIStore';
import { fetchAllPages } from '@/apis/utils/fetchAllPages';

export const documentKeys = {
  all: ['documents'] as const,
  lists: () => [...documentKeys.all, 'list'] as const,
  list: (filters: DocumentFilters) => [...documentKeys.lists(), filters] as const,
  details: () => [...documentKeys.all, 'detail'] as const,
  detail: (id: string) => [...documentKeys.details(), id] as const,
  metadata: (id: string) => [...documentKeys.detail(id), 'metadata'] as const,
  versions: (id: string) => [...documentKeys.detail(id), 'versions'] as const,
  accessRequests: (id: string) => [...documentKeys.detail(id), 'access-requests'] as const,
  comments: (id: string) => [...documentKeys.detail(id), 'comments'] as const,
  signatures: (id: string) => [...documentKeys.detail(id), 'signatures'] as const,
};

export const accessRequestInboxKeys = {
  all: ['access-requests', 'inbox'] as const,
  list: (filters: AccessRequestInboxFilters) => [...accessRequestInboxKeys.all, filters] as const,
};

export function useDocuments(filters: DocumentFilters = {}, options?: { enabled?: boolean }) {
  return useQuery({
    queryKey: documentKeys.list(filters),
    queryFn: () => documentsService.getAll(filters),
    enabled: options?.enabled ?? true,
  });
}

/**
 * INTERIM STOPGAP for pages that need the full document set (management
 * dashboards). Loops every page — see fetchAllPages.ts for why this exists
 * and why it should be replaced once the backend has aggregation endpoints.
 *
 * `enabled` defaults to true so existing unconditional callers are unaffected
 * — pass `false` explicitly for a caller that only wants this scoped to a
 * cabinet/folder once one is selected, rather than walking every document in
 * the tenant while nothing is selected yet.
 */
export function useAllDocuments(
  filters: Omit<DocumentFilters, 'page' | 'limit'> = {},
  options?: { enabled?: boolean },
) {
  return useQuery({
    queryKey: [...documentKeys.list(filters), 'all'],
    queryFn: () => fetchAllPages(documentsService.getAll, filters),
    enabled: options?.enabled ?? true,
  });
}

/**
 * Server-computed document aggregates (`GET /documents/stats`). Best-effort: the
 * endpoint may not be deployed and its shape is unverified, so failures are
 * swallowed (no retry, no error toast) and callers fall back to client-side
 * counts when `data` is undefined.
 */
export function useDocumentStats(params?: Record<string, any>, options?: { enabled?: boolean }) {
  return useQuery({
    queryKey: [...documentKeys.all, 'stats', params ?? {}],
    queryFn: () => documentsService.getStats(params),
    enabled: options?.enabled ?? true,
    retry: false,
    staleTime: 60_000,
  });
}

export function useDocumentSearch(query: string, filters: DocumentFilters = {}) {
  return useQuery({
    queryKey: ['documents', 'search', query, filters],
    queryFn: () => documentsService.search(query, filters),
    enabled: !!query,
  });
}

export function useDocument(id: string) {
  return useQuery({
    queryKey: documentKeys.detail(id),
    queryFn: () => documentsService.getById(id),
    enabled: !!id,
  });
}

export function useDocumentMetadata(id: string) {
  return useQuery({
    queryKey: documentKeys.metadata(id),
    queryFn: () => documentsService.getMetadata(id),
    enabled: !!id,
  });
}

export function useDocumentVersions(id: string) {
  return useQuery({
    queryKey: documentKeys.versions(id),
    queryFn: () => documentsService.getVersions(id),
    enabled: !!id,
  });
}

export function useDocumentVersion(id: string, versionId: string) {
  return useQuery({
    queryKey: [...documentKeys.versions(id), versionId],
    queryFn: () => documentsService.getVersion(id, versionId),
    enabled: !!id && !!versionId,
  });
}

export function useUpdateDocument() {
  const queryClient = useQueryClient();
  const { addToast } = useUIStore.getState();

  return useMutation({
    mutationFn: ({ id, updates }: { id: string; updates: Partial<Document> }) =>
      documentsService.update(id, updates),
    onSuccess: (data, { id }) => {
      queryClient.invalidateQueries({ queryKey: documentKeys.detail(id) });
      queryClient.invalidateQueries({ queryKey: documentKeys.lists() });
    },
    onError: (err: any) => {
      addToast(err.response?.data?.message || 'Failed to update document', 'error');
    },
  });
}

export function useCheckoutDocument() {
  const queryClient = useQueryClient();
  const { addToast } = useUIStore.getState();

  return useMutation({
    mutationFn: ({ id, expectedReturnAt }: { id: string; expectedReturnAt?: string }) =>
      documentsService.checkout(id, expectedReturnAt),
    onSuccess: (data, { id }) => {
      queryClient.invalidateQueries({ queryKey: documentKeys.detail(id) });
      queryClient.invalidateQueries({ queryKey: documentKeys.lists() });
      addToast('Document checked out successfully', 'success');
    },
    onError: (err: any) => {
      addToast(err.response?.data?.message || 'Failed to checkout document', 'error');
    },
  });
}

export function useCheckinDocument() {
  const queryClient = useQueryClient();
  const { addToast } = useUIStore.getState();

  return useMutation({
    mutationFn: (id: string) => documentsService.checkin(id),
    onSuccess: (_, id) => {
      queryClient.invalidateQueries({ queryKey: documentKeys.detail(id) });
      queryClient.invalidateQueries({ queryKey: documentKeys.lists() });
      addToast('Document checked in successfully', 'success');
    },
    onError: (err: any) => {
      addToast(err.response?.data?.message || 'Failed to checkin document', 'error');
    },
  });
}

// Dedicated document-level comments/signatures — independent of the
// workflow-action path `src/app/(app)/doc/[id]/page.tsx` (`actApprove`) uses:
// a `comment` field on `POST /tasks/{taskId}/action`, and a `signature` image
// on its `approve` action. These are a separate thread/record, not a replacement.

export function useDocumentComments(id?: string) {
  return useQuery({
    queryKey: documentKeys.comments(id || ''),
    queryFn: () => documentsService.getComments(id as string),
    enabled: !!id,
  });
}

export function useAddDocumentComment() {
  const queryClient = useQueryClient();
  const { addToast } = useUIStore.getState();

  return useMutation({
    mutationFn: ({ id, content }: { id: string; content: string }) =>
      documentsService.addComment(id, content),
    onSuccess: (_, { id }) => {
      queryClient.invalidateQueries({ queryKey: documentKeys.comments(id) });
    },
    onError: (err: any) => {
      addToast(err.response?.data?.message || 'Failed to post comment', 'error');
    },
  });
}

export function useDocumentSignatures(id?: string) {
  return useQuery({
    queryKey: documentKeys.signatures(id || ''),
    queryFn: () => documentsService.getSignatures(id as string),
    enabled: !!id,
  });
}

export function useAddDocumentSignature() {
  const queryClient = useQueryClient();
  const { addToast } = useUIStore.getState();

  return useMutation({
    mutationFn: ({ id, url }: { id: string; url: string }) =>
      documentsService.addSignature(id, url),
    onSuccess: (_, { id }) => {
      queryClient.invalidateQueries({ queryKey: documentKeys.signatures(id) });
      addToast('Signature added', 'success');
    },
    onError: (err: any) => {
      addToast(err.response?.data?.message || 'Failed to add signature', 'error');
    },
  });
}

/** Any authenticated user may request access to any document by id — 409 if
 *  they already have a pending request on it. */
export function useRequestDocumentAccess() {
  const { addToast } = useUIStore.getState();

  return useMutation({
    mutationFn: ({ id, reason }: { id: string; reason?: string }) =>
      documentsService.requestAccess(id, reason),
    onSuccess: () => {
      addToast('Access request sent', 'success');
    },
    onError: (err: any) => {
      addToast(err.response?.data?.message || 'Failed to send access request', 'error');
    },
  });
}

export function useDocumentAccessRequests(id?: string) {
  return useQuery({
    queryKey: documentKeys.accessRequests(id || ''),
    queryFn: () => documentsService.getAccessRequests(id as string),
    enabled: !!id,
  });
}

/** client_admin-only admin inbox across every document. */
export function useAccessRequestsInbox(filters: AccessRequestInboxFilters = {}) {
  return useQuery({
    queryKey: accessRequestInboxKeys.list(filters),
    queryFn: () => documentsService.getAccessRequestsInbox(filters),
  });
}

export function useGrantAccessRequest() {
  const queryClient = useQueryClient();
  const { addToast } = useUIStore.getState();

  return useMutation({
    mutationFn: ({ id, requestId }: { id: string; requestId: string }) =>
      documentsService.grantAccessRequest(id, requestId),
    onSuccess: (_, { id }) => {
      queryClient.invalidateQueries({ queryKey: documentKeys.accessRequests(id) });
      queryClient.invalidateQueries({ queryKey: accessRequestInboxKeys.all });
      addToast('Access granted', 'success');
    },
    onError: (err: any) => {
      addToast(err.response?.data?.message || 'Failed to grant access', 'error');
    },
  });
}

export function useDenyAccessRequest() {
  const queryClient = useQueryClient();
  const { addToast } = useUIStore.getState();

  return useMutation({
    mutationFn: ({ id, requestId }: { id: string; requestId: string }) =>
      documentsService.denyAccessRequest(id, requestId),
    onSuccess: (_, { id }) => {
      queryClient.invalidateQueries({ queryKey: documentKeys.accessRequests(id) });
      queryClient.invalidateQueries({ queryKey: accessRequestInboxKeys.all });
      addToast('Access request denied', 'info');
    },
    onError: (err: any) => {
      addToast(err.response?.data?.message || 'Failed to deny access request', 'error');
    },
  });
}

export function useArchiveDocument() {
  const queryClient = useQueryClient();
  const { addToast } = useUIStore.getState();

  return useMutation({
    mutationFn: (id: string) => documentsService.archive(id),
    onSuccess: (_, id) => {
      queryClient.invalidateQueries({ queryKey: documentKeys.detail(id) });
      queryClient.invalidateQueries({ queryKey: documentKeys.lists() });
      addToast('Document archived', 'info');
    },
    onError: (err: any) => {
      addToast(err.response?.data?.message || 'Failed to archive document', 'error');
    },
  });
}

export function useUpdateDocumentMetadata() {
  const queryClient = useQueryClient();
  const { addToast } = useUIStore.getState();

  return useMutation({
    mutationFn: ({ id, values }: { id: string; values: DocumentMetadataValueInput[] }) =>
      documentsService.updateMetadata(id, values),
    onSuccess: (_, { id }) => {
      queryClient.invalidateQueries({ queryKey: documentKeys.metadata(id) });
      queryClient.invalidateQueries({ queryKey: documentKeys.detail(id) });
      addToast('Metadata saved', 'success');
    },
    onError: (err: any) => {
      addToast(err.response?.data?.message || 'Failed to save metadata', 'error');
    },
  });
}

export function useAddDocumentVersion() {
  const queryClient = useQueryClient();
  const { addToast } = useUIStore.getState();

  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: CreateVersionRequest }) =>
      documentsService.addVersion(id, data),
    onSuccess: (_, { id }) => {
      queryClient.invalidateQueries({ queryKey: documentKeys.versions(id) });
      queryClient.invalidateQueries({ queryKey: documentKeys.detail(id) });
      addToast('New version uploaded', 'success');
    },
    onError: (err: any) => {
      addToast(err.response?.data?.message || 'Failed to add version', 'error');
    },
  });
}

export function useRestoreDocumentVersion() {
  const queryClient = useQueryClient();
  const { addToast } = useUIStore.getState();

  return useMutation({
    mutationFn: ({ id, versionId }: { id: string; versionId: string }) =>
      documentsService.restoreVersion(id, versionId),
    onSuccess: (_, { id }) => {
      queryClient.invalidateQueries({ queryKey: documentKeys.versions(id) });
      queryClient.invalidateQueries({ queryKey: documentKeys.detail(id) });
      addToast('Version restored', 'success');
    },
    onError: (err: any) => {
      addToast(err.response?.data?.message || 'Failed to restore version', 'error');
    },
  });
}
