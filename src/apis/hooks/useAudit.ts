import { useQuery } from '@tanstack/react-query';
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
