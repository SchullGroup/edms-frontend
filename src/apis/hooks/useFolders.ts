import { useQuery, useInfiniteQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { foldersService } from '@/apis/services/folders.service';
import { cabinetKeys } from '@/apis/hooks/useCabinets';
import { documentKeys } from '@/apis/hooks/useDocuments';
import {
  CreateFolderRequest,
  DocumentConfidentiality,
  Folder,
  GrantAccessRequest,
  UpdateFolderRequest,
} from '@/types/models';
import { useUIStore } from '@/store/useUIStore';

export const folderKeys = {
  all: ['folders'] as const,
  byCabinet: (cabinetId: string) => [...folderKeys.all, 'cabinet', cabinetId] as const,
  detail: (id: string) => [...folderKeys.all, 'detail', id] as const,
  access: (id: string) => [...folderKeys.all, 'access', id] as const,
};

/**
 * Every folder mutation also invalidates the cabinet queries: `GET /cabinets`
 * and `GET /cabinets/:id` embed `_count.folders` / `_count.documents`, which
 * the Designer's stats line and delete guard read. Without this, a cabinet
 * kept showing "0 folders" (or refusing deletion) until a full reload.
 */
function invalidateCabinetCounts(queryClient: ReturnType<typeof useQueryClient>) {
  queryClient.invalidateQueries({ queryKey: cabinetKeys.all });
}

/** Query options for every folder in a cabinet; shared so a handler can `fetchQuery` it. */
export const cabinetFoldersQuery = (cabinetId: string) => ({
  queryKey: [...folderKeys.byCabinet(cabinetId), 'all'],
  queryFn: () => foldersService.listAllByCabinet(cabinetId),
});

/** Every visible folder in the cabinet, flat (nest by `parentId`), for pickers and paths.
 *  No `_count` or `children`: the paged endpoint doesn't return them. */
export function useCabinetFolders(cabinetId?: string) {
  return useQuery({
    ...cabinetFoldersQuery(cabinetId ?? ''),
    queryKey: cabinetId ? cabinetFoldersQuery(cabinetId).queryKey : [],
    enabled: !!cabinetId,
  });
}

const FOLDER_BATCH = 50;

/** One level of a cabinet's folders, a batch at a time ("Show more"); `null` = top level. */
export function useFolderLevel(
  cabinetId: string | undefined,
  parentId: string | null,
  options?: { enabled?: boolean },
) {
  return useInfiniteQuery({
    queryKey: [...folderKeys.byCabinet(cabinetId ?? ''), 'level', parentId ?? 'root'],
    queryFn: async ({ pageParam }) => {
      // A batch the visibility filter emptied still has a cursor; skip it so "Show more" adds rows.
      let cursor = pageParam;
      for (;;) {
        const page = await foldersService.listPage(cabinetId!, { parentId, cursor, limit: FOLDER_BATCH });
        if (page.folders.length > 0 || !page.nextCursor || page.nextCursor === cursor) return page;
        cursor = page.nextCursor;
      }
    },
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (last) => last.nextCursor ?? undefined,
    enabled: !!cabinetId && (options?.enabled ?? true),
  });
}

/** The folder and its ancestors, outermost first, walked up through `GET /folders/:id`. */
export function useFolderAncestry(cabinetId?: string, folderId?: string) {
  return useQuery({
    queryKey: [...folderKeys.byCabinet(cabinetId ?? ''), 'ancestry', folderId ?? ''],
    queryFn: async () => {
      const chain: Folder[] = [];
      let id: string | null | undefined = folderId;
      while (id && chain.length < 64 && !chain.some((f) => f.id === id)) {
        const folder: Folder = await foldersService.getById(id);
        chain.unshift(folder);
        id = folder.parentId;
      }
      return chain;
    },
    enabled: !!cabinetId && !!folderId,
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
      invalidateCabinetCounts(queryClient);
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
      invalidateCabinetCounts(queryClient);
      addToast('Folder updated successfully', 'success');
    },
    onError: (err: any) => {
      addToast(err.response?.data?.message || 'Failed to update folder', 'error');
    },
  });
}

