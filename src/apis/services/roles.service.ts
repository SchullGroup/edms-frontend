import { apiClient } from '@/lib/api-client';
import {
  ApiResponse,
  CreateRoleRequest,
  Role,
  RolePermission,
  UpdateRoleRequest,
} from '@/types/models';

/**
 * The API's actual `GET /roles` response nests permissions under the raw
 * `rolePermissions[].permission` Prisma join, not the flat `permissions` array
 * its own Swagger schema documents. Normalize here so the rest of the app can
 * rely on `role.permissions` as typed.
 *
 * `scope` lives on the join row itself (`rolePermissions[i].scope`), not on
 * the nested `.permission` object — confirmed live 2026-09-18:
 * `{roleId, permissionId, scope: "department", permission: {id,resource,action}}`.
 * A prior version of this function mapped `rp => rp.permission` only, which
 * silently discarded `scope` on every read. Since `PUT` defaults a missing
 * `scope` to `'global'`, that loss meant every save through the role editor
 * quietly widened every one of the role's grants to `global` scope, whether
 * or not that permission was actually touched in that save.
 */
function normalizeRole(raw: any): Role {
  return {
    ...raw,
    permissions:
      raw.permissions ??
      raw.rolePermissions?.map((rp: any) => ({ ...rp.permission, scope: rp.scope })) ??
      [],
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

  // `PUT` — replaces the WHOLE permission set for the role, so callers must send
  // the complete desired list (each `{ id?, resource, action }`), not a delta.
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
