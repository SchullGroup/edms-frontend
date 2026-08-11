import { apiClient } from '@/lib/api-client';
import { WorkflowDefinition, PaginatedResponse, ApiResponse } from '@/types/models';
import { SEED } from '@/store/initialData';

export const workflowsService = {
  getAll: async (params?: Record<string, any>): Promise<PaginatedResponse<WorkflowDefinition>> => {
    await new Promise((resolve) => setTimeout(resolve, 400));
    return {
      success: true,
      message: 'Fetched workflows successfully',
      data: SEED.workflows as any,
      pagination: { page: 1, limit: 10, total: SEED.workflows.length, totalPages: 1 },
    };
  },

  getById: async (id: string): Promise<WorkflowDefinition> => {
    await new Promise((resolve) => setTimeout(resolve, 400));
    const workflow = SEED.workflows.find((w) => w.id === id);
    if (!workflow) throw new Error('Workflow not found');
    return workflow as any;
  },

  create: async (data: any): Promise<WorkflowDefinition> => {
    await new Promise((resolve) => setTimeout(resolve, 400));
    return { ...data, id: `wf-${Date.now()}`, version: 1, status: 'draft' } as WorkflowDefinition;
  },

  update: async (id: string, updates: Partial<WorkflowDefinition>): Promise<WorkflowDefinition> => {
    await new Promise((resolve) => setTimeout(resolve, 400));
    const workflow = SEED.workflows.find((w) => w.id === id);
    return { ...workflow, ...updates } as any;
  },

  publish: async (id: string): Promise<WorkflowDefinition> => {
    await new Promise((resolve) => setTimeout(resolve, 400));
    const workflow = SEED.workflows.find((w) => w.id === id);
    return { ...workflow, status: 'published' } as any;
  },

  archive: async (id: string): Promise<WorkflowDefinition> => {
    await new Promise((resolve) => setTimeout(resolve, 400));
    const workflow = SEED.workflows.find((w) => w.id === id);
    return { ...workflow, status: 'archived' } as any;
  },
};
