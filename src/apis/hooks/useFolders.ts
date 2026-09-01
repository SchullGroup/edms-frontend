import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { foldersService } from '@/apis/services/folders.service';
import { CreateFolderRequest, UpdateFolderRequest } from '@/types/models';
import { useUIStore } from '@/store/useUIStore';

export const folderKeys = {
  all: ['folders'] as const,
  byCabinet: (cabinetId: string) => [...folderKeys.all, 'cabinet', cabinetId] as const,
  detail: (id: string) => [...folderKeys.all, 'detail', id] as const,
};

export function useCabinetFolders(cabinetId?: string) {
  return useQuery({
    queryKey: cabinetId ? folderKeys.byCabinet(cabinetId) : [],
    queryFn: () => foldersService.listByCabinet(cabinetId!),
    enabled: !!cabinetId,
  });
}

export function useFolder(id?: string) {
  return useQuery({
    queryKey: folderKeys.detail(id || ''),
    queryFn: () => foldersService.getById(id as string),
    enabled: !!id,
  });
}

export function useCreateFolder() {
  const queryClient = useQueryClient();
  const { addToast } = useUIStore.getState();

  return useMutation({
    mutationFn: ({ cabinetId, data }: { cabinetId: string; data: CreateFolderRequest }) =>
      foldersService.create(cabinetId, data),
    onSuccess: (data, variables) => {
      queryClient.invalidateQueries({ queryKey: folderKeys.byCabinet(variables.cabinetId) });
      addToast('Folder created successfully', 'success');
    },
    onError: (err: any) => {
      addToast(err.response?.data?.message || 'Failed to create folder', 'error');
    },
  });
}

export function useUpdateFolder() {
  const queryClient = useQueryClient();
  const { addToast } = useUIStore.getState();

  return useMutation({
    mutationFn: ({ id, updates }: { id: string; updates: UpdateFolderRequest }) =>
      foldersService.update(id, updates),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: folderKeys.byCabinet(data.cabinetId) });
      queryClient.invalidateQueries({ queryKey: folderKeys.detail(data.id) });
      addToast('Folder updated successfully', 'success');
    },
    onError: (err: any) => {
      addToast(err.response?.data?.message || 'Failed to update folder', 'error');
    },
  });
}

export function useDeleteFolder() {
  const queryClient = useQueryClient();
  const { addToast } = useUIStore.getState();

  return useMutation({
    mutationFn: ({ id }: { id: string; cabinetId: string }) => foldersService.delete(id),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: folderKeys.byCabinet(variables.cabinetId) });
      addToast('Folder deleted successfully', 'success');
    },
    onError: (err: any) => {
      // 409 = the folder still contains documents.
      addToast(
        err.response?.data?.message ||
          (err.response?.status === 409
            ? 'This folder still contains documents'
            : 'Failed to delete folder'),
        'error',
      );
    },
  });
}
