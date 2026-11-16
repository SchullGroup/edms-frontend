import { apiClient } from '@/lib/api-client';
import { User, PaginatedResponse, ApiResponse, PhoneVerificationStatus } from '@/types/models';

export interface UserFilters {
  departmentId?: string;
  status?: 'pending' | 'active' | 'inactive' | 'suspended';
  /** Case-insensitive substring match on name or email (backend PR #48). Still
   *  narrowed by the caller's `user:view` scope. Must be non-empty if sent. */
  search?: string;
  page?: number;
  limit?: number;
}

export interface CreateUserInput {
  email: string;
  name: string;
  /**
   * Optional — confirmed live 2026-09-18 that `POST /users` accepts omitting
   * this entirely and returns `{ invited: true }`, triggering the real
   * invite-email flow server-side instead of setting a caller-chosen
   * password. Kept in the type for any future direct-set use case, but no
   * call site should populate it for ordinary user creation.
   */
  password?: string;
  status?: 'active' | 'inactive' | 'suspended';
  departmentId?: string;
  /** Must be an active user (edms-backend PR #62). */
  managerId?: string;
  roleIds?: string[];
  /** They set up two-step sign-in at their first sign-in (PR #71). */
  mfaRequired?: boolean;
  /** E.164, global `user:edit` only (PR #72); texted a code once they're active. */
  phoneNumber?: string;
}

/** Create and update say whether a verification text went out when the phone was saved. */
export type SavedUser = User & { phoneVerification?: { status: PhoneVerificationStatus } };

export const usersService = {
  getAll: async (params?: UserFilters): Promise<PaginatedResponse<User>> => {
    const response = await apiClient.get<PaginatedResponse<User>>('/users', { params });
    return response.data;
  },

  getById: async (id: string): Promise<User> => {
    const response = await apiClient.get<ApiResponse<User>>(`/users/${id}`);
    return response.data.data;
  },

  create: async (data: CreateUserInput): Promise<SavedUser> => {
    const response = await apiClient.post<ApiResponse<SavedUser>>('/users', data);
    return response.data.data;
  },

  update: async (id: string, updates: Partial<User>): Promise<SavedUser> => {
    const response = await apiClient.patch<ApiResponse<SavedUser>>(`/users/${id}`, updates);
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

  /**
   * Issues a fresh set-password link and emails it to the user; any link sent
   * previously stops working. Backend rejects with 409 unless the user is
   * `pending` or `active`, and 502 if the email itself fails to send.
   */
  resendInvitation: async (id: string): Promise<{ id: string; email: string; invited: boolean }> => {
    const response = await apiClient.post<ApiResponse<{ id: string; email: string; invited: boolean }>>(
      `/users/${id}/invitation`,
    );
    return response.data.data;
  },

  /** Texts the user a new code for their registered phone (global `user:edit`, PR #72). */
  resendPhoneVerification: async (id: string): Promise<void> => {
    await apiClient.post(`/users/${id}/phone-verification/resend`);
  },
};
