import { apiClient } from '@/lib/api-client';
import { toFileFetchError } from './files.service';
import type { ApiResponse, WatermarkFields, WatermarkSettings } from '@/types/models';

/** Every route needs `workflow:edit` at global scope, the read included. */
export const watermarkSettingsService = {
  get: async (): Promise<WatermarkSettings> => {
    const response = await apiClient.get<ApiResponse<WatermarkSettings>>('/settings/watermark');
    return response.data.data;
  },

  /** At least one field must be on (422 otherwise). */
  update: async (fields: WatermarkFields): Promise<WatermarkSettings> => {
    const response = await apiClient.put<ApiResponse<WatermarkSettings>>(
      '/settings/watermark',
      fields,
    );
    return response.data.data;
  },

  reset: async (): Promise<WatermarkSettings> => {
    const response = await apiClient.post<ApiResponse<WatermarkSettings>>(
      '/settings/watermark/reset',
    );
    return response.data.data;
  },

  /** A sample PDF marked with these fields; nothing is saved. */
  preview: async (fields: WatermarkFields): Promise<Blob> => {
    try {
      const response = await apiClient.post<Blob>('/settings/watermark/preview', fields, {
        responseType: 'blob',
      });
      return response.data;
    } catch (err) {
      throw await toFileFetchError(err);
    }
  },
};
