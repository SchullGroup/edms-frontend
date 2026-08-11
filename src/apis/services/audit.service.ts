import { AuditLog, PaginatedResponse } from '@/types/models';
import { SEED } from '@/store/initialData';

export const auditService = {
  getAll: async (): Promise<PaginatedResponse<AuditLog>> => {
    // TODO: Replace with actual API call when backend is ready
    await new Promise((resolve) => setTimeout(resolve, 400));

    return {
      success: true,
      message: 'Fetched audit logs successfully',
      data: SEED.audit as any,
      pagination: { page: 1, limit: 10, total: SEED.audit.length, totalPages: 1 },
    };
  },
};
