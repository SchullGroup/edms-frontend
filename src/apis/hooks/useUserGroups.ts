import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { userGroupsService } from '@/apis/services/userGroups.service';
import type { UserGroupInput } from '@/types/models';
import { useUIStore } from '@/store/useUIStore';

export const userGroupKeys = {
  all: ['user-groups'] as const,
  list: () => [...userGroupKeys.all, 'list'] as const,
  detail: (id: string) => [...userGroupKeys.all, 'detail', id] as const,
};

/** The API's message, or a code-specific one where its wording is too terse. */
export function userGroupErrorMessage(err: any, fallback: string): string {
  const code = err?.response?.data?.code;
  switch (code) {
    case 'USER_GROUP_ALREADY_EXISTS':
      return 'A group with that name already exists.';
    case 'GROUP_ACCESS_DENIED':
      return 'Only the person who created this group, or a global admin, can change it.';
    case 'USER_GROUP_HAS_ACTIVE_TASKS':
      return 'This group still has open tasks. They have to be finished or reassigned before it can be deactivated.';
    case 'GROUP_LAST_ELIGIBLE_MEMBER':
      return 'This is the last member who can act on the group’s open tasks, so they can’t be removed yet.';
    case 'USER_GROUP_INACTIVE':
      return 'This group is inactive. Reactivate it before adding members.';
    case 'INACTIVE_GROUP_MEMBERS':
      return 'Only active users can be added.';
    default:
      return err?.response?.data?.message || fallback;
  }
}

export function useUserGroups(options?: { enabled?: boolean }) {
  return useQuery({
    queryKey: userGroupKeys.list(),
    queryFn: userGroupsService.getAll,
    enabled: options?.enabled ?? true,
  });
}

export function useUserGroup(groupId: string) {
  return useQuery({
    queryKey: userGroupKeys.detail(groupId),
    queryFn: () => userGroupsService.getById(groupId),
    enabled: !!groupId,
  });
}

/** Errors are left to the form, which shows them in place. */
export function useCreateUserGroup() {
  const queryClient = useQueryClient();
  const { addToast } = useUIStore.getState();
  return useMutation({
    mutationFn: (input: UserGroupInput) => userGroupsService.create(input),
    onSuccess: (group) => {
      queryClient.invalidateQueries({ queryKey: userGroupKeys.all });
      addToast(`Group "${group.name}" created`, 'success');
    },
  });
}

/** Errors are left to the caller: the edit form shows them, the confirm toasts them. */
export function useUpdateUserGroup() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      groupId,
      input,
    }: {
      groupId: string;
      input: Partial<UserGroupInput> & { isActive?: boolean };
    }) => userGroupsService.update(groupId, input),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: userGroupKeys.all }),
  });
}

export function useAddUserGroupMembers() {
  const queryClient = useQueryClient();
  const { addToast } = useUIStore.getState();
  return useMutation({
    mutationFn: ({ groupId, userIds }: { groupId: string; userIds: string[] }) =>
      userGroupsService.addMembers(groupId, userIds),
    onSuccess: (_data, { userIds }) => {
      queryClient.invalidateQueries({ queryKey: userGroupKeys.all });
      addToast(
        userIds.length === 1 ? 'Member added' : `${userIds.length} members added`,
        'success',
      );
    },
    onError: (err: any) =>
      addToast(userGroupErrorMessage(err, 'Members could not be added'), 'error'),
  });
}

export function useRemoveUserGroupMember() {
  const queryClient = useQueryClient();
  const { addToast } = useUIStore.getState();
  return useMutation({
    mutationFn: ({ groupId, userId }: { groupId: string; userId: string }) =>
      userGroupsService.removeMember(groupId, userId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: userGroupKeys.all });
      addToast('Member removed', 'info');
    },
    onError: (err: any) =>
      addToast(userGroupErrorMessage(err, 'The member could not be removed'), 'error'),
  });
}
