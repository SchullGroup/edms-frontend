/**
 * Permission model for the frontend UX layer.
 *
 * The backend is the real enforcement layer. This module lets the UI decide what
 * to render / route to based on the permission KEYS a user holds, rather than a
 * hard-coded set of six role names — so admin-created custom roles work.
 *
 * Backend permission strings are `resource:action:scope` (e.g.
 * `document:view:global`). For gating we only care about `resource:action`; the
 * scope is exposed separately via `parseScope` for the rare call site that needs
 * it (row-level filtering is still done server-side).
 */

import type { PermissionType, Role } from '@/types/models';

// --- Canonical vocabulary --------------------------------------------------------
// Mirrors the enum `PUT /roles/:id/permissions` actually validates against (its 400
// lists exactly these values). The live `GET /roles` catalog is broader still — see
// `RolePermissionResource`/`RolePermissionAction` in `types/models.ts` — but anything
// outside this list will be rejected if it's ever sent back on a write.

export const PERMISSION_RESOURCES: { value: string; label: string }[] = [
  { value: 'document', label: 'Documents' },
  { value: 'cabinet', label: 'Cabinets' },
  { value: 'folder', label: 'Folders' },
  { value: 'workflow', label: 'Workflows' },
  { value: 'audit', label: 'Audit' },
  { value: 'user', label: 'Users' },
  { value: 'role', label: 'Roles' },
  { value: 'department', label: 'Departments' },
];

export const PERMISSION_ACTIONS: { value: string; label: string }[] = [
  { value: 'view', label: 'View' },
  { value: 'create', label: 'Create' },
  { value: 'edit', label: 'Edit' },
  { value: 'delete', label: 'Delete' },
  { value: 'upload', label: 'Upload' },
  { value: 'route', label: 'Route' },
  { value: 'restore', label: 'Restore' },
  { value: 'export', label: 'Export' },
  { value: 'download', label: 'Download' },
  { value: 'print', label: 'Print' },
];

export type PermissionScope = 'global' | 'department' | 'own';

// --- Normalisation & matching ---------------------------------------------------

/** Any accepted permission shape → canonical `"resource:action"` (scope dropped). */
export function normalizePermission(p: PermissionType): string {
  if (typeof p === 'string') {
    const [resource, action] = p.split(':');
    return `${resource ?? '*'}:${action ?? '*'}`;
  }
  return `${p.resource}:${p.action}`;
}

/** Third segment of a `"resource:action:scope"` string, if present. */
export function parseScope(p: PermissionType): PermissionScope | null {
  if (typeof p !== 'string') return null;
  const scope = p.split(':')[2];
  return scope === 'global' || scope === 'department' || scope === 'own' ? scope : null;
}

/** Does a granted key satisfy a required `resource`/`action`? Supports `*` wildcards. */
export function permissionMatches(granted: string, resource: string, action: string): boolean {
  const [gRes, gAct] = granted.split(':');
  const resOk = gRes === resource || gRes === '*';
  const actOk = gAct === action || gAct === '*';
  return resOk && actOk;
}

const SCOPE_ORDER: PermissionScope[] = ['own', 'department', 'global'];

/** Does a held scope meet or exceed a minimum? `null` (no scope on the grant —
 *  e.g. it only ever arrived via the scope-dropping role-derivation top-up, see
 *  `derivePermissionsFromRoles`) never satisfies a minimum; a scope-less grant
 *  can't be assumed to be global. Used for UX-layer decisions only (e.g. which
 *  sidebar item to show) — the backend is still the real scope enforcement. */
export function scopeAtLeast(held: PermissionScope | null, min: PermissionScope): boolean {
  if (!held) return false;
  return SCOPE_ORDER.indexOf(held) >= SCOPE_ORDER.indexOf(min);
}

/** Build the flat `"resource:action"` set a user holds, given their role names. */
export function derivePermissionsFromRoles(
  roleNames: string[] | undefined,
  roles: Role[] | undefined,
): string[] {
  if (!roleNames?.length || !roles?.length) return [];
  const wanted = new Set(roleNames);
  const out = new Set<string>();
  for (const role of roles) {
    if (!wanted.has(role.name)) continue;
    for (const perm of role.permissions ?? []) {
      out.add(normalizePermission(perm));
    }
  }
  return [...out];
}

// --- Portals ------------------------------------------------------------------

