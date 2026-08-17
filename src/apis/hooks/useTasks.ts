import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { tasksService } from '../services/tasks.service';
import { TaskActionRequest } from '@/types/models';

export const useTasks = (params?: Record<string, any>) => {
  return useQuery({
    queryKey: ['tasks', params],
    queryFn: () => tasksService.getAll(params),
  });
};

export const useTask = (id: string) => {
  return useQuery({
    queryKey: ['tasks', id],
    queryFn: () => tasksService.getById(id),
    enabled: !!id,
  });
};

export const useTaskAction = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, actionReq }: { id: string; actionReq: TaskActionRequest }) =>
      tasksService.action(id, actionReq),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tasks'] });
      queryClient.invalidateQueries({ queryKey: ['workflowInstances'] });
    },
  });
};

export const useReassignTask = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, assigneeId }: { id: string; assigneeId: string }) =>
      tasksService.reassign(id, assigneeId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tasks'] });
    },
  });
};
