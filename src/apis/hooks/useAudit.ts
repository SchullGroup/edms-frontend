import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { auditService } from '@/apis/services/audit.service';

export const auditKeys = {
  all: ['audit'] as const,
  lists: () => [...auditKeys.all, 'list'] as const,
  list: () => [...auditKeys.lists()] as const,
};

export function useAuditLogs() {
  return useQuery({
    queryKey: auditKeys.list(),
    queryFn: () => auditService.getAll(),
  });
}

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
