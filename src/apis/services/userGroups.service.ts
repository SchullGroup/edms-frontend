import { apiClient } from '@/lib/api-client';
import { ApiResponse, UserGroup, UserGroupDetail, UserGroupInput } from '@/types/models';

/** `/user-groups`: read with `workflow:view`, change with `workflow:create` (creator-only
 *  below global scope, 403 `GROUP_ACCESS_DENIED`). There is no delete. */
export const userGroupsService = {
  getAll: async (): Promise<UserGroup[]> => {
    const res = await apiClient.get<ApiResponse<UserGroup[]>>('/user-groups');
    return res.data.data;
  },

  getById: async (groupId: string): Promise<UserGroupDetail> => {
    const res = await apiClient.get<ApiResponse<UserGroupDetail>>(`/user-groups/${groupId}`);
    return res.data.data;
  },

  /** 409 `USER_GROUP_ALREADY_EXISTS` on a taken name. */
  create: async (input: UserGroupInput): Promise<UserGroup> => {
    const res = await apiClient.post<ApiResponse<UserGroup>>('/user-groups', input);
    return res.data.data;
  },

  /** 409 `USER_GROUP_HAS_ACTIVE_TASKS` when deactivating a group with open tasks. */
  update: async (
    groupId: string,
    input: Partial<UserGroupInput> & { isActive?: boolean },
  ): Promise<UserGroup> => {
    const res = await apiClient.patch<ApiResponse<UserGroup>>(`/user-groups/${groupId}`, input);
    return res.data.data;
  },

  /** 1–100 active users; 409 `USER_GROUP_INACTIVE` on an inactive group. */
  addMembers: async (groupId: string, userIds: string[]): Promise<void> => {
    await apiClient.post(`/user-groups/${groupId}/members`, { userIds });
  },

  /** 409 `GROUP_LAST_ELIGIBLE_MEMBER` while the group has open tasks. */
  removeMember: async (groupId: string, userId: string): Promise<void> => {
    await apiClient.delete(`/user-groups/${groupId}/members/${userId}`);
  },
};
