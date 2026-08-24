import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { cabinetsService } from '@/apis/services/cabinets.service';
import { Cabinet } from '@/types/models';
import { useUIStore } from '@/store/useUIStore';

export const cabinetKeys = {
  all: ['cabinets'] as const,
  lists: () => [...cabinetKeys.all, 'list'] as const,
  list: (params: Record<string, any> = {}) => [...cabinetKeys.lists(), params] as const,
};

// GET /cabinets is not paginated (verified against the live backend — no
// `pagination` key in the response), so a single useCabinets() call already
// returns the full set. No useAllCabinets/fetchAllPages needed here.
export function useCabinets(params: Record<string, any> = {}) {
  return useQuery({
    queryKey: cabinetKeys.list(params),
    queryFn: () => cabinetsService.getAll(params),
  });
}

export function useCreateCabinet() {
  const queryClient = useQueryClient();
  const { addToast } = useUIStore.getState();

  return useMutation({
    mutationFn: (data: any) => cabinetsService.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: cabinetKeys.lists() });
      addToast('Cabinet created successfully', 'success');
    },
    onError: (err: any) => {
      addToast(err.response?.data?.message || 'Failed to create cabinet', 'error');
    },
  });
}

export function useUpdateCabinet() {
  const queryClient = useQueryClient();
  const { addToast } = useUIStore.getState();

  return useMutation({
    mutationFn: ({ id, updates }: { id: string; updates: Partial<Cabinet> }) =>
      cabinetsService.update(id, updates),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: cabinetKeys.lists() });
      addToast('Cabinet updated successfully', 'success');
    },
    onError: (err: any) => {
      addToast(err.response?.data?.message || 'Failed to update cabinet', 'error');
    },
  });
}
