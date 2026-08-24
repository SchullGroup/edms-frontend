import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { workflowInstancesService } from '../services/workflowInstances.service';
import { fetchAllPages } from '@/apis/utils/fetchAllPages';

export const useWorkflowInstances = (params?: Record<string, any>) => {
  return useQuery({
    queryKey: ['workflowInstances', params],
    queryFn: () => workflowInstancesService.getAll(params),
  });
};

/**
 * INTERIM STOPGAP for pages that need the full workflow-instance set
 * (management dashboards). Loops every page — see fetchAllPages.ts for why
 * this exists and why it should be replaced once the backend has
 * aggregation endpoints.
 */
export const useAllWorkflowInstances = (params: Record<string, any> = {}) => {
  return useQuery({
    queryKey: ['workflowInstances', 'all', params],
    queryFn: () => fetchAllPages(workflowInstancesService.getAll, params),
  });
};

export const useWorkflowInstance = (id: string) => {
  return useQuery({
    queryKey: ['workflowInstances', id],
    queryFn: () => workflowInstancesService.getById(id),
    enabled: !!id,
  });
};

export const useStartWorkflowInstance = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ workflowId, documentId }: { workflowId: string; documentId: string }) =>
      workflowInstancesService.start(workflowId, documentId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['workflowInstances'] });
    },
  });
};

export const useHoldWorkflowInstance = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, reason }: { id: string; reason?: string }) =>
      workflowInstancesService.hold(id, reason),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['workflowInstances'] });
    },
  });
};

export const useResumeWorkflowInstance = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => workflowInstancesService.resume(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['workflowInstances'] });
    },
  });
};

export const useCloseWorkflowInstance = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => workflowInstancesService.close(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['workflowInstances'] });
    },
  });
};
