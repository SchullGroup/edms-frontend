import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { tasksService, TaskFilters, TaskStatsParams } from '../services/tasks.service';
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

export const useTasks = (params?: TaskFilters) => {
  return useQuery({
    queryKey: taskKeys.list(params),
    queryFn: () => tasksService.getAll(params),
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
