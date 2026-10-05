import { apiClient } from '@/lib/api-client';
import { PaginatedResponse, SlaBreach } from '@/types/models';

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
};
