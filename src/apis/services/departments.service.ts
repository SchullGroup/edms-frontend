import { apiClient } from '@/lib/api-client';
import {
  ApiResponse,
  CreateDepartmentRequest,
  Department,
  UpdateDepartmentRequest,
} from '@/types/models';

export interface DepartmentFilters {
  /** Parent department UUID, or the literal string `'null'` for root departments. */
  parentId?: string;
}

export const departmentsService = {
  // `GET /departments` is not paginated — `parentId` is the only supported query param.
  getAll: async (params?: DepartmentFilters): Promise<ApiResponse<Department[]>> => {
    const res = await apiClient.get<ApiResponse<Department[]>>('/departments', { params });
    return res.data;
  },

  getById: async (id: string): Promise<Department> => {
    const res = await apiClient.get<ApiResponse<Department>>(`/departments/${id}`);
    return res.data.data;
  },

  create: async (data: CreateDepartmentRequest): Promise<Department> => {
    const res = await apiClient.post<ApiResponse<Department>>('/departments', data);
    return res.data.data;
  },

  update: async (id: string, updates: UpdateDepartmentRequest): Promise<Department> => {
    const res = await apiClient.patch<ApiResponse<Department>>(`/departments/${id}`, updates);
    return res.data.data;
  },

  // 409 "Department has active users or cabinets" if it is still in use.
  delete: async (id: string): Promise<void> => {
    await apiClient.delete(`/departments/${id}`);
  },
};
