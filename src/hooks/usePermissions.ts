import { useCallback, useMemo } from 'react';
import { useStore } from '@/store/useStore';
import {
  fallbackPermissionsForRoles,
  normalizePermission,
  parseScope,
  permissionMatches,
  resolvePortal,
  type PermissionScope,
  type PortalKey,
} from '@/lib/permissions';

/**
 * Permission-aware access checks for the UI.
 *
 * Source of truth is `currentUser.permissions` — populated at login (if the
 * backend embeds it) and refreshed from `GET /auth/me` (see `AppShell`'s
 * session-verify effect) or on token refresh. A role's permission changes
 * reach a user the next time one of those happens, not live — if none of
 * them have resolved yet we fall back to an approximate grant set for the six
 * seeded system roles so the app is usable during the first render.
 */
export const usePermissions = () => {
  const currentUser = useStore((s) => s.currentUser);

  const { granted, isReady } = useMemo(() => {
    const roleNames = currentUser?.roles ?? [];
    const live = (currentUser?.permissions ?? []).map(normalizePermission);
    if (live.length > 0) {
      return { granted: live, isReady: true };
    }
    // No live permissions yet — approximate from the seeded system roles. That
    // approximation is only trustworthy for the six built-in roles; a custom
    // role has no fallback, so it stays "not ready" until `currentUser.permissions`
    // arrives from a live `/auth/me` call, login, or token refresh.
    const fallback = fallbackPermissionsForRoles(roleNames);
    return { granted: fallback, isReady: fallback.length > 0 };
  }, [currentUser]);

  const grantedSet = useMemo(() => new Set(granted), [granted]);

  // Stable identity while the grant set is unchanged, so effects that depend on
  // it (e.g. the AppShell route guard) don't re-run on every render.
  const hasPermission = useCallback(
    (resource: string, action: string): boolean => {
      if (!currentUser) return false;
      for (const g of grantedSet) {
        if (permissionMatches(g, resource, action)) return true;
      }
      return false;
    },
    [grantedSet, currentUser],
  );

  const hasAny = useCallback(
    (pairs: [string, string][]): boolean => pairs.some(([r, a]) => hasPermission(r, a)),
    [hasPermission],
  );

  const hasAll = useCallback(
    (pairs: [string, string][]): boolean => pairs.every(([r, a]) => hasPermission(r, a)),
    [hasPermission],
  );

  /** Most permissive scope held for a `resource:action`, or null. */
  const scopeFor = (resource: string, action: string): PermissionScope | null => {
    const order: PermissionScope[] = ['own', 'department', 'global'];
    let best: PermissionScope | null = null;
    for (const p of currentUser?.permissions ?? []) {
      if (!permissionMatches(normalizePermission(p), resource, action)) continue;
      const s = parseScope(p);
      if (s && (best === null || order.indexOf(s) > order.indexOf(best))) best = s;
    }
    return best;
  };

  const portal: PortalKey = useMemo(
    () => resolvePortal(granted, currentUser?.roles),
    [granted, currentUser],
  );

  return {
    hasPermission,
    can: hasPermission,
    hasAny,
    hasAll,
    scopeFor,
    isReady,
    portal,
    /** The resolved grant set (live if available, else the pre-hydration
     *  fallback) — what `AppShell`'s route guard passes into
     *  `evaluateRouteAccess` (`@/lib/routeAccess`), the same function
     *  `middleware.ts` uses server-side. */
    granted,
  };
};
