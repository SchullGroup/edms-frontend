import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { documentsService, DocumentFilters } from '@/apis/services/documents.service';
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
};

export function useDocuments(filters: DocumentFilters = {}) {
  return useQuery({
    queryKey: documentKeys.list(filters),
    queryFn: () => documentsService.getAll(filters),
  });
}

/**
 * INTERIM STOPGAP for pages that need the full document set (management
 * dashboards). Loops every page — see fetchAllPages.ts for why this exists
 * and why it should be replaced once the backend has aggregation endpoints.
 */
export function useAllDocuments(filters: Omit<DocumentFilters, 'page' | 'limit'> = {}) {
  return useQuery({
    queryKey: [...documentKeys.list(filters), 'all'],
    queryFn: () => fetchAllPages(documentsService.getAll, filters),
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

export function useAddDocumentComment() {
  const queryClient = useQueryClient();
  const { addToast } = useUIStore.getState();

  return useMutation({
    mutationFn: ({ id, text }: { id: string; text: string }) =>
      documentsService.addComment(id, text),
    onSuccess: (_, { id }) => {
      queryClient.invalidateQueries({ queryKey: documentKeys.detail(id) });
      addToast('Comment added', 'success');
    },
    onError: (err: any) => {
      addToast(err.response?.data?.message || 'Failed to add comment', 'error');
    },
  });
}

export function useAddDocumentSignature() {
  const queryClient = useQueryClient();
  const { addToast } = useUIStore.getState();

  return useMutation({
    mutationFn: ({
      id,
      fieldName,
      method,
      password,
    }: {
      id: string;
      fieldName: string;
      method?: string;
      password: string;
    }) => documentsService.addSignature(id, { fieldName, method, password }),
    onSuccess: (_, { id }) => {
      queryClient.invalidateQueries({ queryKey: documentKeys.detail(id) });
      addToast('Signature applied successfully', 'success');
    },
    onError: (err: any) => {
      addToast(err.response?.data?.message || 'Failed to apply signature', 'error');
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
