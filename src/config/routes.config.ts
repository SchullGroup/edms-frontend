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
  //
  // `dashboard:view` was never a real backend resource — no role could ever
  // be granted it — so this gate could never be satisfied once real
  // permissions (not the pre-hydration fallback) are in `currentUser.permissions`.
  // Gated instead on the union of what these pages actually fetch:
  // `document:view` (Org Overview, Departments, Trends), `workflow_instance:view`
  // (all of them), `task:view` (Org Overview, Departments, Performance) and
  // `department:view` (Departments). Any one is enough to open the section —
  // individual widgets that need a permission the user lacks hide themselves
  // via `hasPermission`/`Guard`, they don't block the whole page.
  {
    path: '/management',
    matchType: 'whitelist',
    anyPermissions: ['document:view', 'workflow_instance:view', 'task:view', 'department:view'],
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
    anyPermissions: ['document:view'],
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

  // `workflow:route` was retired by the backend's 2026-09-16 permission
  // restructuring (split into `workflow_instance:route`, `task:*`,
  // `delegation:*`) — no role can hold it anymore, so this gate was
  // permanently unsatisfiable for real supervisors. Gated on what the
  // supervisor console actually does: route documents into a workflow, and
  // act on tasks.
  {
    path: '/supervisor',
    matchType: 'prefix',
    anyPermissions: ['workflow_instance:route', 'task:action'],
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
