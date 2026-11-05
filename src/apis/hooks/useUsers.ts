import {
  useQuery,
  useQueries,
  useMutation,
  useQueryClient,
  keepPreviousData,
} from '@tanstack/react-query';
import { usersService, UserFilters } from '@/apis/services/users.service';
import { User } from '@/types/models';
import { useUIStore } from '@/store/useUIStore';

// Pickers search `GET /users?search=` (UserPicker, UserSearchCombobox); nothing
// here walks every page of users.

export const userKeys = {
  all: ['users'] as const,
  lists: () => [...userKeys.all, 'list'] as const,
  list: (filters: UserFilters) => [...userKeys.lists(), filters] as const,
  details: () => [...userKeys.all, 'detail'] as const,
  detail: (id: string) => [...userKeys.details(), id] as const,
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

/** A few known users by id, one cached `GET /users/:id` each, e.g. names for saved ids. */
export function useUsersByIds(ids: string[]) {
  const unique = Array.from(new Set(ids.filter(Boolean)));
  const results = useQueries({
    queries: unique.map((id) => ({
      queryKey: userKeys.detail(id),
      queryFn: () => usersService.getById(id),
      retry: false,
    })),
  });
  const users = new Map<string, User>();
  results.forEach((r) => r.data && users.set(r.data.id, r.data));
  return { users, loading: results.some((r) => r.isLoading) };
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
