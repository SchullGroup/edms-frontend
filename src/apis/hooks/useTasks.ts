import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  tasksService,
  ApprovalTaskFilters,
  DepartmentScopedTaskParams,
  TaskFilters,
  TaskStatsParams,
} from '../services/tasks.service';
import { TaskActionRequest } from '@/types/models';
import { fetchAllPages } from '@/apis/utils/fetchAllPages';

export const taskKeys = {
  all: ['tasks'] as const,
  lists: () => [...taskKeys.all, 'list'] as const,
  list: (filters?: TaskFilters) => [...taskKeys.lists(), filters ?? {}] as const,
  allPages: (filters?: Omit<TaskFilters, 'page' | 'limit'>) =>
    [...taskKeys.all, 'allPages', filters ?? {}] as const,
  detail: (id: string) => [...taskKeys.all, 'detail', id] as const,
};

export const useTasks = (params?: TaskFilters, options?: { enabled?: boolean }) => {
  return useQuery({
    queryKey: taskKeys.list(params),
    queryFn: () => tasksService.getAll(params),
    enabled: options?.enabled ?? true,
  });
};

/**
 * Fetches every page of `/tasks` for the given filter.
 *
 * The supervisor dashboards roll tasks up into counts and per-member matrices,
 * so a single page would under-report. Prefer this over `useTasks` anywhere a
 * total is displayed.
 */
export const useAllTasks = (
  params?: Omit<TaskFilters, 'page' | 'limit'>,
  options?: { enabled?: boolean },
) => {
  return useQuery({
    queryKey: taskKeys.allPages(params),
    queryFn: () => tasksService.getAllPages(params),
    enabled: options?.enabled ?? true,
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
