import { useQuery, useMutation, useQueryClient, keepPreviousData } from '@tanstack/react-query';
import {
  tasksService,
  ApprovalTaskFilters,
  DepartmentScopedTaskParams,
  TaskFilters,
  TaskStatsParams,
} from '../services/tasks.service';
import { TaskActionRequest } from '@/types/models';

export const taskKeys = {
  all: ['tasks'] as const,
  lists: () => [...taskKeys.all, 'list'] as const,
  list: (filters?: TaskFilters) => [...taskKeys.lists(), filters ?? {}] as const,
  detail: (id: string) => [...taskKeys.all, 'detail', id] as const,
};

/** `keepPrevious` shows the last page while the next loads (paged or searched lists). */
export const useTasks = (
  params?: TaskFilters,
  options?: { enabled?: boolean; keepPrevious?: boolean },
) => {
  return useQuery({
    queryKey: taskKeys.list(params),
    queryFn: () => tasksService.getAll(params),
    enabled: options?.enabled ?? true,
    placeholderData: options?.keepPrevious ? keepPreviousData : undefined,
  });
};

export const useTask = (id: string) => {
  return useQuery({
    queryKey: taskKeys.detail(id),
    queryFn: () => tasksService.getById(id),
    enabled: !!id,
  });
};

export const useTaskStats = (params?: TaskStatsParams, options?: { enabled?: boolean }) => {
  return useQuery({
    queryKey: [...taskKeys.all, 'stats', params ?? {}],
    queryFn: () => tasksService.getStats(params),
    enabled: options?.enabled ?? true,
  });
};

/** Supervisor Approvals Queue — the purpose-built endpoint, ordered by
 *  urgency then due date server-side. Use `scope: 'all'` for the team queue. */
export const useApprovalTasks = (params?: ApprovalTaskFilters, options?: { enabled?: boolean }) => {
  return useQuery({
    queryKey: [...taskKeys.all, 'approvals', params ?? {}],
    queryFn: () => tasksService.getApprovals(params),
    enabled: options?.enabled ?? true,
  });
};

/** Supervisor Workload & Reassign — per-member counts against a fixed
 *  capacity. Omit `departmentId`; the backend resolves it for a supervisor. */
export const useTaskWorkload = (
  params?: DepartmentScopedTaskParams,
  options?: { enabled?: boolean },
) => {
  return useQuery({
    queryKey: [...taskKeys.all, 'workload', params ?? {}],
    queryFn: () => tasksService.getWorkload(params),
    enabled: options?.enabled ?? true,
  });
};

export const useTaskAction = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, actionReq }: { id: string; actionReq: TaskActionRequest }) =>
      tasksService.action(id, actionReq),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: taskKeys.all });
      queryClient.invalidateQueries({ queryKey: ['workflowInstances'] });
      queryClient.invalidateQueries({ queryKey: ['documents'] });
    },
  });
};

export const useReassignTask = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, assigneeId, note }: { id: string; assigneeId: string; note?: string }) =>
      tasksService.reassign(id, assigneeId, note),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: taskKeys.all });
    },
  });
};
