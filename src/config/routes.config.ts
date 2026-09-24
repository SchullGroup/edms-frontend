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

  // 3. Per-page rules under /staff, most specific first, each keyed to the exact
  // `:view` permission its page actually needs — same permission its sidebar nav
  // item requires (see useNavigation.ts), so a link is never shown that this gate
  // would then reject. The final `/staff` prefix rule is the catch-all for the
  // Dashboard (and anything else unlisted).
  {
    path: '/staff/tasks',
    matchType: 'prefix',
    anyPermissions: ['task:view'],
  },
  {
    path: '/staff/cabinets',
    matchType: 'prefix',
    anyPermissions: ['document:view'],
  },
  {
    path: '/staff/performance',
    matchType: 'prefix',
    anyPermissions: ['document:view', 'task:view'],
  },
  {
    path: '/staff',
    matchType: 'prefix',
    anyPermissions: ['document:view'],
    exclude: ['/staff/restricted-example'], // Add explicit exceptions here if needed
  },

  // High-level portals — per-page rules under /admin, most specific first. Order
  // matters: `/admin/workflows/instances` must precede `/admin/workflows` since the
  // latter's prefix would otherwise match it too. Cabinets and Workflow Monitor
  // require only their resource's `:view` key at the route level — viewing a page
  // shouldn't need write rights, and write affordances hide themselves inside the
  // page instead (not yet built — tracked as a follow-up, see docs). Their sidebar
  // items are actually stricter (Cabinet Designer also needs create-or-global-scope,
  // Workflow Monitor needs department-or-global scope — see useNavigation.ts); this
  // route rule stays at the permissive resource:action level since it isn't
  // scope-aware, same reasoning as Users below. Roles, Access Requests, Departments
  // and Workflow Designer are gated on a write permission instead, each for its own
  // reason — see their individual comments below (privilege escalation for Roles/
  // Access Requests, systemic blast
  // radius for Workflow Designer, an explicit call for Departments). Branding is
  // role-gated outright (see its own rule below) rather than folded into the
  // catch-all. The final `/admin` prefix rule is the catch-all for the rest of
  // the pages with no dedicated resource — Admin Home, Policies, Circulars
  // Admin — gated on the same 3-key set as the `admin` portal entry itself.
  // The sidebar's Users item additionally requires *global* scope (see
  // useNavigation.ts) — this route rule stays resource:action-only since
  // `RouteRule`/`evaluateRouteAccess` isn't scope-aware. A department-scoped
  // user:view holder (e.g. a supervisor) won't see the link, but could still
  // reach this URL directly; the backend scopes the actual data it returns
  // regardless, which is the real enforcement layer for that boundary anyway.
  {
    path: '/admin/users',
    matchType: 'prefix',
    anyPermissions: ['user:view'],
  },
  // Requires the edit permission, not view — this page writes role permission
  // grants directly, with no internal gating on the save action yet, so a
  // view-only visitor reaching it at all risks privilege escalation. Matches
  // the nav item gate in useNavigation.ts.
  {
    path: '/admin/roles',
    matchType: 'prefix',
    anyPermissions: ['role:edit'],
  },
  {
    path: '/admin/departments',
    matchType: 'prefix',
    anyPermissions: ['department:create'],
  },
  // The sidebar's Cabinet Designer item additionally requires the record to be
  // `cabinet:create` OR global-scoped `cabinet:view` (mirroring the page's own
  // `isAdmin` check — see its comment there). This route rule stays at plain
  // `cabinet:view` since `RouteRule`/`evaluateRouteAccess` isn't scope-aware —
  // kept permissive rather than narrowed to `cabinet:create` alone, so a
  // global-scoped viewer the sidebar links to never hits a dead link here.
  {
    path: '/admin/cabinets',
    matchType: 'prefix',
    anyPermissions: ['cabinet:view', 'cabinet:create'],
  },
  {
    path: '/admin/workflows/instances',
    matchType: 'prefix',
    anyPermissions: ['workflow_instance:view'],
  },
  // Requires the edit permission — a full canvas editor with no internal gating
  // yet, and a bad save corrupts a shared workflow definition every document
  // routed through it depends on. Matches the nav item gate in useNavigation.ts.
  {
    path: '/admin/workflows',
    matchType: 'prefix',
    anyPermissions: ['workflow:edit'],
  },
  {
    path: '/admin/audit',
    matchType: 'prefix',
    anyPermissions: ['audit:view'],
  },
  // Approving a request *is* granting access — same privilege-escalation category
  // as Roles above, not a contained CRUD page. Matches the nav item gate.
  {
    path: '/admin/access-requests',
    matchType: 'prefix',
    anyPermissions: ['user:edit'],
  },
  // Role-gated, not permission-gated — per an explicit call: stays scoped to the
  // role it was built for (client_admin) rather than opening up to any custom
  // role that happens to hold an admin-qualifying permission. Same exception
  // class as /platform below (no permission substitute, by design). Matches the
  // nav item gate in useNavigation.ts.
  {
    path: '/admin/branding',
    matchType: 'prefix',
    roles: ['client_admin'],
  },
  {
    path: '/admin',
    matchType: 'prefix',
    anyPermissions: ['user:view', 'role:view', 'workflow:view'],
  },

  {
    path: '/auditor',
    matchType: 'prefix',
    anyPermissions: ['audit:view'],
  },

  // Per-page rules under /supervisor, most specific first, mirroring each page's
  // sidebar nav item permission (see useNavigation.ts). Previously a single coarse
  // `workflow_instance:route`/`task:action` gate for the whole prefix — that was a fix
  // for `workflow:route` being retired by the backend's 2026-09-16 permission
  // restructuring. Most of these pages are pure monitoring, where action permissions
  // were never really the right bar for merely *viewing* them — those are gated on
  // the matching `:view` key instead, with action buttons inside expected to hide
  // themselves per the admin-section follow-up. Approvals and Workload/Reassign are
  // the exception: their entire purpose is the action itself (approve/reassign), so
  // they stay gated on `task:action` rather than `task:view` — see their own comments
  // below. The `supervisor` portal-entry heuristic in permissions.ts deliberately
  // stays action-based too (see its comment there). The final `/supervisor` prefix
  // rule is the catch-all for Team Overview (Home).
  // Gated on the action, not the view — the whole point of this page is acting
  // on approvals, and the Approve/Reject buttons have no internal gating yet.
  // Matches the nav item gate in useNavigation.ts.
  {
    path: '/supervisor/approvals',
    matchType: 'prefix',
    anyPermissions: ['task:action'],
  },
  {
    path: '/supervisor/instances',
    matchType: 'prefix',
    anyPermissions: ['workflow_instance:view'],
  },
  {
    path: '/supervisor/bottlenecks',
    matchType: 'prefix',
    anyPermissions: ['workflow_instance:view'],
  },
  // "Reassign" is a real mutation moving work between people — gated on the
  // action. Matches the nav item gate in useNavigation.ts.
  {
    path: '/supervisor/workload',
    matchType: 'prefix',
    anyPermissions: ['task:action'],
  },
  {
    path: '/supervisor/performance',
    matchType: 'prefix',
    anyPermissions: ['task:view', 'workflow_instance:view'],
  },
  {
    path: '/supervisor/exceptions',
    matchType: 'prefix',
    anyPermissions: ['workflow_instance:view'],
  },
  {
    path: '/supervisor',
    matchType: 'prefix',
    anyPermissions: ['task:view', 'workflow_instance:view'],
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
