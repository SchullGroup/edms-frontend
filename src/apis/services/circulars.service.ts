import { Circular, PaginatedResponse, ApiResponse } from '@/types/models';
import { SEED } from '@/store/initialData';

export const circularsService = {
  getAll: async (): Promise<PaginatedResponse<Circular>> => {
    // TODO: Replace with actual API call when backend is ready
    await new Promise((resolve) => setTimeout(resolve, 400));

    return {
      success: true,
      message: 'Fetched circulars successfully',
      data: SEED.circulars as any,
      pagination: { page: 1, limit: 10, total: SEED.circulars.length, totalPages: 1 },
    };
  },

  create: async (data: any): Promise<Circular> => {
    await new Promise((resolve) => setTimeout(resolve, 400));
    return { ...data, id: `cir-${Date.now()}` } as Circular;
  },

  update: async (id: string, updates: Partial<Circular>): Promise<Circular> => {
    await new Promise((resolve) => setTimeout(resolve, 400));
    const circular = SEED.circulars.find((c: any) => c.id === id);
    return { ...circular, ...updates } as Circular;
  },

  acknowledge: async (id: string): Promise<void> => {
    await new Promise((resolve) => setTimeout(resolve, 400));
  },
};
