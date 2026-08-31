import { apiClient } from '@/lib/api-client';
import {
  ApiResponse,
  CreateRoleRequest,
  Role,
  RolePermission,
  UpdateRoleRequest,
} from '@/types/models';

/** The API's actual `GET /roles` response nests permissions under the raw
 *  `rolePermissions[].permission` Prisma join, not the flat `permissions` array
 *  its own Swagger schema documents. Normalize here so the rest of the app can
 *  rely on `role.permissions` as typed. */
function normalizeRole(raw: any): Role {
  return {
    ...raw,
    permissions: raw.permissions ?? raw.rolePermissions?.map((rp: any) => rp.permission) ?? [],
  };
}

export const rolesService = {
  getAll: async (): Promise<Role[]> => {
    const response = await apiClient.get<ApiResponse<Role[]>>('/roles');
    return response.data.data.map(normalizeRole);
  },

  getById: async (id: string): Promise<Role> => {
    const response = await apiClient.get<ApiResponse<Role>>(`/roles/${id}`);
    return normalizeRole(response.data.data);
  },

  create: async (data: CreateRoleRequest): Promise<Role> => {
    const response = await apiClient.post<ApiResponse<Role>>('/roles', data);
    return normalizeRole(response.data.data);
  },

  update: async (id: string, updates: UpdateRoleRequest): Promise<Role> => {
    const response = await apiClient.patch<ApiResponse<Role>>(`/roles/${id}`, updates);
    return normalizeRole(response.data.data);
  },

  // `PUT` (not POST) — replaces the whole permission set. Matches the Swagger spec.
  setPermissions: async (id: string, permissions: RolePermission[]): Promise<Role> => {
    const response = await apiClient.put<ApiResponse<Role>>(`/roles/${id}/permissions`, {
      permissions,
    });
    return normalizeRole(response.data.data);
  },

  delete: async (id: string): Promise<void> => {
    await apiClient.delete(`/roles/${id}`);
  },
};
