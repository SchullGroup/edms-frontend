import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { watermarkSettingsService } from '../services/watermark-settings.service';
import { useUIStore } from '@/store/useUIStore';
import type { WatermarkSettings } from '@/types/models';

const watermarkSettingsKey = ['settings', 'watermark'] as const;

export const useWatermarkSettings = () =>
  useQuery({ queryKey: watermarkSettingsKey, queryFn: watermarkSettingsService.get });

/** Shared by save and reset: both answer with the settings now in force. */
function useSaved<T>(
  mutationFn: (input: T) => Promise<WatermarkSettings>,
  done: string,
  failed: string,
) {
  const queryClient = useQueryClient();
  const { addToast } = useUIStore.getState();
  return useMutation({
    mutationFn,
    onSuccess: (data) => {
      queryClient.setQueryData(watermarkSettingsKey, data);
      addToast(done, 'success');
    },
    onError: (err: any) => {
      addToast(err.response?.data?.message || failed, 'error');
    },
  });
}

export const useUpdateWatermarkSettings = () =>
  useSaved(
    watermarkSettingsService.update,
    'Watermark settings saved',
    'Failed to save watermark settings',
  );

export const useResetWatermarkSettings = () =>
  useSaved<void>(
    () => watermarkSettingsService.reset(),
    'Watermark settings reset to defaults',
    'Failed to reset watermark settings',
  );

export const useWatermarkPreview = () =>
  useMutation({ mutationFn: watermarkSettingsService.preview });
