import { Policy, ApiResponse } from '@/types/models';
import { SEED } from '@/store/initialData';

export const policiesService = {
  getPolicies: async (): Promise<Policy> => {
    // TODO: Replace with actual API call when backend is ready
    await new Promise((resolve) => setTimeout(resolve, 400));

    return SEED.policies as unknown as Policy;
  },

  updateControl: async (ruleName: string, enabled: boolean): Promise<void> => {
    await new Promise((resolve) => setTimeout(resolve, 400));
  },

  updateConfidentiality: async (level: string, updates: any): Promise<void> => {
    await new Promise((resolve) => setTimeout(resolve, 400));
  },

  updateUrgency: async (level: string, updates: any): Promise<void> => {
    await new Promise((resolve) => setTimeout(resolve, 400));
  },
};
