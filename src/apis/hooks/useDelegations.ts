import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  delegationsService,
  DelegationFilters,
} from '@/apis/services/delegations.service';
import { CreateDelegationRequest } from '@/types/models';
import { useUIStore } from '@/store/useUIStore';

export const delegationKeys = {
  all: ['delegations'] as const,
  lists: () => [...delegationKeys.all, 'list'] as const,
  list: (params: DelegationFilters = {}) => [...delegationKeys.lists(), params] as const,
  detail: (id: string) => [...delegationKeys.all, 'detail', id] as const,
  eligibleUsers: (search: string) => [...delegationKeys.all, 'eligible-users', search] as const,
};

/** People the caller may delegate to; `search` is sent only from 2 characters. */
export function useEligibleDelegates(search: string, options?: { enabled?: boolean }) {
  return useQuery({
    queryKey: delegationKeys.eligibleUsers(search),
    queryFn: () => delegationsService.getEligibleUsers(search || undefined),
    enabled: options?.enabled ?? true,
  });
}

export function useDelegations(params: DelegationFilters = {}) {
  return useQuery({
    queryKey: delegationKeys.list(params),
    queryFn: () => delegationsService.getAll(params),
  });
}

export function useDelegation(id?: string) {
  return useQuery({
    queryKey: delegationKeys.detail(id || ''),
    queryFn: () => delegationsService.getById(id as string),
    enabled: !!id,
  });
}

export function useCreateDelegation() {
  const queryClient = useQueryClient();
  const { addToast } = useUIStore.getState();

  return useMutation({
    mutationFn: (data: CreateDelegationRequest) => delegationsService.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: delegationKeys.lists() });
      addToast('Delegation created', 'success');
    },
    onError: (err: any) => {
      addToast(err.response?.data?.message || 'Failed to create delegation', 'error');
    },
  });
}

export function useEndDelegation() {
  const queryClient = useQueryClient();
  const { addToast } = useUIStore.getState();

  return useMutation({
    mutationFn: (id: string) => delegationsService.end(id),
    onSuccess: (_, id) => {
      queryClient.invalidateQueries({ queryKey: delegationKeys.lists() });
      queryClient.invalidateQueries({ queryKey: delegationKeys.detail(id) });
      addToast('Delegation ended', 'info');
    },
    onError: (err: any) => {
      addToast(err.response?.data?.message || 'Failed to end delegation', 'error');
    },
  });
}
