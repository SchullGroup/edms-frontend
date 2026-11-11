import { apiClient } from '@/lib/api-client';
import { AccessRule, AccessRuleInput, ApiResponse } from '@/types/models';

/** `/access-rules`: IP and country rules checked on every API call, sign-in included. */
export const accessRulesService = {
  getAll: async (): Promise<AccessRule[]> => {
    const res = await apiClient.get<ApiResponse<AccessRule[]>>('/access-rules');
    return res.data.data;
  },

  /** 422 `WOULD_LOCK_OUT_CALLER` if it would block this browser; 422 `GEO_NOT_CONFIGURED` for countries. */
  create: async (input: AccessRuleInput): Promise<AccessRule> => {
    const res = await apiClient.post<ApiResponse<AccessRule>>('/access-rules', input);
    return res.data.data;
  },

  remove: async (id: string): Promise<void> => {
    await apiClient.delete(`/access-rules/${id}`);
  },
};
