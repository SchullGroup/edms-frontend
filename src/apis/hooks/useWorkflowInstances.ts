import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  workflowInstancesService,
  BottlenecksAgeingParams,
  DepartmentScopedParams,
  WorkflowInstanceStatsParams,
} from '../services/workflowInstances.service';
import { CreateWorkflowInstanceRequest } from '@/types/models';
import { fetchAllPages } from '@/apis/utils/fetchAllPages';

/** Starting, holding, resuming or closing an instance moves the document's
 *  status and the task queues too, so every view that reads them is stale. */
const invalidateInstanceViews = (queryClient: ReturnType<typeof useQueryClient>) => {
  queryClient.invalidateQueries({ queryKey: ['workflowInstances'] });
  queryClient.invalidateQueries({ queryKey: ['workflowHistory'] });
  queryClient.invalidateQueries({ queryKey: ['tasks'] });
  queryClient.invalidateQueries({ queryKey: ['documents'] });
};

export const useWorkflowInstances = (
  params?: Record<string, any>,
  options?: { enabled?: boolean },
) => {
  return useQuery({
    queryKey: ['workflowInstances', params],
    queryFn: () => workflowInstancesService.getAll(params),
    enabled: options?.enabled ?? true,
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

export const useWorkflowInstance = (id: string | undefined) => {
  return useQuery({
    queryKey: ['workflowInstances', id],
    queryFn: () => workflowInstancesService.getById(id as string),
    enabled: !!id,
  });
};

export const useWorkflowInstanceStats = (
  params?: WorkflowInstanceStatsParams,
  options?: { enabled?: boolean },
) => {
  return useQuery({
    queryKey: ['workflowInstances', 'stats', params],
    queryFn: () => workflowInstancesService.getStats(params),
    enabled: options?.enabled ?? true,
  });
};

/** Staff Dashboard status tiles — Pending/In-Progress/Closed instance counts. */
export const useWorkflowInstanceStatusCounts = (
  scope: 'mine' | 'all' = 'mine',
  options?: { enabled?: boolean },
) => {
  return useQuery({
    queryKey: ['workflowInstances', 'statusCounts', scope],
    queryFn: () => workflowInstancesService.getStatusCounts(scope),
    enabled: options?.enabled ?? true,
  });
};

/** Supervisor Team Overview, by member. Omit `departmentId` for a supervisor. */
export const useTeamStatusMatrix = (
  params?: DepartmentScopedParams,
  options?: { enabled?: boolean },
) => {
  return useQuery({
    queryKey: ['workflowInstances', 'teamStatusMatrix', params],
    queryFn: () => workflowInstancesService.getTeamStatusMatrix(params),
    enabled: options?.enabled ?? true,
  });
};

/** Supervisor Team Overview, by cabinet. */
export const useOpenItemsByCabinet = (
  params?: DepartmentScopedParams,
  options?: { enabled?: boolean },
) => {
  return useQuery({
    queryKey: ['workflowInstances', 'openItemsByCabinet', params],
    queryFn: () => workflowInstancesService.getOpenItemsByCabinet(params),
    enabled: options?.enabled ?? true,
  });
};

/** Supervisor Bottlenecks & Ageing — summary, distributions and paginated rows. */
export const useBottlenecksAgeing = (
  params?: BottlenecksAgeingParams,
  options?: { enabled?: boolean },
) => {
  return useQuery({
    queryKey: ['workflowInstances', 'bottlenecksAgeing', params],
    queryFn: () => workflowInstancesService.getBottlenecksAgeing(params),
    enabled: options?.enabled ?? true,
  });
};

export const useCreateWorkflowInstance = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: CreateWorkflowInstanceRequest) => workflowInstancesService.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['workflowInstances'] });
    },
  });
};

/**
 * Creates a pending instance and immediately starts it — the two-step
 * `POST /workflow-instances` + `POST /workflow-instances/{id}/start` flow.
 */
export const useStartWorkflowInstance = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ workflowId, documentId }: { workflowId: string; documentId: string }) =>
      workflowInstancesService.createAndStart(workflowId, documentId),
    onSuccess: () => {
      invalidateInstanceViews(queryClient);
    },
  });
};

export const useHoldWorkflowInstance = () => {
  const queryClient = useQueryClient();

  return useMutation({
    // `reason` is accepted for call-site compatibility but the endpoint takes no body.
    mutationFn: ({ id }: { id: string; reason?: string }) => workflowInstancesService.hold(id),
    onSuccess: () => {
      invalidateInstanceViews(queryClient);
    },
  });
};

export const useResumeWorkflowInstance = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => workflowInstancesService.resume(id),
    onSuccess: () => {
      invalidateInstanceViews(queryClient);
    },
  });
};

export const useCloseWorkflowInstance = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => workflowInstancesService.close(id),
    onSuccess: () => {
      invalidateInstanceViews(queryClient);
    },
  });
};
