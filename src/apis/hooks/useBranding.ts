import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { brandingService } from '@/apis/services/branding.service';
import { Branding } from '@/types/models';
import { useUIStore } from '@/store/useUIStore';

export const brandingKeys = {
  all: ['branding'] as const,
  details: () => [...brandingKeys.all, 'detail'] as const,
};

export function useBranding() {
  return useQuery({
    queryKey: brandingKeys.details(),
    queryFn: () => brandingService.getBranding(),
  });
}

export function useUpdateBranding() {
  const queryClient = useQueryClient();
  const { addToast } = useUIStore.getState();

  return useMutation({
    mutationFn: (updates: Partial<Branding>) => brandingService.updateBranding(updates),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: brandingKeys.details() });
      addToast('Branding updated successfully', 'success');
    },
    onError: (err: any) => {
      addToast(err.response?.data?.message || 'Failed to update branding', 'error');
    },
  });
}
