import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  controlExceptionsService,
  ControlExceptionFilters,
  ControlExceptionListParams,
} from '@/apis/services/controlExceptions.service';
import { ControlExceptionInput } from '@/types/models';
import { useUIStore } from '@/store/useUIStore';

export const controlExceptionKeys = {
  all: ['control-exceptions'] as const,
  lists: () => [...controlExceptionKeys.all, 'list'] as const,
  list: (params: ControlExceptionListParams = {}) =>
    [...controlExceptionKeys.lists(), params] as const,
  report: (params: ControlExceptionFilters = {}) =>
    [...controlExceptionKeys.all, 'report', params] as const,
  detail: (id: string) => [...controlExceptionKeys.all, 'detail', id] as const,
};

const errorMessage = (err: any, fallback: string) => err?.response?.data?.message || fallback;

export function useControlExceptions(
  params: ControlExceptionListParams = {},
  options?: { enabled?: boolean },
) {
  return useQuery({
    queryKey: controlExceptionKeys.list(params),
    queryFn: () => controlExceptionsService.getAll(params),
    enabled: options?.enabled ?? true,
  });
}

export function useControlExceptionReport(params: ControlExceptionFilters = {}) {
  return useQuery({
    queryKey: controlExceptionKeys.report(params),
    queryFn: () => controlExceptionsService.getReport(params),
  });
}

export function useControlException(id?: string) {
  return useQuery({
    queryKey: controlExceptionKeys.detail(id || ''),
    queryFn: () => controlExceptionsService.getById(id as string),
    enabled: !!id,
  });
}

/** Every write changes a status or a field the list and report show. */
function useControlExceptionMutation<V, R>(
  fn: (vars: V) => Promise<R>,
  success: string,
  failure: string,
) {
  const queryClient = useQueryClient();
  const { addToast } = useUIStore.getState();
  return useMutation({
    mutationFn: fn,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: controlExceptionKeys.all });
      addToast(success, 'success');
    },
    onError: (err: any) => {
      addToast(errorMessage(err, failure), 'error');
    },
  });
}

export function useCreateControlException() {
  return useControlExceptionMutation(
    (data: ControlExceptionInput) => controlExceptionsService.create(data),
    'Exception raised',
    'Failed to raise exception',
  );
}

export function useUpdateControlException() {
  return useControlExceptionMutation(
    ({ id, data }: { id: string; data: Partial<ControlExceptionInput> }) =>
      controlExceptionsService.update(id, data),
    'Exception updated',
    'Failed to update exception',
  );
}

export function useReportControlException() {
  return useControlExceptionMutation(
    (id: string) => controlExceptionsService.report(id),
    'Reported to the permanent secretary',
    'Failed to report exception',
  );
}

export function useAcknowledgeControlException() {
  return useControlExceptionMutation(
    (id: string) => controlExceptionsService.acknowledge(id),
    'Exception acknowledged',
    'Failed to acknowledge exception',
  );
}

export function useResolveControlException() {
  return useControlExceptionMutation(
    ({ id, resolutionNote }: { id: string; resolutionNote: string }) =>
      controlExceptionsService.resolve(id, resolutionNote),
    'Exception resolved',
    'Failed to resolve exception',
  );
}
