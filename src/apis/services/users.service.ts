import { apiClient } from '@/lib/api-client';
import { User, PaginatedResponse, ApiResponse } from '@/types/models';

export interface UserFilters {
  departmentId?: string;
  status?: 'active' | 'inactive' | 'suspended';
  page?: number;
  limit?: number;
}

export interface CreateUserInput {
  email: string;
  name: string;
  password: string;
  status?: 'active' | 'inactive' | 'suspended';
  departmentId?: string;
  roleIds?: string[];
}

/** The backend caps `limit` at 100. */
const MAX_LIMIT = 100;

const MAX_PAGES = 20;

export const usersService = {
  getAll: async (params?: UserFilters): Promise<PaginatedResponse<User>> => {
    const response = await apiClient.get<PaginatedResponse<User>>('/users', { params });
    return response.data;
  },

  /** Walks every page — used where a complete roster is required (team rollups,
   *  assignee pickers) rather than a single display page. */
  getAllPages: async (
    params?: Omit<UserFilters, 'page' | 'limit'>,
  ): Promise<{ items: User[]; total: number; truncated: boolean }> => {
    const items: User[] = [];
    let page = 1;
    let total = 0;
    let totalPages = 1;

    while (page <= totalPages && page <= MAX_PAGES) {
      const response = await apiClient.get<PaginatedResponse<User>>('/users', {
        params: { ...params, page, limit: MAX_LIMIT },
      });

      items.push(...response.data.data);
      total = response.data.pagination.total;
      totalPages = response.data.pagination.totalPages;
      page += 1;
    }

    return { items, total, truncated: totalPages > MAX_PAGES };
  },

  getById: async (id: string): Promise<User> => {
    const response = await apiClient.get<ApiResponse<User>>(`/users/${id}`);
    return response.data.data;
  },

  create: async (data: CreateUserInput): Promise<User> => {
    const response = await apiClient.post<ApiResponse<User>>('/users', data);
    return response.data.data;
  },

  update: async (id: string, updates: Partial<User>): Promise<User> => {
    const response = await apiClient.patch<ApiResponse<User>>(`/users/${id}`, updates);
    return response.data.data;
  },

  // Soft-delete on the backend — sets status to `inactive`.
  delete: async (id: string): Promise<User> => {
    const response = await apiClient.delete<ApiResponse<User>>(`/users/${id}`);
    return response.data.data;
  },

  assignRoles: async (id: string, roleIds: string[]): Promise<User> => {
    const response = await apiClient.post<ApiResponse<User>>(`/users/${id}/roles`, { roleIds });
    return response.data.data;
  },

  removeRole: async (id: string, roleId: string): Promise<void> => {
    await apiClient.delete(`/users/${id}/roles/${roleId}`);
  },
};