export type PortalKey =
  | 'platform'
  | 'admin'
  | 'auditor'
  | 'management'
  | 'supervisor'
  | 'staff';

export interface PortalEntry {
  /** Satisfied when the user holds AT LEAST ONE of these `"resource:action"` keys. */
  anyPermissions?: string[];
  /** Fallback / exception: satisfied when the user has one of these role names.
   *  Used only for `platform`, which has no resource in the vocabulary. */
  roles?: string[];
}

export interface Portal {
  key: PortalKey;
  home: string;
  surface: string;
  /** Higher wins when a user can enter more than one portal. */
  priority: number;
  entry: PortalEntry;
}

/** Ordered high → low priority. */
export const PORTALS: Portal[] = [
  {
    key: 'platform',
    home: '/platform',
    surface: 'SchullTech Platform Admin',
    priority: 60,
    entry: { roles: ['schulltech_admin'] },
  },
  {
    key: 'admin',
    home: '/admin',
    surface: 'Client Administration',
    priority: 50,
    // View-gated (not write-gated) so a read-only custom role — e.g. "user:view only"
    // — still lands here and sees the admin nav items it can actually view; the write
    // affordances inside each page hide themselves per-action instead (see
    // routes.config.ts's matching note). Deliberately narrow: only keys that don't
    // collide with another portal's entry list. `department:view`/`workflow_instance:view`
    // are claimed by `management` (and `workflow_instance:view` also by `supervisor`);
    // including them here would outrank a pure viewer into `admin` instead of the
    // read-only oversight portal they more sensibly belong in. `cabinet:view` is held by
    // almost every document-handling role (staff/supervisor/auditor), so admitting it
    // would misroute ordinary custom roles into the config portal. `audit:view` is
    // `auditor`'s entry key. None of this affects the specific `:view` gate each admin
    // nav item/route still checks once a role is already inside via one of these three.
    entry: {
      anyPermissions: ['user:view', 'role:view', 'workflow:view'],
    },
  },
  {
    key: 'auditor',
    home: '/auditor',
    surface: 'Audit & Compliance',
    priority: 40,
    entry: { anyPermissions: ['audit:view'] },
  },
  {
    key: 'management',
    home: '/management',
    surface: 'Management Portal',
    priority: 30,
    // `dashboard:view` is not a real backend resource — no role can ever hold
    // it. Gated instead on the union of what the management pages fetch; see
    // the matching note in `routes.config.ts`.
    entry: {
      anyPermissions: ['document:view', 'workflow_instance:view', 'task:view', 'department:view'],
    },
  },
  {
    key: 'supervisor',
    home: '/supervisor',
    surface: 'Supervisor Console',
    priority: 20,
    // `workflow:route` was retired by the backend's 2026-09-16 permission
    // restructuring — see the matching note in `routes.config.ts`.
    //
    // Deliberately still action-based, not `task:view`/`workflow_instance:view` — that
    // pair is a literal subset of `management`'s entry (`document:view,
    // workflow_instance:view, task:view, department:view`), and `management` outranks
    // `supervisor`, so a view-based entry here would make this portal permanently
    // unreachable for any custom role (they'd always resolve to `management` first).
    // The `/supervisor/*` routes and nav items are still `:view`-gated — only this
    // portal-selection heuristic stays action-based, relying on the assumption that
    // anyone holding `task:action`/`workflow_instance:route` also holds the matching
    // `:view` key, so they still pass those `:view` gates once inside.
    entry: { anyPermissions: ['workflow_instance:route', 'task:action'] },
  },
  {
    key: 'staff',
    home: '/staff',
    surface: 'Staff Workspace',
    priority: 10,
    entry: { anyPermissions: ['document:view'] },
  },
];

export const PORTAL_BY_KEY: Record<PortalKey, Portal> = PORTALS.reduce(
  (acc, p) => {
    acc[p.key] = p;
    return acc;
  },
  {} as Record<PortalKey, Portal>,
);

function permsSatisfy(perms: string[], any: string[] | undefined): boolean {
  if (!any?.length) return false;
  return any.some((req) => {
    const [resource, action] = req.split(':');
    return perms.some((g) => permissionMatches(g, resource, action));
  });
}

/** Can this user enter a given portal? */
export function canEnterPortal(
  portal: Portal,
  perms: string[],
  roleNames: string[] | undefined,
): boolean {
  if (portal.entry.roles?.some((r) => roleNames?.includes(r))) return true;
  return permsSatisfy(perms, portal.entry.anyPermissions);
}

