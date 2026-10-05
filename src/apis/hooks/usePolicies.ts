import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { policiesService } from '@/apis/services/policies.service';
import { useUIStore } from '@/store/useUIStore';

export const policyKeys = {
  all: ['policies'] as const,
  details: () => [...policyKeys.all, 'detail'] as const,
};

export function usePolicies(options?: { enabled?: boolean }) {
  return useQuery({
    queryKey: policyKeys.details(),
    queryFn: () => policiesService.getPolicies(),
    enabled: options?.enabled ?? true,
  });
}

export function useUpdatePolicyControl() {
  const queryClient = useQueryClient();
  const { addToast } = useUIStore.getState();

  return useMutation({
    mutationFn: ({ ruleName, enabled }: { ruleName: string; enabled: boolean }) =>
      policiesService.updateControl(ruleName, enabled),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: policyKeys.details() });
      addToast('Policy control updated', 'success');
    },
    onError: (err: any) => {
      addToast(err.response?.data?.message || 'Failed to update policy', 'error');
    },
  });
}

export function useUpdatePolicyConfidentiality() {
  const queryClient = useQueryClient();
  const { addToast } = useUIStore.getState();

  return useMutation({
    mutationFn: ({ level, updates }: { level: string; updates: any }) =>
      policiesService.updateConfidentiality(level, updates),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: policyKeys.details() });
      addToast('Policy confidentiality updated', 'success');
    },
    onError: (err: any) => {
      addToast(err.response?.data?.message || 'Failed to update policy', 'error');
    },
  });
}

export function useUpdatePolicyUrgency() {
  const queryClient = useQueryClient();
  const { addToast } = useUIStore.getState();

  return useMutation({
    mutationFn: ({ level, updates }: { level: string; updates: any }) =>
      policiesService.updateUrgency(level, updates),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: policyKeys.details() });
      addToast('Policy urgency updated', 'success');
    },
    onError: (err: any) => {
      addToast(err.response?.data?.message || 'Failed to update policy', 'error');
    },
  });
}
