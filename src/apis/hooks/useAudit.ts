import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { auditService, AuditFilters } from '@/apis/services/audit.service';
import { useUIStore } from '@/store/useUIStore';

export const auditKeys = {
  all: ['audit'] as const,
  lists: () => [...auditKeys.all, 'list'] as const,
  list: () => [...auditKeys.lists()] as const,
};

/** @deprecated `SEED`-backed mock — see `auditService.getAll()`. Kept for
 *  `admin/audit`, `auditor/trail`, `platform/audit` and
 *  `management/compliance`, which read the app's own action taxonomy
 *  (`REDACT_RELEASE`, `SIGN`, …) that the real backend doesn't have. Use
 *  `useAuditEntries()` for the real, hash-chained trail. */
export function useAuditLogs() {
  return useQuery({
    queryKey: auditKeys.list(),
    queryFn: () => auditService.getAll(),
  });
}

/** @deprecated no-op mock. The real backend has no write endpoint — entries
 *  are recorded server-side as a side effect of other actions — so this
 *  can't be pointed at a real call. Left as-is; used by 9 other call sites. */
export function useCreateAuditLog() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ action, target, detail }: { action: string; target: string; detail: string }) =>
      auditService.logAction(action, target, detail),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: auditKeys.all });
    },
  });
}

// --- Real backend (`GET /audit`) ---

export const realAuditKeys = {
  all: ['audit', 'real'] as const,
  lists: () => [...realAuditKeys.all, 'list'] as const,
  list: (filters: AuditFilters) => [...realAuditKeys.lists(), filters] as const,
  details: () => [...realAuditKeys.all, 'detail'] as const,
  detail: (id: string) => [...realAuditKeys.details(), id] as const,
};

/** `GET /audit` — the real, hash-chained trail. Requires `audit:view`. */
export function useAuditEntries(filters: AuditFilters = {}) {
  return useQuery({
    queryKey: realAuditKeys.list(filters),
    queryFn: () => auditService.search(filters),
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
