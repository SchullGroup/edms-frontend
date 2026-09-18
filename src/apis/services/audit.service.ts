import { apiClient } from '@/lib/api-client';
import { AuditLog, ApiResponse, AuditEntry, PaginatedResponse } from '@/types/models';
import { SEED } from '@/store/initialData';

/** Mirrors the real backend's `GET /audit` search/filter query. */
export interface AuditFilters {
  actorId?: string;
  action?: string;
  objectType?: string;
  objectId?: string;
  /** ISO date — inclusive lower bound on `occurredAt`. */
  from?: string;
  /** ISO date — inclusive upper bound on `occurredAt`. */
  to?: string;
  page?: number;
  limit?: number;
}

export interface AuditChainVerification {
  intact: boolean;
  entriesChecked: number;
  rangeStart: string;
  rangeEnd: string;
}

export const auditService = {
  /**
   * @deprecated `SEED`-backed mock, unrelated to the real backend's
   * `GET /audit`. Still backs `useAuditLogs()`, which `admin/audit`,
   * `auditor/trail`, `platform/audit` and `management/compliance` read for
   * the app's own action taxonomy (`REDACT_RELEASE`, `SIGN`, …) — the real
   * backend has no equivalent for that vocabulary. Use `search()` below for
   * the real, hash-chained trail.
   */
  getAll: async (): Promise<PaginatedResponse<AuditLog>> => {
    await new Promise((resolve) => setTimeout(resolve, 400));

    return {
      success: true,
      message: 'Fetched audit logs successfully',
      data: SEED.audit as any,
      pagination: { page: 1, limit: 10, total: SEED.audit.length, totalPages: 1 },
    };
  },

  /** @deprecated no-op mock — see `useCreateAuditLog()` for why this can't
   *  be pointed at a real endpoint. */
  logAction: async (action: string, target: string, detail: string): Promise<any> => {
    await new Promise((resolve) => setTimeout(resolve, 400));
    return { success: true, message: 'Audit logged successfully' };
  },

  // --- Real backend (`GET /audit`, hash-chained, `audit:view`/`audit:export`) ---

  /** `GET /audit` — requires `audit:view`. Newest first. */
  search: async (filters?: AuditFilters): Promise<PaginatedResponse<AuditEntry>> => {
    const response = await apiClient.get<PaginatedResponse<AuditEntry>>('/audit', {
      params: filters,
    });
    return response.data;
  },

  getEntryById: async (id: string): Promise<AuditEntry> => {
    const response = await apiClient.get<ApiResponse<AuditEntry>>(`/audit/${id}`);
    return response.data.data;
  },

  /** `GET /audit/export` — requires `audit:export`. Oldest first (chain
   *  order). Returns raw CSV text; the export is itself recorded in the trail. */
  exportCsv: async (filters?: Omit<AuditFilters, 'page'>): Promise<string> => {
    const response = await apiClient.get<string>('/audit/export', {
      params: filters,
      headers: { Accept: 'text/csv' },
      responseType: 'text',
    });
    return response.data;
  },

  /** `GET /audit/verify` — recomputes every entry's hash over the window and
   *  checks it links to the entry before it. Windows above 10,000 entries are
   *  rejected — narrow with `from`/`to`. */
  verifyChain: async (params?: { from?: string; to?: string }): Promise<AuditChainVerification> => {
    const response = await apiClient.get<ApiResponse<AuditChainVerification>>('/audit/verify', {
      params,
    });
    return response.data.data;
  },
};
