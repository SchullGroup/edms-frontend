import { PermissionType } from '@/types/models';

export interface RouteRule {
  path: string;
  matchType: 'exact' | 'prefix' | 'whitelist';
  /** Fallback / exception gate by role name. Only used where no permission key
   *  fits — currently just `/platform` (there is no `platform` resource). */
  roles?: string[];
  /** ALL of these `resource:action` keys are required. */
  permissions?: PermissionType[];
  /** AT LEAST ONE of these `resource:action` keys is required. */
  anyPermissions?: PermissionType[];
  exclude?: string[];
  include?: string[];
}

export const routeConfig: RouteRule[] = [
  // 1. PREFIX: Match the base path and ALL subroutes
  {
    path: '/platform',
    matchType: 'prefix',
    // No `platform` resource in the permission vocabulary; vendor-only + Phase-2
    // mock data, so this one stays role-gated by design.
    roles: ['schulltech_admin'],
  },

  // 2. WHITELIST: Match the base path, and ONLY explicitly included subroutes
  {
    path: '/management',
    matchType: 'whitelist',
    anyPermissions: ['dashboard:view'],
    include: [
      '/management/reports',
      '/management/compliance',
      '/management/departments',
      '/management/trends',
      '/management/performance',
      '/management/findings',
    ],
  },

  // 3. PREFIX: Match the base path and ALL subroutes, minus exclusions
  {
    path: '/staff',
    matchType: 'prefix',
    anyPermissions: ['document:view', 'dashboard:view'],
    exclude: ['/staff/restricted-example'], // Add explicit exceptions here if needed
  },

  // High-level portals
  {
    path: '/admin',
    matchType: 'prefix',
    anyPermissions: [
      'user:create',
      'user:edit',
      'user:delete',
      'role:view',
      'role:edit',
      'cabinet:create',
      'workflow:create',
    ],
  },

  {
    path: '/auditor',
    matchType: 'prefix',
    anyPermissions: ['audit:view'],
  },

  {
    path: '/supervisor',
    matchType: 'prefix',
    anyPermissions: ['workflow:route'],
  },

  // 4. Global authenticated paths (no gate = any authenticated user)
  { path: '/search', matchType: 'prefix' },
  { path: '/circulars', matchType: 'prefix' },
  { path: '/notifications', matchType: 'prefix' },
  { path: '/delegations', matchType: 'prefix' },
  { path: '/doc', matchType: 'prefix' }, // viewing a document
  {
    path: '/upload',
    matchType: 'prefix',
    anyPermissions: ['document:create'],
  },
];