/** The six seeded roles. `GET /roles` does not flag these (`Role` has no
 *  `isSystemRole`), so the frontend recognises them by name. */
export const SYSTEM_ROLE_NAMES = [
  'schulltech_admin',
  'client_admin',
  'management',
  'internal_auditor',
  'supervisor',
  'staff',
] as const;

export function isSystemRoleName(name: string | undefined | null): boolean {
  return !!name && (SYSTEM_ROLE_NAMES as readonly string[]).includes(name);
}

/** The canonical portal for a built-in system role, by historical priority. */
const SYSTEM_ROLE_PORTAL: [string, PortalKey][] = [
  ['schulltech_admin', 'platform'],
  ['client_admin', 'admin'],
  ['management', 'management'],
  ['internal_auditor', 'auditor'],
  ['supervisor', 'supervisor'],
  ['staff', 'staff'],
];

/**
 * Which portal shell to render for a user.
 *
 * System-role users keep their historical portal (permission sets overlap too
 * much between the six seeded roles to disambiguate by permission alone). A
 * custom role — the case this whole module exists for — is placed in the
 * highest-priority portal whose entry permission it actually holds.
 */
export function resolvePortal(
  perms: string[],
  roleNames: string[] | undefined,
): PortalKey {
  const known = SYSTEM_ROLE_PORTAL.find(([r]) => roleNames?.includes(r));
  if (known) return known[1];

  const hit = PORTALS.find((p) => canEnterPortal(p, perms, roleNames));
  return hit?.key ?? 'staff';
}

// --- Offline / pre-hydration fallback ----------------------------------------
// Approximate grants for the six seeded system roles (see docs/01 §DRIFT-04).
// Only used before `GET /roles` resolves, or when the app is offline. The live
// role permissions from the API always take precedence.

const ALL_RESOURCES = PERMISSION_RESOURCES.map((r) => r.value);
const ALL_ACTIONS = PERMISSION_ACTIONS.map((a) => a.value);
const everything = ALL_RESOURCES.flatMap((r) => ALL_ACTIONS.map((a) => `${r}:${a}`));
const viewAll = ALL_RESOURCES.map((r) => `${r}:view`);

export const SYSTEM_ROLE_PERMISSIONS: Record<string, string[]> = {
  // `everything` only spans the canonical resource x action vocabulary above.
  // `workflow:publish`/`workflow:archive`/`task:reassign`/`document_access_request:grant`
  // are real, separately seeded backend permissions outside that vocabulary (see
  // `workflows.router.ts` and `documents.router.ts`'s `requirePermission` calls) —
  // appended explicitly so internal button-gating on them doesn't flicker disabled
  // for client_admin before live permissions arrive.
  client_admin: [
    ...everything,
    'workflow:publish',
    'workflow:archive',
    'task:reassign',
    'document_access_request:grant',
  ],
  schulltech_admin: ['workflow:view', 'workflow_instance:route', 'audit:view'],
  internal_auditor: [
    ...viewAll,
    'document:download',
    'document:export',
    'audit:export',
  ],
  management: [
    ...viewAll,
    'document:export',
    'workflow_instance:route',
  ],
  supervisor: [
    'document:view',
    'document:create',
    'document:edit',
    'document:export',
    'document:download',
    'document:print',
    'workflow_instance:view',
    'workflow_instance:route',
    'task:view',
    'task:action',
    'task:reassign',
    'cabinet:view',
    'folder:view',
    'folder:edit',
    'user:view',
    'audit:view',
  ],
  staff: [
    'document:view',
    'document:create',
    'document:edit',
    'document:export',
    'document:download',
    'document:print',
    'cabinet:view',
    'folder:view',
    'folder:create',
    'folder:edit',
    'workflow_instance:view',
    'workflow_instance:route',
    'task:view',
    'task:action',
  ],
};

/** Union of fallback grants for whichever built-in roles the user has. */
export function fallbackPermissionsForRoles(roleNames: string[] | undefined): string[] {
  if (!roleNames?.length) return [];
  const out = new Set<string>();
  for (const name of roleNames) {
    for (const perm of SYSTEM_ROLE_PERMISSIONS[name] ?? []) out.add(perm);
  }
  return [...out];
}
