import { useQuery } from '@tanstack/react-query';
import {
  workflowHistoryService,
  WorkflowHistoryFilters,
} from '@/apis/services/workflowHistory.service';

export const workflowHistoryKeys = {
  all: ['workflowHistory'] as const,
  lists: () => [...workflowHistoryKeys.all, 'list'] as const,
  list: (params: WorkflowHistoryFilters = {}) =>
    [...workflowHistoryKeys.lists(), params] as const,
  detail: (id: string) => [...workflowHistoryKeys.all, 'detail', id] as const,
};

export function useWorkflowHistory(
  params: WorkflowHistoryFilters = {},
  options?: { enabled?: boolean },
) {
  return useQuery({
    queryKey: workflowHistoryKeys.list(params),
    queryFn: () => workflowHistoryService.getAll(params),
    enabled: options?.enabled ?? true,
  });
}

export function useWorkflowHistoryRecord(id?: string) {
  return useQuery({
    queryKey: workflowHistoryKeys.detail(id || ''),
    queryFn: () => workflowHistoryService.getById(id as string),
    enabled: !!id,
  });
}