// --- Folder access and security settings ---

const apiMessage = (err: any, fallback: string) => err?.response?.data?.message || fallback;

export function useFolderAccessGrants(folderId?: string, options?: { enabled?: boolean }) {
  return useQuery({
    queryKey: folderKeys.access(folderId || ''),
    queryFn: () => foldersService.getAccessGrants(folderId as string),
    enabled: !!folderId && (options?.enabled ?? true),
    // A 403/404 here means "no edit access"; retrying won't change that.
    retry: false,
  });
}

export function useGrantFolderAccess() {
  const queryClient = useQueryClient();
  const { addToast } = useUIStore.getState();

  return useMutation({
    mutationFn: ({ folderId, data }: { folderId: string; data: GrantAccessRequest }) =>
      foldersService.grantAccess(folderId, data),
    onSuccess: (_, { folderId }) => {
      queryClient.invalidateQueries({ queryKey: folderKeys.access(folderId) });
      queryClient.invalidateQueries({ queryKey: documentKeys.all });
    },
    onError: (err: any) => addToast(apiMessage(err, 'Failed to grant folder access'), 'error'),
  });
}

export function useRevokeFolderAccess() {
  const queryClient = useQueryClient();
  const { addToast } = useUIStore.getState();

  return useMutation({
    mutationFn: ({ folderId, grantId }: { folderId: string; grantId: string }) =>
      foldersService.revokeAccess(folderId, grantId),
    onSuccess: (_, { folderId }) => {
      queryClient.invalidateQueries({ queryKey: folderKeys.access(folderId) });
      queryClient.invalidateQueries({ queryKey: documentKeys.all });
      addToast('Access revoked', 'success');
    },
    onError: (err: any) => addToast(apiMessage(err, 'Failed to revoke folder access'), 'error'),
  });
}

/** Tier and inheritance change who sees the folder and its documents, so both refetch. */
function invalidateFolderVisibility(
  queryClient: ReturnType<typeof useQueryClient>,
  folder: Folder,
) {
  queryClient.invalidateQueries({ queryKey: folderKeys.byCabinet(folder.cabinetId) });
  queryClient.invalidateQueries({ queryKey: folderKeys.detail(folder.id) });
  queryClient.invalidateQueries({ queryKey: documentKeys.all });
}

export function useUpdateFolderConfidentiality() {
  const queryClient = useQueryClient();
  const { addToast } = useUIStore.getState();

  return useMutation({
    mutationFn: ({
      id,
      confidentiality,
    }: {
      id: string;
      confidentiality: DocumentConfidentiality | null;
    }) => foldersService.updateConfidentiality(id, confidentiality),
    onSuccess: (folder) => {
      invalidateFolderVisibility(queryClient, folder);
      addToast('Folder confidentiality updated', 'success');
    },
    onError: (err: any) => addToast(apiMessage(err, 'Failed to update confidentiality'), 'error'),
  });
}

export function useUpdateFolderInheritance() {
  const queryClient = useQueryClient();
  const { addToast } = useUIStore.getState();

  return useMutation({
    mutationFn: ({ id, inheritsPermissions }: { id: string; inheritsPermissions: boolean }) =>
      foldersService.updateInheritance(id, inheritsPermissions),
    onSuccess: (folder) => {
      invalidateFolderVisibility(queryClient, folder);
      addToast(
        folder.inheritsPermissions
          ? 'Folder now inherits the cabinet’s access'
          : 'Folder now uses its own access list',
        'success',
      );
    },
    onError: (err: any) => addToast(apiMessage(err, 'Failed to update inheritance'), 'error'),
  });
}

export function useDeleteFolder() {
  const queryClient = useQueryClient();
  const { addToast } = useUIStore.getState();

  return useMutation({
    mutationFn: ({ id }: { id: string; cabinetId: string }) => foldersService.delete(id),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: folderKeys.byCabinet(variables.cabinetId) });
      invalidateCabinetCounts(queryClient);
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
