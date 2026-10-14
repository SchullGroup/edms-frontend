import { useStore } from '@/store/useStore';

/**
 * The signed-in user's department, carried by `POST /auth/login` and
 * `GET /auth/me` (`edms-backend` PR #50/#51) — the login page stores it and
 * AppShell refreshes it. `known` is false until one of those has answered;
 * `departmentId` is then the id, or null for a user with no department.
 */
export function useMyDepartmentId(): { departmentId: string | null; known: boolean } {
  const departmentId = useStore((s) => s.currentUser?.departmentId);
  return { departmentId: departmentId ?? null, known: departmentId !== undefined };
}
