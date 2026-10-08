import { useStore } from '@/store/useStore';
import { useCabinet } from '@/apis/hooks/useCabinets';
import type { CabinetAccessPermission } from '@/types/models';

/**
 * Per-cabinet access levels, weakest first. Each level includes every level
 * below it — same ladder as the backend's `PERMISSION_HIERARCHY` in
 * `cabinet-access.middleware.ts`.
 */
export const CABINET_ACCESS_LEVELS: { value: CabinetAccessPermission; label: string }[] = [
  { value: 'view', label: 'View' },
  { value: 'upload', label: 'Upload' },
  { value: 'edit', label: 'Edit' },
  { value: 'route', label: 'Route' },
  { value: 'export', label: 'Export' },
  { value: 'delete', label: 'Delete' },
];

/** The one role that skips per-cabinet grants on the API (`CABINET_ACCESS_BYPASS_ROLES`). */
export const CABINET_BYPASS_ROLE = 'client_admin';

const rank = (level: CabinetAccessPermission | null | undefined) =>
  level ? CABINET_ACCESS_LEVELS.findIndex((l) => l.value === level) : -1;

/** Whether `level` reaches `min`. A null level (unknown or none) reaches nothing. */
export function cabinetAllows(
  level: CabinetAccessPermission | null | undefined,
  min: CabinetAccessPermission,
): boolean {
  return rank(level) >= rank(min);
}

/** The levels a caller may hand out — never above their own. */
export function grantableLevels(level: CabinetAccessPermission | null | undefined) {
  return CABINET_ACCESS_LEVELS.filter((l) => rank(l.value) <= rank(level));
}

/**
 * The current user's level on one cabinet, worked out the way the API's
 * `requireCabinetAccess` does: a client_admin has every level; otherwise the
 * strongest grant made to the user or to one of their roles; with no grant, a
 * cabinet they can open at all gives `view` (org-wide or own-department).
 *
 * Grants come embedded in `GET /cabinets/{id}` (`access`) — the list doesn't
 * carry them — so this reads the same cached detail query the page already uses
 * for the metadata schema. Returns null while that loads, so gated actions stay
 * hidden rather than flashing in.
 *
 * Every cabinet action needs this level *and* the matching role permission
 * (`can(...)`); the API checks both, so the UI shows an action only when both pass.
 */
export function useMyCabinetAccess(cabinetId: string | null | undefined) {
  const currentUser = useStore((s) => s.currentUser);
  const { data: cabinet } = useCabinet(cabinetId || undefined);

  if (!currentUser) return null;
  if (currentUser.roles?.includes(CABINET_BYPASS_ROLE)) return 'delete';
  if (!cabinet) return null;

  const myRoles = new Set(currentUser.roles ?? []);
  const mine = (cabinet.access ?? []).filter(
    (g) => g.userId === currentUser.id || (!!g.role?.name && myRoles.has(g.role.name)),
  );
  if (mine.length === 0) return 'view';
  return mine.reduce<CabinetAccessPermission>(
    (best, g) => (rank(g.permission) > rank(best) ? g.permission : best),
    'view',
  );
}
