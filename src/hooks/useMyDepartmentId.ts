import { useStore } from '@/store/useStore';

/**
 * The signed-in user's department, from `GET /auth/me` (edms-backend PR #50),
 * which AppShell copies into the store. `known` is false until that call has
 * answered (login doesn't carry it); `departmentId` is then the id, or null for
 * a user with no department.
 */
export function useMyDepartmentId(): { departmentId: string | null; known: boolean } {
  const departmentId = useStore((s) => s.currentUser?.departmentId);
  return { departmentId: departmentId ?? null, known: departmentId !== undefined };
}
