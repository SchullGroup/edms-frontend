import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  departmentsService,
  DepartmentFilters,
} from '@/apis/services/departments.service';
import { CreateDepartmentRequest, UpdateDepartmentRequest } from '@/types/models';
import { useUIStore } from '@/store/useUIStore';

export const departmentKeys = {
  all: ['departments'] as const,
  lists: () => [...departmentKeys.all, 'list'] as const,
  list: (params: DepartmentFilters = {}) => [...departmentKeys.lists(), params] as const,
  detail: (id: string) => [...departmentKeys.all, 'detail', id] as const,
};

export function useDepartments(params: DepartmentFilters = {}) {
  return useQuery({
    queryKey: departmentKeys.list(params),
    queryFn: () => departmentsService.getAll(params),
  });
}

export function useDepartment(id: string) {
  return useQuery({
    queryKey: departmentKeys.detail(id),
    queryFn: () => departmentsService.getById(id),
    enabled: !!id,
  });
}

export function useCreateDepartment() {
  const queryClient = useQueryClient();
  const { addToast } = useUIStore.getState();

  return useMutation({
    mutationFn: (data: CreateDepartmentRequest) => departmentsService.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: departmentKeys.lists() });
      addToast('Department created successfully', 'success');
    },
    onError: (err: any) => {
      addToast(err.response?.data?.message || 'Failed to create department', 'error');
    },
  });
}

export function useUpdateDepartment() {
  const queryClient = useQueryClient();
  const { addToast } = useUIStore.getState();

  return useMutation({
    mutationFn: ({ id, updates }: { id: string; updates: UpdateDepartmentRequest }) =>
      departmentsService.update(id, updates),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: departmentKeys.lists() });
      queryClient.invalidateQueries({ queryKey: departmentKeys.detail(data.id) });
      addToast('Department updated successfully', 'success');
    },
    onError: (err: any) => {
      addToast(err.response?.data?.message || 'Failed to update department', 'error');
    },
  });
}

export function useDeleteDepartment() {
  const queryClient = useQueryClient();
  const { addToast } = useUIStore.getState();

  return useMutation({
    mutationFn: (id: string) => departmentsService.delete(id),
    onSuccess: (_, id) => {
      queryClient.invalidateQueries({ queryKey: departmentKeys.lists() });
      queryClient.removeQueries({ queryKey: departmentKeys.detail(id) });
      addToast('Department deleted successfully', 'success');
    },
    onError: (err: any) => {
      // 409 = the department still has users or cabinets attached.
      addToast(
        err.response?.data?.message ||
          (err.response?.status === 409
            ? 'This department still has users or cabinets attached'
            : 'Failed to delete department'),
        'error',
      );
    },
  });
}
