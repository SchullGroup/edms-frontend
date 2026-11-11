import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { accessRulesService } from '@/apis/services/accessRules.service';
import { AccessRuleInput } from '@/types/models';
import { useUIStore } from '@/store/useUIStore';

export const accessRuleKeys = {
  all: ['access-rules'] as const,
};

export function useAccessRules(options?: { enabled?: boolean }) {
  return useQuery({
    queryKey: accessRuleKeys.all,
    queryFn: accessRulesService.getAll,
    enabled: options?.enabled ?? true,
  });
}

/** Errors are left to the form, which explains a lock-out or a missing geo header in place. */
export function useCreateAccessRule() {
  const queryClient = useQueryClient();
  const { addToast } = useUIStore.getState();

  return useMutation({
    mutationFn: (input: AccessRuleInput) => accessRulesService.create(input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: accessRuleKeys.all });
      addToast('Access rule added', 'success');
    },
  });
}

export function useRemoveAccessRule() {
  const queryClient = useQueryClient();
  const { addToast } = useUIStore.getState();

  return useMutation({
    mutationFn: (id: string) => accessRulesService.remove(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: accessRuleKeys.all });
      addToast('Access rule removed', 'info');
    },
    onError: (err: any) => {
      addToast(err?.response?.data?.message || 'Failed to remove the access rule', 'error');
    },
  });
}
