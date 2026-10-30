import { apiClient } from '@/lib/api-client';
import {
  ApiResponse,
  ControlException,
  ControlExceptionCategory,
  ControlExceptionInput,
  ControlExceptionReport,
  ControlExceptionSeverity,
  ControlExceptionStatus,
  PaginatedResponse,
} from '@/types/models';

/** Filters shared by the list and the report. `from`/`to` bound the raised date. */
export interface ControlExceptionFilters {
  status?: ControlExceptionStatus;
  category?: ControlExceptionCategory;
  severity?: ControlExceptionSeverity;
  departmentId?: string;
  from?: string;
  to?: string;
}

export interface ControlExceptionListParams extends ControlExceptionFilters {
  page?: number;
  limit?: number;
}

export const controlExceptionsService = {
  getAll: async (
    params?: ControlExceptionListParams,
  ): Promise<PaginatedResponse<ControlException>> => {
    const res = await apiClient.get<PaginatedResponse<ControlException>>('/control-exceptions', {
      params,
    });
    return res.data;
  },

  getReport: async (params?: ControlExceptionFilters): Promise<ControlExceptionReport> => {
    const res = await apiClient.get<ApiResponse<ControlExceptionReport>>(
      '/control-exceptions/report',
      { params },
    );
    return res.data.data;
  },

  getById: async (id: string): Promise<ControlException> => {
    const res = await apiClient.get<ApiResponse<ControlException>>(`/control-exceptions/${id}`);
    return res.data.data;
  },

  create: async (data: ControlExceptionInput): Promise<ControlException> => {
    const res = await apiClient.post<ApiResponse<ControlException>>('/control-exceptions', data);
    return res.data.data;
  },

  /** Only while `open`; a reported exception is a 409. */
  update: async (id: string, data: Partial<ControlExceptionInput>): Promise<ControlException> => {
    const res = await apiClient.patch<ApiResponse<ControlException>>(
      `/control-exceptions/${id}`,
      data,
    );
    return res.data.data;
  },

  /** Sends it to the permanent secretary (every active `management` user is notified). */
  report: async (id: string): Promise<ControlException> => {
    const res = await apiClient.post<ApiResponse<ControlException>>(
      `/control-exceptions/${id}/report`,
    );
    return res.data.data;
  },

  acknowledge: async (id: string): Promise<ControlException> => {
    const res = await apiClient.post<ApiResponse<ControlException>>(
      `/control-exceptions/${id}/acknowledge`,
    );
    return res.data.data;
  },

  resolve: async (id: string, resolutionNote: string): Promise<ControlException> => {
    const res = await apiClient.post<ApiResponse<ControlException>>(
      `/control-exceptions/${id}/resolve`,
      { resolutionNote },
    );
    return res.data.data;
  },
};
