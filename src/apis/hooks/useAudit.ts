import { useQueries, useQuery, useMutation } from '@tanstack/react-query';
import { auditService, AuditFilters } from '@/apis/services/audit.service';
import { useUIStore } from '@/store/useUIStore';

// The trail is read-only here: the backend writes every entry as a side effect of the action.

export const realAuditKeys = {
  all: ['audit', 'real'] as const,
  lists: () => [...realAuditKeys.all, 'list'] as const,
  list: (filters: AuditFilters) => [...realAuditKeys.lists(), filters] as const,
  details: () => [...realAuditKeys.all, 'detail'] as const,
  detail: (id: string) => [...realAuditKeys.details(), id] as const,
};

/** `GET /audit` — the real, hash-chained trail. Requires `audit:view`. */
export function useAuditEntries(filters: AuditFilters = {}, options?: { enabled?: boolean }) {
  return useQuery({
    queryKey: realAuditKeys.list(filters),
    queryFn: () => auditService.search(filters),
    enabled: options?.enabled ?? true,
  });
}

/** Total entries for several actions since `from`: one `limit=1` call each, since `GET /audit` filters one action. */
export function useAuditActionTotal(
  actions: readonly string[],
  from: string,
  options?: { enabled?: boolean },
) {
  return useQueries({
    queries: actions.map((action) => {
      const filters: AuditFilters = { action, from, page: 1, limit: 1 };
      return {
        queryKey: realAuditKeys.list(filters),
        queryFn: () => auditService.search(filters),
        enabled: options?.enabled ?? true,
      };
    }),
    combine: (results) => ({
      total: results.reduce((sum, r) => sum + (r.data?.pagination?.total ?? 0), 0),
      isLoading: results.some((r) => r.isLoading),
      isError: results.some((r) => r.isError),
    }),
  });
}

export function useAuditEntry(id?: string) {
  return useQuery({
    queryKey: realAuditKeys.detail(id || ''),
    queryFn: () => auditService.getEntryById(id as string),
    enabled: !!id,
  });
}

/** Triggers a browser download of `GET /audit/export`'s CSV. Requires
 *  `audit:export` — a narrower grant than `audit:view`; `client_admin`
 *  doesn't have it by default, so a 403 here is expected for some roles. */
export function useExportAuditCsv() {
  const { addToast } = useUIStore.getState();

  return useMutation({
    mutationFn: (filters?: Omit<AuditFilters, 'page'>) => auditService.exportCsv(filters),
    onSuccess: (csv) => {
      const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
      const link = document.createElement('a');
      link.href = URL.createObjectURL(blob);
      link.download = 'audit-export.csv';
      link.click();
      URL.revokeObjectURL(link.href);
    },
    onError: (err: any) => {
      addToast(err.response?.data?.message || 'Failed to export audit log', 'error');
    },
  });
}

/** `GET /audit/verify` — recomputes hashes over a window on demand; not
 *  cached as query data since it's an explicit, potentially expensive action. */
export function useVerifyAuditChain() {
  return useMutation({
    mutationFn: (params?: { from?: string; to?: string }) => auditService.verifyChain(params),
  });
}
