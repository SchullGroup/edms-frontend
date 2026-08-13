import { Branding, ApiResponse } from '@/types/models';
import { SEED } from '@/store/initialData';

export const brandingService = {
  getBranding: async (): Promise<Branding> => {
    // TODO: Replace with actual API call when backend is ready
    await new Promise((resolve) => setTimeout(resolve, 400));
    return SEED.branding as Branding;
  },

  updateBranding: async (updates: Partial<Branding>): Promise<Branding> => {
    await new Promise((resolve) => setTimeout(resolve, 400));
    return { ...SEED.branding, ...updates } as Branding;
  },
};
