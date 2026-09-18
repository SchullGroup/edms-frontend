import { useQuery } from '@tanstack/react-query';
import { slaService, SlaBreachFilters } from '../services/sla.service';

export const slaKeys = {
  all: ['sla', 'breaches'] as const,
  list: (params?: SlaBreachFilters) => [...slaKeys.all, params ?? {}] as const,
};

/** Persisted SLA warning/escalation events. `scope: 'mine'` for a staff
 *  member's own; `scope: 'all'` for a supervisor/team view. */
export const useSlaBreaches = (params?: SlaBreachFilters, options?: { enabled?: boolean }) => {
  return useQuery({
    queryKey: slaKeys.list(params),
    queryFn: () => slaService.getBreaches(params),
    enabled: options?.enabled ?? true,
  });
};
