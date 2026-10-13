import { useQuery, useMutation, useQueryClient, keepPreviousData } from '@tanstack/react-query';
import { usersService, UserFilters } from '@/apis/services/users.service';
import { User } from '@/types/models';
import { useUIStore } from '@/store/useUIStore';
import { useMyDepartmentId } from '@/hooks/useMyDepartmentId';

// Scope policy (not yet enforced — tracked as part of the internal write/scope
// gating follow-up, see the sidebar permission work): `useUsers`/`useAllUsers`
// are called from ~14 places, most of which are pickers/dropdowns rendering a
// user list inside a page (reassign, delegate, uploader/assignee names, etc.)
// — those only need department-scoped `user:view`. Only the tenant-wide
// directory (`/admin/users`, gated on *global* scope — see useNavigation.ts)
// legitimately needs every user in the tenant. When these hooks gain scope
// awareness, that's the split to apply — not a blanket global requirement.

export const userKeys = {
  all: ['users'] as const,
  lists: () => [...userKeys.all, 'list'] as const,
  list: (filters: UserFilters) => [...userKeys.lists(), filters] as const,
  details: () => [...userKeys.all, 'detail'] as const,
  detail: (id: string) => [...userKeys.details(), id] as const,
  allPages: (filters: Omit<UserFilters, 'page' | 'limit'>) =>
    [...userKeys.all, 'allPages', filters] as const,
};

export function useUsers(filters: UserFilters = {}) {
  return useQuery({
    queryKey: userKeys.list(filters),
    queryFn: () => usersService.getAll(filters),
    // Paging, filtering or searching keeps the current rows up until the next
    // page arrives, rather than dropping back to the loading skeleton.
    placeholderData: keepPreviousData,
  });
}

/**
 * One page of users matching `search` (name or email), for type-ahead pickers.
 * An empty `search` lists the first page. Deliberately no `placeholderData`: a
 * picker must not offer the previous search's people as clickable results for
 * the new one.
 */
export function useUserSearch(
  search: string,
  filters: Omit<UserFilters, 'search' | 'page'> = {},
  options?: { enabled?: boolean },
) {
  const term = search.trim();
  const params: UserFilters = { ...filters, page: 1, ...(term ? { search: term } : {}) };
  return useQuery({
    queryKey: userKeys.list(params),
    queryFn: () => usersService.getAll(params),
    enabled: options?.enabled ?? true,
  });
}

/** Complete roster across all pages — for rollups and assignee pickers, where a
 *  single 20-row page would silently drop people. */
export function useAllUsers(
  filters: Omit<UserFilters, 'page' | 'limit'> = {},
  options?: { enabled?: boolean },
) {
  return useQuery({
    queryKey: userKeys.allPages(filters),
    queryFn: () => usersService.getAllPages(filters),
    enabled: options?.enabled ?? true,
  });
}

/**
 * Active users in the signed-in user's own department — the only valid targets
 * for a reassign (the backend 403s `TASK_REASSIGN_DEPARTMENT_FORBIDDEN` for a
 * department-scoped reassigner picking anyone outside it). The department comes
 * from `/auth/me` (`useMyDepartmentId`). A user with no department gets an
 * empty list, not the whole tenant.
 */
export function useDepartmentColleagues() {
  const { departmentId, known } = useMyDepartmentId();
  const { data, isLoading: isLoadingUsers } = useAllUsers(
    { departmentId: departmentId ?? undefined, status: 'active' },
    { enabled: !!departmentId },
  );

  return {
    users: departmentId ? (data?.items ?? []) : [],
    departmentId,
    isLoading: !known || (!!departmentId && isLoadingUsers),
  };
}

export function useUser(id: string) {
  return useQuery({
    queryKey: userKeys.detail(id),
    queryFn: () => usersService.getById(id),
    enabled: !!id,
  });
}

export function useCreateUser() {
  const queryClient = useQueryClient();
  const { addToast } = useUIStore.getState();

  return useMutation({
    mutationFn: (data: any) => usersService.create(data),
    // `invited`: the backend emailed a set-password link and the user is
    // `pending` until they use it.
    onSuccess: (user: User & { invited?: boolean }) => {
      queryClient.invalidateQueries({ queryKey: userKeys.lists() });
      addToast(
        user?.invited ? `Invitation sent to ${user.email}` : 'User created successfully',
        'success',
      );
    },
    onError: (err: any) => {
      addToast(err.response?.data?.message || 'Failed to create user', 'error');
    },
  });
}

export function useUpdateUser() {
  const queryClient = useQueryClient();
  const { addToast } = useUIStore.getState();

  return useMutation({
    mutationFn: ({ id, updates }: { id: string; updates: Partial<User> }) =>
      usersService.update(id, updates),
    onSuccess: (data, { id }) => {
      queryClient.invalidateQueries({ queryKey: userKeys.detail(id) });
      queryClient.invalidateQueries({ queryKey: userKeys.lists() });
      addToast('User updated successfully', 'success');
    },
    onError: (err: any) => {
      addToast(err.response?.data?.message || 'Failed to update user', 'error');
    },
  });
}

export function useDeleteUser() {
  const queryClient = useQueryClient();
  const { addToast } = useUIStore.getState();

  return useMutation({
    mutationFn: (id: string) => usersService.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: userKeys.lists() });
      addToast('User deleted successfully', 'success');
    },
    onError: (err: any) => {
      addToast(err.response?.data?.message || 'Failed to delete user', 'error');
    },
  });
}

/** `POST /users/:id/roles` — adds the given role ids to a user. */
export function useAssignUserRoles() {
  const queryClient = useQueryClient();
  const { addToast } = useUIStore.getState();

  return useMutation({
    mutationFn: ({ id, roleIds }: { id: string; roleIds: string[] }) =>
      usersService.assignRoles(id, roleIds),
    onSuccess: (_, { id }) => {
      queryClient.invalidateQueries({ queryKey: userKeys.detail(id) });
      queryClient.invalidateQueries({ queryKey: userKeys.lists() });
    },
    onError: (err: any) => {
      addToast(err.response?.data?.message || 'Failed to assign roles', 'error');
    },
  });
}

/** `DELETE /users/:id/roles/:roleId` — removes one role from a user. */
export function useRemoveUserRole() {
  const queryClient = useQueryClient();
  const { addToast } = useUIStore.getState();

  return useMutation({
    mutationFn: ({ id, roleId }: { id: string; roleId: string }) =>
      usersService.removeRole(id, roleId),
    onSuccess: (_, { id }) => {
      queryClient.invalidateQueries({ queryKey: userKeys.detail(id) });
      queryClient.invalidateQueries({ queryKey: userKeys.lists() });
    },
    onError: (err: any) => {
      addToast(err.response?.data?.message || 'Failed to remove role', 'error');
    },
  });
}

/** `POST /users/:id/invitation` — resends the set-password email. */
export function useResendInvitation() {
  const queryClient = useQueryClient();
  const { addToast } = useUIStore.getState();

  return useMutation({
    mutationFn: (id: string) => usersService.resendInvitation(id),
    onSuccess: (data) => {
      // The first emailed invitation also records `invitedAt`.
      queryClient.invalidateQueries({ queryKey: userKeys.lists() });
      addToast(`Invitation resent to ${data.email}`, 'success');
    },
    onError: (err: any) => {
      addToast(err.response?.data?.message || 'Failed to resend invitation', 'error');
    },
  });
}
