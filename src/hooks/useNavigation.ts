import { useStore, userById } from '@/store/useStore';
import { usePermissions } from '@/hooks/usePermissions';
import { PORTAL_BY_KEY, scopeAtLeast } from '@/lib/permissions';
import { useUnreadNotificationCount } from '@/apis/hooks/useNotifications';
import { useApprovalTasks } from '@/apis/hooks/useTasks';

export const useNavigation = () => {
  const { currentUser, documents, circulars, findings } = useStore();
  const { hasPermission, scopeFor, portal } = usePermissions();
  // Reused for "home"/resource-less items below so they can never drift out of sync
  // with the portal-entry criteria in permissions.ts, and so every portal's sidebar
  // is guaranteed non-empty: entering a portal already means satisfying this set, and
  // at least one item per portal (its home item) is gated on that same set.
  const entryPerms = PORTAL_BY_KEY[portal]?.entry.anyPermissions;
  // Must be called before the `!me` early return below — hooks cannot be
  // conditional. The query itself is cheap and cached.
  const { data: unreadNotifications = 0 } = useUnreadNotificationCount();
  // Real count for the Approvals Queue badge — previously read the SEED
  // `documents` array filtered on a hardcoded `u-david`, which was never real
  // data. `limit: 1` keeps the payload minimal; `pagination.total` still gives
  // the accurate count. Gated on `task:action` (the item's own permission) so
  // this request isn't fired for users who'd never see the item anyway.
  const canSeeApprovals = hasPermission('task', 'action');
  const { data: approvalsData } = useApprovalTasks(
    { scope: 'all', status: 'pending', page: 1, limit: 1 },
    { enabled: canSeeApprovals },
  );
  const me = currentUser;

  if (!me) return null;

  const myOpenTasks = () =>
    documents.filter((dc) => dc.assignee === me.id && dc.status !== 'Closed').length;
  const unreadCount = () => unreadNotifications;
  const circularsPendingAck = () =>
    circulars.filter((c) => c.requiresAck && !c.ackBy.includes(me.id)).length;
  const approvalsCount = () => approvalsData?.pagination?.total ?? 0;

  const NAV: Record<string, any> = {
    staff: {
      surface: 'Staff Workspace',
      home: '/staff',
      sections: [
        {
          label: 'Workspace',
          items: [
            { route: '/staff', label: 'Dashboard', icon: 'home', anyPermissions: entryPerms },
            {
              route: '/staff/tasks',
              label: 'My Tasks',
              icon: 'inbox',
              badge: myOpenTasks,
              // Conceptually `task:view:own` — but `own` is the floor of the scope
              // hierarchy (own < department < global; see `scopeAtLeast` in
              // permissions.ts), so any `task:view` grant, at minimum, already
              // covers seeing your own queue. No functional difference from a bare
              // `task:view` check; kept unscoped rather than adding a no-op minScope.
              anyPermissions: ['task:view'],
            },
            { route: '/notifications', label: 'Notifications', icon: 'bell', badge: unreadCount },
            {
              route: '/delegations',
              label: 'Delegations',
              icon: 'calendar',
              // Entirely self-service and own-scoped — `useDelegations({scope:'mine'})`
              // only ever shows/lets you act on delegations you created or received,
              // never anyone else's, so `own` (the scope floor — see the My Tasks
              // comment above) is genuinely all this needs. Create/End are real,
              // zero-gated mutations, but contained to your own records; deferred to
              // the internal-gating follow-up rather than fixed now.
              anyPermissions: ['delegation:view'],
            },
          ],
        },
        {
          label: 'Documents',
          items: [
            {
              route: '/staff/cabinets',
              label: 'Cabinets',
              icon: 'cabinet',
              anyPermissions: ['document:view'],
            },
            {
              route: '/upload',
              label: 'Upload & Capture',
              icon: 'upload',
              anyPermissions: ['document:create'],
            },
            { route: '/search', label: 'Search', icon: 'search' },
          ],
        },
        {
          label: 'Communication',
          items: [
            {
              route: '/circulars',
              label: 'Circulars',
              icon: 'speaker',
              badge: circularsPendingAck,
            },
          ],
        },
        {
          label: 'Insights',
          items: [
            {
              route: '/staff/performance',
              label: 'My Performance',
              icon: 'gauge',
              anyPermissions: ['document:view', 'task:view'],
            },
          ],
        },
      ],
    },
    supervisor: {
      surface: 'Supervisor Console',
      home: '/supervisor',
      sections: [
        {
          label: 'Oversight',
          items: [
            {
              route: '/supervisor',
              label: 'Team Overview',
              icon: 'users',
              anyPermissions: entryPerms,
            },
            {
              route: '/supervisor/approvals',
              label: 'Approvals Queue',
              icon: 'approve',
              badge: approvalsCount,
              // Gated on the action, not the view — the whole point of this page is
              // acting on approvals, and there's little value in seeing a queue you
              // can't act on (no internal gating on the Approve/Reject buttons yet).
              anyPermissions: ['task:action'],
            },
            {
              route: '/supervisor/instances',
              label: 'Workflow Monitor',
              icon: 'flow',
              // Requires department-or-global scope, not just any workflow_instance:
              // view — "Monitor" implies oversight across a set of instances beyond
              // your own, so own-scoped view alone (`scopeAtLeast(..., 'department')`
              // accepts 'department' or 'global', rejects 'own' and null) shouldn't
              // surface this. Route stays at plain workflow_instance:view (any scope)
              // since routes.config.ts isn't scope-aware — same pattern as Users/
              // Cabinet Designer.
              anyPermissions: [
                { resource: 'workflow_instance', action: 'view', minScope: 'department' },
              ],
            },
            {
              route: '/supervisor/bottlenecks',
              label: 'Bottlenecks & Ageing',
              icon: 'clock',
              anyPermissions: ['workflow_instance:view'],
            },
            {
              route: '/supervisor/workload',
              label: 'Workload & Reassign',
              icon: 'swap',
              // "Reassign" is a real mutation moving work between people — gate on
              // the action, not just the ability to view the workload.
              anyPermissions: ['task:action'],
            },
            {
              route: '/delegations',
              label: 'Delegations',
              icon: 'calendar',
              // Entirely self-service and own-scoped — `useDelegations({scope:'mine'})`
              // only ever shows/lets you act on delegations you created or received,
              // never anyone else's, so `own` (the scope floor — see the My Tasks
              // comment above) is genuinely all this needs. Create/End are real,
              // zero-gated mutations, but contained to your own records; deferred to
              // the internal-gating follow-up rather than fixed now.
              anyPermissions: ['delegation:view'],
            },
          ],
        },
        {
          label: 'Quality',
          items: [
            {
              route: '/supervisor/performance',
              label: 'Team Performance',
              icon: 'trend',
              anyPermissions: ['task:view', 'workflow_instance:view'],
            },
            {
              route: '/supervisor/exceptions',
              label: 'Exceptions',
              icon: 'alert',
              // Still a dummy page (local mock state, not wired to a real backend
              // list — the one real thing it does, "Acknowledge", just writes an
              // audit log entry), so there's no real resource to gate on yet.
              // Treated like admin's Policies/Branding/Circulars: gated on the
              // portal's own entry signal rather than a specific resource.
              anyPermissions: entryPerms,
            },
          ],
        },
        {
          label: 'Documents',
          items: [
            {
              route: '/staff/cabinets',
              label: 'Cabinets',
              icon: 'cabinet',
              anyPermissions: ['document:view'],
            },
            { route: '/search', label: 'Search', icon: 'search' },
            { route: '/circulars', label: 'Circulars', icon: 'speaker' },
          ],
        },
      ],
    },
    management: {
      surface: 'Management Portal',
      home: '/management',
      sections: [
        {
          label: 'Dashboards',
          items: [
            {
              route: '/management',
              label: 'Organization Overview',
              icon: 'grid',
              anyPermissions: entryPerms,
            },
            {
              route: '/management/departments',
              label: 'Department Comparison',
              icon: 'chart',
              anyPermissions: ['department:view'],
            },
            {
              route: '/management/trends',
              label: 'Trends & Forecast',
              icon: 'trend',
              anyPermissions: ['document:view', 'workflow_instance:view'],
            },
          ],
        },
        {
          label: 'Governance',
          items: [
            {
              route: '/management/compliance',
              label: 'Compliance Posture',
              icon: 'shield',
              anyPermissions: ['audit:view'],
            },
            {
              route: '/management/performance',
              label: 'Performance Overview',
              icon: 'gauge',
              anyPermissions: ['task:view', 'workflow_instance:view'],
            },
            {
              route: '/management/findings',
              label: 'Findings',
              icon: 'finding',
              anyPermissions: ['audit:view'],
            },
          ],
        },
        {
          label: 'Reporting',
          items: [
            {
              route: '/management/reports',
              label: 'Reports & Export',
              icon: 'report',
              // Gated on the export action, not view — per your call, this page's
              // whole purpose is producing an export ("Run & export", "Schedule…"),
              // not browsing. `document:export`/`audit:export` are the only export
              // keys in the vocabulary; the report types on offer span both
              // (throughput/SLA/storage vs. findings/audit-activity extracts), so
              // either is enough to reach the page. The route rule (routes.config.ts
              // — a single coarse whitelist shared by every /management/* page)
              // stays on the broader :view union; this page is fully simulated
              // today (no real export, just a toast + audit-log entry), so that
              // asymmetry is low-stakes.
              anyPermissions: ['document:export', 'audit:export'],
            },
            { route: '/search', label: 'Search', icon: 'search' },
          ],
        },
      ],
    },
    client_admin: {
      surface: 'Client Administration',
      home: '/admin',
      sections: [
        {
          label: 'Administration',
          items: [
            { route: '/admin', label: 'Admin Home', icon: 'home', anyPermissions: entryPerms },
            {
              route: '/admin/users',
              label: 'Users',
              icon: 'users',
              // Requires global scope specifically — this page is the tenant-wide
              // user directory, not a department-scoped view. Someone holding only
              // department-scoped user:view (a supervisor, say) shouldn't see a link
              // that implies they can browse every user in the tenant.
              anyPermissions: [{ resource: 'user', action: 'view', minScope: 'global' }],
            },
            {
              route: '/admin/roles',
              label: 'Roles & permissions',
              icon: 'key',
              // Gated on the edit permission, not view — this page saves permission
              // grants directly. With no internal gating on the save action yet, a
              // view-only visitor being able to reach it at all risks privilege
              // escalation (a role editing its own or another role's grants), which
              // is a different, worse category of risk than the usual "button that
              // 403s" gap, so it doesn't wait for the general follow-up.
              anyPermissions: ['role:edit'],
            },
            {
              route: '/admin/departments',
              label: 'Departments',
              icon: 'building',
              anyPermissions: ['department:create'],
            },
          ],
        },
        {
          label: 'Configuration',
          items: [
            {
              route: '/admin/cabinets',
              label: 'Cabinet Designer',
              icon: 'cabinet',
              // Corrected from `cabinet:view` — the page's own `isAdmin` check
              // (`can('cabinet','create') || scopeFor('cabinet','view') ===
              // 'global'`) is the only permission logic on this 1471-line page,
              // and it only decides which cabinets to *list*; the New/Edit/Delete
              // buttons are completely unguarded. Mirroring that same isAdmin
              // signal here instead of plain view — same reasoning as Departments/
              // Workflow Designer/Roles: no internal write gating yet, so the
              // sidebar link itself is the only thing standing between a viewer
              // and those buttons.
              anyPermissions: [
                'cabinet:create',
                { resource: 'cabinet', action: 'view', minScope: 'global' },
              ],
            },
            {
              route: '/admin/workflows',
              label: 'Workflow Designer',
              icon: 'flow',
              // Gated on the edit permission — this is a full canvas editor with no
              // internal gating yet, and a bad save corrupts a shared workflow
              // definition every document routed through it depends on. Systemic
              // blast radius, unlike the usual single-record CRUD page, so this one
              // doesn't wait for the general follow-up either.
              anyPermissions: ['workflow:edit'],
            },
            {
              route: '/admin/workflows/instances',
              label: 'Workflow Monitor',
              icon: 'pulse',
              // Same reasoning as the supervisor copy of this page: department-or-
              // global scope, not own — "Monitor" is oversight, not a personal view.
              anyPermissions: [
                { resource: 'workflow_instance', action: 'view', minScope: 'department' },
              ],
            },
            {
              route: '/admin/policies',
              label: 'Policies',
              icon: 'policy',
              anyPermissions: entryPerms,
            },
            {
              route: '/admin/branding',
              label: 'Branding',
              icon: 'brush',
              // Role-gated, not permission-gated — per your call, this stays scoped
              // to the role it was built for (client_admin) rather than opened up
              // to any custom role that happens to hold an admin-qualifying
              // permission. Same exception class as /platform's role gate in
              // routes.config.ts (no permission substitute, by design).
              roles: ['client_admin'],
            },
          ],
        },
        {
          label: 'Communication',
          items: [
            {
              route: '/admin/circulars',
              label: 'Circulars Admin',
              icon: 'speaker',
              // No dedicated `circular` resource exists, so — per your call —
              // gated on one specific admin-peculiar key rather than the generic
              // entry OR-set (which would show this to anyone who entered the
              // portal for an unrelated reason, e.g. workflow:edit alone). Picked
              // `user:view` as the closest "this is clearly a tenant admin" signal;
              // flag if you'd rather it be `role:view` or `workflow:view` instead.
              anyPermissions: ['user:view'],
            },
          ],
        },
        {
          label: 'Governance',
          items: [
            {
              route: '/admin/audit',
              label: 'Tenant Audit',
              icon: 'list',
              anyPermissions: ['audit:view'],
            },
            {
              route: '/admin/access-requests',
              label: 'Access Requests',
              icon: 'key',
              // Approving a request *is* granting access — same privilege-escalation
              // category as Roles & permissions above, not a contained CRUD page.
              anyPermissions: ['user:edit'],
            },
          ],
        },
      ],
    },
    schulltech_admin: {
      surface: 'SchullTech Platform Admin',
      home: '/platform',
      sections: [
        {
          label: 'Operations',
          items: [
            { route: '/platform', label: 'Tenant Directory', icon: 'building' },
            { route: '/platform/sysconfig', label: 'Platform Health', icon: 'pulse' },
          ],
        },
        {
          label: 'Commercial',
          items: [
            { route: '/platform/plans', label: 'Plans & Entitlements', icon: 'key' },
            { route: '/platform/billing', label: 'Billing & Usage', icon: 'billing' },
          ],
        },
        {
          label: 'Release',
          items: [{ route: '/platform/flags', label: 'Feature Flags', icon: 'flag' }],
        },
        {
          label: 'Governance',
          items: [{ route: '/platform/audit', label: 'Platform Audit', icon: 'list' }],
        },
      ],
    },
    internal_auditor: {
      surface: 'Audit & Compliance',
      home: '/auditor',
      sections: [
        {
          label: 'Review',
          items: [
            {
              route: '/auditor',
              label: 'Audit Dashboard',
              icon: 'gauge',
              anyPermissions: entryPerms,
            },
            {
              route: '/auditor/trail',
              label: 'Audit Trail',
              icon: 'list',
              anyPermissions: ['audit:view'],
            },
            // Real route is `/staff/cabinets`, governed by the `/staff` route rules —
            // gate on `document:view` (that rule's permission), not `audit:view`, or
            // this becomes a dead link for an auditor without document:view.
            {
              route: '/staff/cabinets',
              label: 'Document Sampling',
              icon: 'cabinet',
              anyPermissions: ['document:view'],
            },
            { route: '/search', label: 'Search', icon: 'search' },
          ],
        },
        {
          label: 'Findings',
          items: [
            {
              route: '/auditor/findings',
              label: 'Findings Tracker',
              icon: 'finding',
              badge: () => findings.filter((f) => f.status !== 'Closed').length,
              anyPermissions: ['audit:view'],
            },
          ],
        },
        {
          label: 'Posture',
          items: [
            {
              route: '/auditor/compliance',
              label: 'Compliance Posture',
              icon: 'shield',
              anyPermissions: ['audit:view'],
            },
          ],
        },
      ],
    },
  };

  // Pick the portal shell by which portal's entry permission the user holds —
  // not by role name — so custom roles land somewhere sensible.
  const NAV_KEY_BY_PORTAL: Record<string, string> = {
    platform: 'schulltech_admin',
    admin: 'client_admin',
    auditor: 'internal_auditor',
    management: 'management',
    supervisor: 'supervisor',
    staff: 'staff',
  };
  const navTemplate = NAV[NAV_KEY_BY_PORTAL[portal] || 'staff'] || NAV['staff'];

  const checkPerm = (p: any) => {
    if (typeof p === 'string') {
      const [res, act] = p.split(':');
      return hasPermission(res, act || '*');
    }
    // `{ resource, action, minScope }` — a scope floor, not just resource/action
    // existence. Used for UX-layer decisions like which sidebar item to show;
    // the backend still enforces the real scope on the underlying data.
    if (p.minScope) {
      return scopeAtLeast(scopeFor(p.resource, p.action), p.minScope);
    }
    return hasPermission(p.resource, p.action);
  };

  // Filter sections and items by their declared requirements:
  //  - `roles`           → at least one role name required (the rare deliberate
  //                        exception — see Branding's comment above)
  //  - `permissions`     → ALL required
  //  - `anyPermissions`  → at least one required
  const filteredNav = {
    ...navTemplate,
    sections: navTemplate.sections
      .map((section: any) => ({
        ...section,
        items: section.items.filter((item: any) => {
          if (item.roles?.length && !item.roles.some((r: string) => me.roles?.includes(r)))
            return false;
          if (item.permissions?.length && !item.permissions.every(checkPerm)) return false;
          if (item.anyPermissions?.length && !item.anyPermissions.some(checkPerm)) return false;
          return true;
        }),
      }))
      .filter((section: any) => section.items.length > 0),
  };

  // Appended for every role rather than repeated in each NAV entry. The Product
  // Guide is reference material, not role-specific work, and carries no route
  // rule in routes.config.ts — so every signed-in user can reach it.
  filteredNav.sections = [
    ...filteredNav.sections,
    {
      label: 'Reference',
      items: [{ route: '/user-stories', label: 'Product Guide', icon: 'flow' }],
    },
  ];

  return filteredNav;
};
