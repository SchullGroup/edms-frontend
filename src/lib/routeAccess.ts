import { routeConfig } from '@/config/routes.config';
import { normalizePermission, parseScope, permissionMatches, scopeAtLeast } from '@/lib/permissions';
import type { PermissionType } from '@/types/models';

export interface RouteAccessUser {
  roles: string[];
  /** `"resource:action"` keys (scope dropped). */
  permissions: string[];
  /** The raw `"resource:action:scope"` grants, for rules with a `minScope`.
   *  Omitted or scope-less (the role-based approximation before `/auth/me`
   *  answers), a `minScope` check passes rather than bouncing someone to
   *  `/unauthorized` on first paint; the backend still enforces the scope. */
  scopedPermissions?: string[];
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
    if (!user.permissions.some((granted) => permissionMatches(granted, resource, action))) {
      return false;
    }
    const minScope = typeof p === 'string' ? undefined : p.minScope;
    if (!minScope) return true;
    const scopes = (user.scopedPermissions ?? [])
      .filter((granted) => permissionMatches(granted, resource, action))
      .map(parseScope)
      .filter((s) => s !== null);
    if (scopes.length === 0) return true;
    return scopes.some((s) => scopeAtLeast(s, minScope));
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
