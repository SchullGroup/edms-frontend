import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { slaService, SlaBreachFilters } from '../services/sla.service';
import { useUIStore } from '@/store/useUIStore';
import type { SlaConfigurationUpdate } from '@/types/models';

export const slaKeys = {
  all: ['sla', 'breaches'] as const,
  list: (params?: SlaBreachFilters) => [...slaKeys.all, params ?? {}] as const,
  configuration: ['sla', 'configuration'] as const,
  holidays: ['sla', 'holidays'] as const,
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

export const useSlaConfiguration = (options?: { enabled?: boolean }) =>
  useQuery({
    queryKey: slaKeys.configuration,
    queryFn: slaService.getConfiguration,
    enabled: options?.enabled ?? true,
  });

export function useUpdateSlaConfiguration() {
  const queryClient = useQueryClient();
  const { addToast } = useUIStore.getState();
  return useMutation({
    mutationFn: (updates: SlaConfigurationUpdate) => slaService.updateConfiguration(updates),
    onSuccess: (data) => {
      queryClient.setQueryData(slaKeys.configuration, data);
      addToast('SLA settings saved', 'success');
    },
    onError: (err: any) => {
      addToast(err.response?.data?.message || 'Failed to save SLA settings', 'error');
    },
  });
}

export const useSlaHolidays = (options?: { enabled?: boolean }) =>
  useQuery({
    queryKey: slaKeys.holidays,
    queryFn: slaService.getHolidays,
    enabled: options?.enabled ?? true,
  });

export function useCreateSlaHoliday() {
  const queryClient = useQueryClient();
  const { addToast } = useUIStore.getState();
  return useMutation({
    mutationFn: slaService.createHoliday,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: slaKeys.holidays });
      addToast('Holiday added', 'success');
    },
    onError: (err: any) => {
      addToast(err.response?.data?.message || 'Failed to add holiday', 'error');
    },
  });
}

export function useDeleteSlaHoliday() {
  const queryClient = useQueryClient();
  const { addToast } = useUIStore.getState();
  return useMutation({
    mutationFn: slaService.deleteHoliday,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: slaKeys.holidays });
      addToast('Holiday removed', 'info');
    },
    onError: (err: any) => {
      addToast(err.response?.data?.message || 'Failed to remove holiday', 'error');
    },
  });
}
