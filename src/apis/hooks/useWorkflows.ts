import { useQuery, useMutation, useQueryClient, keepPreviousData } from '@tanstack/react-query';
import { workflowsService } from '@/apis/services/workflows.service';
import { WorkflowDefinition } from '@/types/models';
import { useUIStore } from '@/store/useUIStore';

export const workflowKeys = {
  all: ['workflows'] as const,
  lists: () => [...workflowKeys.all, 'list'] as const,
  list: (filters: Record<string, any>) => [...workflowKeys.lists(), filters] as const,
  details: () => [...workflowKeys.all, 'detail'] as const,
  detail: (id: string) => [...workflowKeys.details(), id] as const,
};

/** A 422 says only "Validation failed" in `message`; the reason — e.g. "Parallel
 *  stage 'a' has converging branches but no join: 'all' stage" — is in `errors`. */
const saveErrorMessage = (err: any, fallback: string) =>
  err?.response?.data?.errors?.[0]?.message || err?.response?.data?.message || fallback;

export function useWorkflows(filters: Record<string, any> = {}) {
  return useQuery({
    queryKey: workflowKeys.list(filters),
    queryFn: () => workflowsService.getAll(filters),
    // A new tab, search or page keeps the current rows up until it arrives.
    placeholderData: keepPreviousData,
  });
}

export function useWorkflow(id: string) {
  return useQuery({
    queryKey: workflowKeys.detail(id),
    queryFn: () => workflowsService.getById(id),
    enabled: !!id,
  });
}

export function useCreateWorkflow() {
  const queryClient = useQueryClient();
  const { addToast } = useUIStore.getState();

  return useMutation({
    mutationFn: (data: any) => workflowsService.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: workflowKeys.lists() });
      addToast('Workflow created successfully', 'success');
    },
    onError: (err: any) => {
      addToast(saveErrorMessage(err, 'Failed to create workflow'), 'error');
    },
  });
}

export function useUpdateWorkflow() {
  const queryClient = useQueryClient();
  const { addToast } = useUIStore.getState();

  return useMutation({
    mutationFn: ({ id, updates }: { id: string; updates: Partial<WorkflowDefinition> }) =>
      workflowsService.update(id, updates),
    onSuccess: (data, { id }) => {
      queryClient.invalidateQueries({ queryKey: workflowKeys.detail(id) });
      queryClient.invalidateQueries({ queryKey: workflowKeys.lists() });
      addToast('Workflow updated successfully', 'success');
    },
    onError: (err: any) => {
      addToast(saveErrorMessage(err, 'Failed to update workflow'), 'error');
    },
  });
}

export function usePublishWorkflow() {
  const queryClient = useQueryClient();
  const { addToast } = useUIStore.getState();

  return useMutation({
    mutationFn: (id: string) => workflowsService.publish(id),
    onSuccess: (_, id) => {
      queryClient.invalidateQueries({ queryKey: workflowKeys.detail(id) });
      queryClient.invalidateQueries({ queryKey: workflowKeys.lists() });
      addToast('Workflow published successfully', 'success');
    },
    onError: (err: any) => {
      addToast(err.response?.data?.message || 'Failed to publish workflow', 'error');
    },
  });
}

export function useArchiveWorkflow() {
  const queryClient = useQueryClient();
  const { addToast } = useUIStore.getState();

  return useMutation({
    mutationFn: (id: string) => workflowsService.archive(id),
    onSuccess: (_, id) => {
      queryClient.invalidateQueries({ queryKey: workflowKeys.detail(id) });
      queryClient.invalidateQueries({ queryKey: workflowKeys.lists() });
      addToast('Workflow archived', 'success');
    },
    onError: (err: any) => {
      addToast(err.response?.data?.message || 'Failed to archive workflow', 'error');
    },
  });
}

export function useDeleteWorkflow() {
  const queryClient = useQueryClient();
  const { addToast } = useUIStore.getState();

  return useMutation({
    mutationFn: (id: string) => workflowsService.deleteDraft(id),
    onSuccess: (_, id) => {
      queryClient.removeQueries({ queryKey: workflowKeys.detail(id) });
      queryClient.invalidateQueries({ queryKey: workflowKeys.lists() });
      addToast('Draft deleted', 'success');
    },
    onError: (err: any) => {
      addToast(err.response?.data?.message || 'Failed to delete the draft', 'error');
    },
  });
}

export function useUnarchiveWorkflow() {
  const queryClient = useQueryClient();
  const { addToast } = useUIStore.getState();

  return useMutation({
    mutationFn: (id: string) => workflowsService.unarchive(id),
    onSuccess: (_, id) => {
      queryClient.invalidateQueries({ queryKey: workflowKeys.detail(id) });
      queryClient.invalidateQueries({ queryKey: workflowKeys.lists() });
      addToast('Workflow unarchived — it can be routed to again', 'success');
    },
    onError: (err: any) => {
      // The 422 names the missing department by id, so say what to do instead.
      const message =
        err.response?.status === 422
          ? "Can't unarchive: a stage's department no longer exists. Clone the workflow, " +
            'fix that stage in the copy and publish the copy.'
          : err.response?.data?.message || 'Failed to unarchive workflow';
      addToast(message, 'error');
    },
  });
}
