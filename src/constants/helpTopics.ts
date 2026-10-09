/**
 * Help topics on `/help` (each is an anchor there), and which one the Topbar's
 * help button opens for the page you're on. More specific paths come first.
 */
export type HelpTopicId =
  | 'getting-started'
  | 'find'
  | 'upload'
  | 'read'
  | 'confidentiality'
  | 'workflows'
  | 'checkout'
  | 'delegations'
  | 'circulars'
  | 'quick-access'
  | 'admin-setup'
  | 'roles'
  | 'cabinet-access'
  | 'workflow-designer'
  | 'sla'
  | 'audit'
  | 'shortcuts';

const BY_PATH: [prefix: string, topic: HelpTopicId][] = [
  ['/admin/workflows', 'workflow-designer'],
  ['/admin/roles', 'roles'],
  ['/admin/cabinets', 'cabinet-access'],
  ['/admin/policies', 'sla'],
  ['/admin/audit', 'audit'],
  ['/auditor/trail', 'audit'],
  ['/admin/access-requests', 'confidentiality'],
  ['/admin', 'admin-setup'],
  ['/upload', 'upload'],
  ['/search', 'find'],
  ['/staff/cabinets', 'find'],
  ['/doc/', 'read'],
  ['/workflow-instances', 'workflows'],
  ['/staff/tasks', 'workflows'],
  ['/delegations', 'delegations'],
  ['/circulars', 'circulars'],
];

export function helpTopicForPath(pathname: string): HelpTopicId {
  return BY_PATH.find(([prefix]) => pathname.startsWith(prefix))?.[1] ?? 'getting-started';
}
