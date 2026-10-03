import { routeConfig } from '@/config/routes.config';
import { normalizePermission, permissionMatches } from '@/lib/permissions';
import type { PermissionType } from '@/types/models';

export interface RouteAccessUser {
  roles: string[];
  permissions: string[];
}

export interface RouteAccessResult {
  /** Whether any rule in `routeConfig` applied to this path at all. */
  matched: boolean;
  /** Whether the user satisfies the matched rule (always `true` when unmatched). */
  allowed: boolean;
}

/**
 * The single source of truth for "can this user see this path" — pure and
 * environment-agnostic, so both the client-side `AppShell` guard (cosmetic)
 * and `middleware.ts` (the real, server-side gate) evaluate the exact same
 * rules against `routeConfig`. Previously duplicated inline in `AppShell`;
 * pulled out so the two can never drift apart.
 */
export function evaluateRouteAccess(pathname: string, user: RouteAccessUser): RouteAccessResult {
  const checkOne = (p: PermissionType): boolean => {
    const [resource, action] = normalizePermission(p).split(':');
    return user.permissions.some((granted) => permissionMatches(granted, resource, action));
  };

  for (const rule of routeConfig) {
    let match = false;
    if (rule.matchType === 'exact') {
      match = pathname === rule.path;
    } else if (rule.matchType === 'prefix') {
      const isExcluded = rule.exclude?.some((ex) => pathname.startsWith(ex));
      match = pathname.startsWith(rule.path) && !isExcluded;
    } else if (rule.matchType === 'whitelist') {
      const isIncluded = rule.include?.some((inc) => pathname.startsWith(inc));
      match = pathname === rule.path || !!isIncluded;
    }

    if (!match) continue;

    let allowed = true;
    if (rule.roles && rule.roles.length > 0) {
      allowed = user.roles.some((r) => rule.roles!.includes(r));
    }
    if (allowed && rule.anyPermissions && rule.anyPermissions.length > 0) {
      allowed = rule.anyPermissions.some(checkOne);
    }
    if (allowed && rule.permissions && rule.permissions.length > 0) {
      allowed = rule.permissions.every(checkOne);
    }

    return { matched: true, allowed };
  }

  return { matched: false, allowed: true };
}
