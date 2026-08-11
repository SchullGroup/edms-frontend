import { apiClient } from '@/lib/api-client';
import { User, PaginatedResponse, ApiResponse } from '@/types/models';
import { SEED } from '@/store/initialData';

export interface UserFilters {
  departmentId?: string;
  status?: 'active' | 'inactive' | 'suspended';
  page?: number;
  limit?: number;
}

export const usersService = {
  getAll: async (params?: UserFilters): Promise<PaginatedResponse<User>> => {
    await new Promise((resolve) => setTimeout(resolve, 400));

    return {
      success: true,
      message: 'Fetched users successfully',
      data: SEED.users as any,
      pagination: { page: 1, limit: 10, total: SEED.users.length, totalPages: 1 },
    };
  },

  getById: async (id: string): Promise<User> => {
    await new Promise((resolve) => setTimeout(resolve, 400));
    const user = SEED.users.find((u) => u.id === id);
    if (!user) throw new Error('User not found');

    return user as any;
  },

  create: async (data: any): Promise<User> => {
    await new Promise((resolve) => setTimeout(resolve, 400));
    return { ...data, id: `u-${Date.now()}` } as any;
  },

  update: async (id: string, updates: Partial<User>): Promise<User> => {
    await new Promise((resolve) => setTimeout(resolve, 400));
    const user = SEED.users.find((u) => u.id === id);
    return { ...user, ...updates } as any;
  },

  delete: async (id: string): Promise<User> => {
    await new Promise((resolve) => setTimeout(resolve, 400));
    const user = SEED.users.find((u) => u.id === id);
    return user as any;
  },

  assignRoles: async (id: string, roleIds: string[]): Promise<User> => {
    await new Promise((resolve) => setTimeout(resolve, 400));
    const user = SEED.users.find((u) => u.id === id);
    return { ...user, roles: roleIds } as any;
  },

  removeRole: async (id: string, roleId: string): Promise<void> => {
    await new Promise((resolve) => setTimeout(resolve, 400));
  },
};
