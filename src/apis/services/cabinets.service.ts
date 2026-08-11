import { Cabinet, PaginatedResponse, ApiResponse } from '@/types/models';
import { SEED } from '@/store/initialData';

export const cabinetsService = {
  getAll: async (): Promise<PaginatedResponse<Cabinet>> => {
    // TODO: Replace with actual API call when backend is ready
    // const res = await apiClient.get<PaginatedResponse<Cabinet>>('/cabinets');
    // return res.data;

    await new Promise((resolve) => setTimeout(resolve, 400)); // Simulate latency

    return {
      success: true,
      message: 'Fetched cabinets successfully',
      data: SEED.cabinets as any,
      pagination: { page: 1, limit: 10, total: SEED.cabinets.length, totalPages: 1 },
    };
  },

  create: async (data: any): Promise<Cabinet> => {
    await new Promise((resolve) => setTimeout(resolve, 400));
    return { ...data, id: `cab-${Date.now()}` } as Cabinet;
  },

  update: async (id: string, updates: Partial<Cabinet>): Promise<Cabinet> => {
    await new Promise((resolve) => setTimeout(resolve, 400));
    const cabinet = SEED.cabinets.find((c) => c.id === id);
    return { ...cabinet, ...updates } as Cabinet;
  },
};
