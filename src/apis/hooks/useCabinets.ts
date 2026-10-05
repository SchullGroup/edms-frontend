import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { cabinetsService } from '@/apis/services/cabinets.service';
import {
  CreateCabinetRequest,
  CreateMetadataFieldRequest,
  GrantAccessRequest,
  UpdateCabinetRequest,
  UpdateMetadataFieldRequest,
} from '@/types/models';
import { useUIStore } from '@/store/useUIStore';

export const cabinetKeys = {
  all: ['cabinets'] as const,
  lists: () => [...cabinetKeys.all, 'list'] as const,
  list: (params: Record<string, any> = {}) => [...cabinetKeys.lists(), params] as const,
  details: () => [...cabinetKeys.all, 'detail'] as const,
  detail: (id: string) => [...cabinetKeys.details(), id] as const,
  access: (id: string) => [...cabinetKeys.detail(id), 'access'] as const,
};

// GET /cabinets is not paginated (verified against the live backend — no
// `pagination` key in the response), so a single useCabinets() call already
// returns the full set. No useAllCabinets/fetchAllPages needed here.
export function useCabinets(params: Record<string, any> = {}) {
  return useQuery({
    queryKey: cabinetKeys.list(params),
    queryFn: () => cabinetsService.getAll(params),
  });
}

// `metadataFields` (and `access`) are only present on this single-cabinet
// response, not on the GET /cabinets list — verified against the live backend.
export function useCabinet(id: string | undefined) {
  return useQuery({
    queryKey: cabinetKeys.detail(id || ''),
    queryFn: () => cabinetsService.getById(id as string),
    enabled: !!id,
  });
}

export function useCreateCabinet() {
  const queryClient = useQueryClient();
  const { addToast } = useUIStore.getState();

  return useMutation({
    mutationFn: (data: CreateCabinetRequest) => cabinetsService.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: cabinetKeys.lists() });
      addToast('Cabinet created successfully', 'success');
    },
    onError: (err: any) => {
      addToast(err.response?.data?.message || 'Failed to create cabinet', 'error');
    },
  });
}

export function useUpdateCabinet() {
  const queryClient = useQueryClient();
  const { addToast } = useUIStore.getState();

  return useMutation({
    mutationFn: ({ id, updates }: { id: string; updates: UpdateCabinetRequest }) =>
      cabinetsService.update(id, updates),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: cabinetKeys.lists() });
      addToast('Cabinet updated successfully', 'success');
    },
    onError: (err: any) => {
      addToast(err.response?.data?.message || 'Failed to update cabinet', 'error');
    },
  });
}

export function useDeleteCabinet() {
  const queryClient = useQueryClient();
  const { addToast } = useUIStore.getState();

  return useMutation({
    mutationFn: (id: string) => cabinetsService.delete(id),
    onSuccess: (_, id) => {
      queryClient.invalidateQueries({ queryKey: cabinetKeys.lists() });
      queryClient.removeQueries({ queryKey: cabinetKeys.detail(id) });
      addToast('Cabinet deleted successfully', 'success');
    },
    onError: (err: any) => {
      // 409 = cabinet still contains documents/folders.
      addToast(
        err.response?.data?.message ||
          (err.response?.status === 409
            ? 'This cabinet still has documents or folders in it'
            : 'Failed to delete cabinet'),
        'error',
      );
    },
  });
}

export function useAddMetadataField() {
  const queryClient = useQueryClient();
  const { addToast } = useUIStore.getState();

  return useMutation({
    mutationFn: ({
      cabinetId,
      data,
    }: {
      cabinetId: string;
      data: CreateMetadataFieldRequest;
    }) => cabinetsService.addMetadataField(cabinetId, data),
    onSuccess: (_, { cabinetId }) => {
      queryClient.invalidateQueries({ queryKey: cabinetKeys.detail(cabinetId) });
      addToast('Metadata field added', 'success');
    },
    onError: (err: any) => {
      addToast(err.response?.data?.message || 'Failed to add metadata field', 'error');
    },
  });
}

export function useUpdateMetadataField() {
  const queryClient = useQueryClient();
  const { addToast } = useUIStore.getState();

  return useMutation({
    mutationFn: ({
      cabinetId,
      fieldId,
      updates,
    }: {
      cabinetId: string;
      fieldId: string;
      updates: UpdateMetadataFieldRequest;
    }) => cabinetsService.updateMetadataField(cabinetId, fieldId, updates),
    onSuccess: (_, { cabinetId }) => {
      queryClient.invalidateQueries({ queryKey: cabinetKeys.detail(cabinetId) });
      addToast('Metadata field updated', 'success');
    },
    onError: (err: any) => {
      addToast(err.response?.data?.message || 'Failed to update metadata field', 'error');
    },
  });
}

export function useDeleteMetadataField() {
  const queryClient = useQueryClient();
  const { addToast } = useUIStore.getState();

  return useMutation({
    mutationFn: ({ cabinetId, fieldId }: { cabinetId: string; fieldId: string }) =>
      cabinetsService.deleteMetadataField(cabinetId, fieldId),
    onSuccess: (_, { cabinetId }) => {
      queryClient.invalidateQueries({ queryKey: cabinetKeys.detail(cabinetId) });
      addToast('Metadata field removed', 'info');
    },
    onError: (err: any) => {
      addToast(err.response?.data?.message || 'Failed to remove metadata field', 'error');
    },
  });
}

// --- Access grants ---

export function useCabinetAccessGrants(cabinetId: string | undefined) {
  return useQuery({
    queryKey: cabinetKeys.access(cabinetId || ''),
    queryFn: () => cabinetsService.getAccessGrants(cabinetId as string),
    enabled: !!cabinetId,
  });
}

export function useGrantCabinetAccess() {
  const queryClient = useQueryClient();
  const { addToast } = useUIStore.getState();

  return useMutation({
    mutationFn: ({ cabinetId, data }: { cabinetId: string; data: GrantAccessRequest }) =>
      cabinetsService.grantAccess(cabinetId, data),
    onSuccess: (_, { cabinetId }) => {
      queryClient.invalidateQueries({ queryKey: cabinetKeys.access(cabinetId) });
      queryClient.invalidateQueries({ queryKey: cabinetKeys.detail(cabinetId) });
      addToast('Access granted', 'success');
    },
    onError: (err: any) => {
      addToast(err.response?.data?.message || 'Failed to grant access', 'error');
    },
  });
}

export function useRevokeCabinetAccess() {
  const queryClient = useQueryClient();
  const { addToast } = useUIStore.getState();

  return useMutation({
    mutationFn: ({ cabinetId, grantId }: { cabinetId: string; grantId: string }) =>
      cabinetsService.revokeAccess(cabinetId, grantId),
    onSuccess: (_, { cabinetId }) => {
      queryClient.invalidateQueries({ queryKey: cabinetKeys.access(cabinetId) });
      queryClient.invalidateQueries({ queryKey: cabinetKeys.detail(cabinetId) });
      addToast('Access revoked', 'info');
    },
    onError: (err: any) => {
      addToast(err.response?.data?.message || 'Failed to revoke access', 'error');
    },
  });
}
