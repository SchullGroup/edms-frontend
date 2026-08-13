import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { circularsService } from '@/apis/services/circulars.service';
import { Circular } from '@/types/models';
import { useUIStore } from '@/store/useUIStore';

export const circularKeys = {
  all: ['circulars'] as const,
  lists: () => [...circularKeys.all, 'list'] as const,
  list: () => [...circularKeys.lists()] as const,
};

export function useCirculars() {
  return useQuery({
    queryKey: circularKeys.list(),
    queryFn: () => circularsService.getAll(),
  });
}

export function useCreateCircular() {
  const queryClient = useQueryClient();
  const { addToast } = useUIStore.getState();

  return useMutation({
    mutationFn: (data: any) => circularsService.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: circularKeys.lists() });
      addToast('Circular created successfully', 'success');
    },
    onError: (err: any) => {
      addToast(err.response?.data?.message || 'Failed to create circular', 'error');
    },
  });
}

export function useUpdateCircular() {
  const queryClient = useQueryClient();
  const { addToast } = useUIStore.getState();

  return useMutation({
    mutationFn: ({ id, updates }: { id: string; updates: Partial<Circular> }) =>
      circularsService.update(id, updates),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: circularKeys.lists() });
      addToast('Circular updated successfully', 'success');
    },
    onError: (err: any) => {
      addToast(err.response?.data?.message || 'Failed to update circular', 'error');
    },
  });
}

export function useAcknowledgeCircular() {
  const queryClient = useQueryClient();
  const { addToast } = useUIStore.getState();

  return useMutation({
    mutationFn: (id: string) => circularsService.acknowledge(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: circularKeys.lists() });
      addToast('Circular acknowledged successfully', 'success');
    },
    onError: (err: any) => {
      addToast(err.response?.data?.message || 'Failed to acknowledge circular', 'error');
    },
  });
}
