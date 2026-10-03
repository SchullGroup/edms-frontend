import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { rolesService } from '@/apis/services/roles.service';
import { CreateRoleRequest, Role, UpdateRoleRequest } from '@/types/models';
import { useUIStore } from '@/store/useUIStore';

export const roleKeys = {
  all: ['roles'] as const,
  lists: () => [...roleKeys.all, 'list'] as const,
  details: () => [...roleKeys.all, 'detail'] as const,
  detail: (id: string) => [...roleKeys.details(), id] as const,
};

export function useRoles(options?: { enabled?: boolean }) {
  return useQuery({
    queryKey: roleKeys.lists(),
    queryFn: () => rolesService.getAll(),
    enabled: options?.enabled ?? true,
    // Four admin pages subscribe to this same query. Role definitions rarely
    // change mid-session, so the default 60s staleTime meant almost any
    // navigation between admin pages re-triggered a background refetch —
    // invisible (cached data renders instantly) but visible in the network
    // log. Mutations in useCreateRole/useUpdateRole/useSetRolePermissions/
    // useDeleteRole already invalidate this key on success, so a longer
    // window here doesn't risk showing stale permissions after an edit.
    staleTime: 5 * 60 * 1000,
  });
}

export function useRole(id: string) {
  return useQuery({
    queryKey: roleKeys.detail(id),
    queryFn: () => rolesService.getById(id),
    enabled: !!id,
  });
}

export function useCreateRole() {
  const queryClient = useQueryClient();
  const { addToast } = useUIStore.getState();

  return useMutation({
    mutationFn: (data: CreateRoleRequest) => rolesService.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: roleKeys.lists() });
      addToast('Role created successfully', 'success');
    },
    onError: (err: any) => {
      addToast(err.response?.data?.message || 'Failed to create role', 'error');
    },
  });
}

export function useUpdateRole() {
  const queryClient = useQueryClient();
  const { addToast } = useUIStore.getState();

  return useMutation({
    mutationFn: ({ id, updates }: { id: string; updates: UpdateRoleRequest }) =>
      rolesService.update(id, updates),
    onSuccess: (data, { id }) => {
      queryClient.invalidateQueries({ queryKey: roleKeys.detail(id) });
      queryClient.invalidateQueries({ queryKey: roleKeys.lists() });
      addToast('Role updated successfully', 'success');
    },
    onError: (err: any) => {
      addToast(err.response?.data?.message || 'Failed to update role', 'error');
    },
  });
}

export function useSetRolePermissions() {
  const queryClient = useQueryClient();
  const { addToast } = useUIStore.getState();

  return useMutation({
    mutationFn: ({ id, permissions }: { id: string; permissions: Role['permissions'] }) =>
      rolesService.setPermissions(id, permissions || []),
    onSuccess: (data, { id }) => {
      queryClient.invalidateQueries({ queryKey: roleKeys.detail(id) });
      queryClient.invalidateQueries({ queryKey: roleKeys.lists() });
    },
    onError: (err: any) => {
      addToast(err.response?.data?.message || 'Failed to update role permissions', 'error');
    },
  });
}

export function useDeleteRole() {
  const queryClient = useQueryClient();
  const { addToast } = useUIStore.getState();

  return useMutation({
    mutationFn: (id: string) => rolesService.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: roleKeys.lists() });
      addToast('Role deleted successfully', 'success');
    },
    onError: (err: any) => {
      addToast(err.response?.data?.message || 'Failed to delete role', 'error');
    },
  });
}
