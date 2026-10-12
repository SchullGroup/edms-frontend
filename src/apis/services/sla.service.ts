import { apiClient } from '@/lib/api-client';
import {
  ApiResponse,
  PaginatedResponse,
  SlaBreach,
  SlaConfiguration,
  SlaConfigurationUpdate,
  SlaHoliday,
} from '@/types/models';

/** Mirrors `GET /sla/breaches`'s query schema. */
export interface SlaBreachFilters {
  page?: number;
  limit?: number;
  breachType?: 'warning' | 'escalation';
  status?: 'open' | 'resolved' | 'all';
  workflowInstanceId?: string;
  taskId?: string;
  assigneeId?: string;
  assignedRoleId?: string;
  stage?: string;
  notifiedFrom?: string;
  notifiedTo?: string;
  order?: 'asc' | 'desc';
  scope?: 'mine' | 'all';
}

export const slaService = {
  /**
   * Persisted SLA warning/escalation events. Distinct from the current
   * bottleneck/SLA state computed by `bottlenecks-ageing` — the two totals
   * are not guaranteed to match. Use this for event drill-down/history, and
   * `bottlenecks-ageing` for the Bottlenecks page summary.
   */
  getBreaches: async (params?: SlaBreachFilters): Promise<PaginatedResponse<SlaBreach>> => {
    const response = await apiClient.get<PaginatedResponse<SlaBreach>>('/sla/breaches', {
      params,
    });
    return response.data;
  },

  /** Needs `workflow:view`. */
  getConfiguration: async (): Promise<SlaConfiguration> => {
    const response = await apiClient.get<ApiResponse<SlaConfiguration>>('/sla/configuration');
    return response.data.data;
  },

  /** Needs `workflow:edit`. Send only the fields that changed. */
  updateConfiguration: async (updates: SlaConfigurationUpdate): Promise<SlaConfiguration> => {
    const response = await apiClient.patch<ApiResponse<SlaConfiguration>>(
      '/sla/configuration',
      updates,
    );
    return response.data.data;
  },

  getHolidays: async (): Promise<SlaHoliday[]> => {
    const response = await apiClient.get<ApiResponse<SlaHoliday[]>>('/sla/holidays');
    return response.data.data;
  },

  /** `date` is "YYYY-MM-DD". */
  createHoliday: async (holiday: { date: string; name: string }): Promise<SlaHoliday> => {
    const response = await apiClient.post<ApiResponse<SlaHoliday>>('/sla/holidays', holiday);
    return response.data.data;
  },

  deleteHoliday: async (holidayId: string): Promise<void> => {
    await apiClient.delete(`/sla/holidays/${holidayId}`);
  },
};
