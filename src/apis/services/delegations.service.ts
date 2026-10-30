import { apiClient } from '@/lib/api-client';
import {
  ApiResponse,
  CreateDelegationRequest,
  Delegation,
  PaginatedResponse,
  PersonSummary,
} from '@/types/models';

export interface DelegationFilters {
  page?: number;
  limit?: number;
  /** Oversight roles may pass `'all'`; defaults to the caller's own delegations. */
  scope?: 'mine' | 'all';
}

export const delegationsService = {
  getAll: async (params?: DelegationFilters): Promise<PaginatedResponse<Delegation>> => {
    const res = await apiClient.get<PaginatedResponse<Delegation>>('/delegations', { params });
    return res.data;
  },

  /** Active users the caller may delegate to (not themselves), at most 20.
   *  `search` (name or email) must be 2–100 characters when sent. */
  getEligibleUsers: async (search?: string): Promise<PersonSummary[]> => {
    const res = await apiClient.get<ApiResponse<PersonSummary[]>>('/delegations/eligible-users', {
      params: search ? { search } : undefined,
    });
    return res.data.data;
  },

  getById: async (id: string): Promise<Delegation> => {
    const res = await apiClient.get<ApiResponse<Delegation>>(`/delegations/${id}`);
    return res.data.data;
  },

  create: async (data: CreateDelegationRequest): Promise<Delegation> => {
    const res = await apiClient.post<ApiResponse<Delegation>>('/delegations', data);
    return res.data.data;
  },

  end: async (id: string): Promise<Delegation> => {
    const res = await apiClient.post<ApiResponse<Delegation>>(`/delegations/${id}/end`);
    return res.data.data;
  },
};
