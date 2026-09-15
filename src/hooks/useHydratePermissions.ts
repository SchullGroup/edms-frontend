import { useEffect } from 'react';
import { useStore } from '@/store/useStore';
import { useRoles } from '@/apis/hooks/useRoles';
import { derivePermissionsFromRoles, normalizePermission } from '@/lib/permissions';

/**
 * Fills gaps in `currentUser.permissions` from the permission keys attached to
 * the user's roles in `GET /roles`. Runs once from `AppShell`.
 *
 * The backend's `/auth/login` and `/auth/me` payloads now include a scoped
 * `resource:action:scope` `permissions` array (docs/01 DRIFT-03, resolved
 * 2026-09-15), which is the precise, per-user source of truth and is written to
 * the store directly (by the login flow and by `AppShell`'s `authService.me()`
 * callback). This hook only tops that up: it adds `resource:action` keys the
 * role grants but the live payload didn't include (e.g. a role was edited after
 * the user's last login/`/me` refresh) — it must never remove or replace an
 * existing entry, since that would silently drop the real scope information the
 * backend already gave us.
 */
export function useHydratePermissions() {
  const currentUser = useStore((s) => s.currentUser);
  const patchCurrentUser = useStore((s) => s.patchCurrentUser);

  const { data: roles } = useRoles({ enabled: !!currentUser });

  useEffect(() => {
    if (!currentUser || !roles?.length) return;

    const derived = derivePermissionsFromRoles(currentUser.roles, roles);
    if (derived.length === 0) return;

    const existing = currentUser.permissions ?? [];
    const current = new Set(existing.map(normalizePermission));
    const missing = derived.filter((p) => !current.has(p));

    if (missing.length > 0) patchCurrentUser({ permissions: [...existing, ...missing] });
  }, [currentUser, roles, patchCurrentUser]);
}
