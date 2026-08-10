import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { documentsService, DocumentFilters } from '@/services/documents.service';
import { Document, CheckoutLock, DocumentMetadataField } from '@/types/models';
import { useUIStore } from '@/store/useUIStore';

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
