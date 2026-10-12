import { Branding } from '@/types/models';
import { useStore } from '@/store/useStore';

// No branding API exists yet. Until it does, branding lives in the app's
// persisted store — the same copy `AppShell` and the sidebar theme from — so a
// save applies across the app and survives a reload, in this browser only.
// Swap these two for `apiClient` calls when the backend ships the endpoints.
export const brandingService = {
  getBranding: async (): Promise<Branding> => {
    return useStore.getState().branding as Branding;
  },

  updateBranding: async (updates: Partial<Branding>): Promise<Branding> => {
    useStore.getState().updateBranding(updates);
    return useStore.getState().branding as Branding;
  },
};
