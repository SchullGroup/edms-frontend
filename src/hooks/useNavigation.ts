import { useStore, userById } from '@/store/useStore';
import { usePermissions } from '@/hooks/usePermissions';
import { useUnreadNotificationCount } from '@/apis/hooks/useNotifications';

export const useNavigation = () => {
  const { currentUser, documents, circulars, findings } = useStore();
  const { hasPermission, portal } = usePermissions();
  // Must be called before the `!me` early return below — hooks cannot be
  // conditional. The query itself is cheap and cached.
  const { data: unreadNotifications = 0 } = useUnreadNotificationCount();
  const me = currentUser;

  if (!me) return null;

  const myOpenTasks = () =>
    documents.filter((dc) => dc.assignee === me.id && dc.status !== 'Closed').length;
  const unreadCount = () => unreadNotifications;
  const circularsPendingAck = () =>
    circulars.filter((c) => c.requiresAck && !c.ackBy.includes(me.id)).length;
  const approvalsCount = () =>
    documents.filter((dc) => dc.assignee === 'u-david' && dc.status !== 'Closed').length;

  const NAV: Record<string, any> = {
    staff: {
      surface: 'Staff Workspace',
      home: '/staff',
      sections: [
        {
          label: 'Workspace',
          items: [
            { route: '/staff', label: 'Dashboard', icon: 'home' },
            { route: '/staff/tasks', label: 'My Tasks', icon: 'inbox', badge: myOpenTasks },
            { route: '/notifications', label: 'Notifications', icon: 'bell', badge: unreadCount },
            { route: '/delegations', label: 'Delegations', icon: 'calendar' },
          ],
        },
        {
          label: 'Documents',
          items: [
            { route: '/staff/cabinets', label: 'Cabinets', icon: 'cabinet' },
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
          items: [{ route: '/staff/performance', label: 'My Performance', icon: 'gauge' }],
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
            { route: '/supervisor', label: 'Team Overview', icon: 'users' },
            {
              route: '/supervisor/approvals',
              label: 'Approvals Queue',
              icon: 'approve',
              badge: approvalsCount,
            },
            { route: '/supervisor/instances', label: 'Workflow Monitor', icon: 'flow' },
            { route: '/supervisor/bottlenecks', label: 'Bottlenecks & Ageing', icon: 'clock' },
            { route: '/supervisor/workload', label: 'Workload & Reassign', icon: 'swap' },
            { route: '/delegations', label: 'Delegations', icon: 'calendar' },
          ],
        },
        {
          label: 'Quality',
          items: [
            { route: '/supervisor/performance', label: 'Team Performance', icon: 'trend' },
            { route: '/supervisor/exceptions', label: 'Exceptions', icon: 'alert' },
          ],
        },
        {
          label: 'Documents',
          items: [
            { route: '/staff/cabinets', label: 'Cabinets', icon: 'cabinet' },
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
            { route: '/management', label: 'Organization Overview', icon: 'grid' },
            { route: '/management/departments', label: 'Department Comparison', icon: 'chart' },
            { route: '/management/trends', label: 'Trends & Forecast', icon: 'trend' },
          ],
        },
        {
          label: 'Governance',
          items: [
            { route: '/management/compliance', label: 'Compliance Posture', icon: 'shield' },
            { route: '/management/performance', label: 'Performance Overview', icon: 'gauge' },
            { route: '/management/findings', label: 'Findings', icon: 'finding' },
          ],
        },
        {
          label: 'Reporting',
          items: [
            { route: '/management/reports', label: 'Reports & Export', icon: 'report' },
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
            { route: '/admin', label: 'Admin Home', icon: 'home' },
            { route: '/admin/users', label: 'Users', icon: 'users' },
            { route: '/admin/roles', label: 'Roles & permissions', icon: 'key' },
            { route: '/admin/departments', label: 'Departments', icon: 'building' },
          ],
        },
        {
          label: 'Configuration',
          items: [
            { route: '/admin/cabinets', label: 'Cabinet Designer', icon: 'cabinet' },
            { route: '/admin/workflows', label: 'Workflow Designer', icon: 'flow' },
            { route: '/admin/workflows/instances', label: 'Workflow Monitor', icon: 'pulse' },
            { route: '/admin/policies', label: 'Policies', icon: 'policy' },
            { route: '/admin/branding', label: 'Branding', icon: 'brush' },
          ],
        },
        {
          label: 'Communication',
          items: [{ route: '/admin/circulars', label: 'Circulars Admin', icon: 'speaker' }],
        },
        {
          label: 'Governance',
          items: [{ route: '/admin/audit', label: 'Tenant Audit', icon: 'list' }],
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
            { route: '/auditor', label: 'Audit Dashboard', icon: 'gauge' },
            { route: '/auditor/trail', label: 'Audit Trail', icon: 'list' },
            { route: '/staff/cabinets', label: 'Document Sampling', icon: 'cabinet' },
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
            },
          ],
        },
        {
          label: 'Posture',
          items: [{ route: '/auditor/compliance', label: 'Compliance Posture', icon: 'shield' }],
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
    return hasPermission(p.resource, p.action);
  };

  // Filter sections and items by their declared permission requirements:
  //  - `permissions`     → ALL required
  //  - `anyPermissions`  → at least one required
  const filteredNav = {
    ...navTemplate,
    sections: navTemplate.sections
      .map((section: any) => ({
        ...section,
        items: section.items.filter((item: any) => {
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
