/*
 * The audit log's vocabulary, copied from edms-backend
 * `src/shared/constants/audit.constants.ts` (`AUDIT_ACTIONS`, `AUDIT_OBJECT_TYPES`).
 * `GET /audit` validates `action` and `objectType` against those exact lists — a
 * value outside them is a 400, so the filters only ever offer these.
 */

export const AUDIT_ACTIONS = [
  // Authentication
  'user.login',
  'user.login_failed',
  'user.token_refreshed',
  'user.password_reset_requested',
  'user.password_reset',
  'user.mfa_enabled',
  'user.mfa_disabled',
  'user.mfa_reset',
  'user.mfa_otp_requested',
  'user.mfa_otp_request_failed',

  // MFA method switching
  'user.mfa_method_change_started',
  'user.mfa_method_change_completed',
  'user.mfa_method_change_cancelled',
  'user.mfa_method_change_failed',

  // Identity & configuration
  'user.created',
  'user.updated',
  'user.deactivated',
  'user.invited',
  'user.roles_assigned',
  'user.role_removed',
  'role.created',
  'role.updated',
  'role.deleted',
  'role.permissions_updated',
  'department.created',
  'department.updated',
  'department.deleted',

  // Filing structure
  'cabinet.created',
  'cabinet.updated',
  'cabinet.deleted',
  'cabinet.access_granted',
  'cabinet.access_revoked',
  'cabinet.metadata_field_added',
  'cabinet.metadata_field_updated',
  'cabinet.metadata_field_removed',
  'folder.created',
  'folder.updated',
  'folder.deleted',

  // Documents
  'document.uploaded',
  'document.viewed',
  'document.summary_viewed',
  'document.summary_requested',
  'document.edited',
  'document.deleted',
  'document.downloaded',
  'document.version_viewed',
  'document.exported',
  'document.printed',
  'document.metadata_updated',
  'document.version_created',
  'document.version_restored',
  'document.comment_added',
  'document.signature_added',
  'document.access_requested',
  'document.access_granted',
  'document.access_denied',
  'document.access_revoked',
  'checkout.locked',
  'checkout.released',

  // Workflow
  'workflow.created',
  'workflow.version_created',
  'workflow.updated',
  'workflow.published',
  'workflow.archived',
  'workflow.unarchived',
  'workflow.deleted',
  'workflow.instance_created',
  'workflow.document_attached',
  'workflow.started',
  'workflow.stage_advanced',
  'workflow.approved',
  'workflow.rejected',
  'workflow.changes_requested',
  'workflow.on_hold',
  'workflow.resumed',
  'workflow.closed',
  'task.completed',
  'task.reviewed',
  'task.reassigned',
  'task.delegated',
  'task.escalated',
  'delegation.created',
  'delegation.ended',

  // Circulars
  'circular.created',
  'circular.updated',
  'circular.deleted',
  'circular.scheduled',
  'circular.schedule_cancelled',
  'circular.published',
  'circular.publish_failed',
  'circular.expired',
  'circular.withdrawn',
  'circular.revised',
  'circular.acknowledged',
  'circular.reminders_requested',

  // Internal control
  'control_exception.raised',
  'control_exception.updated',
  'control_exception.reported',
  'control_exception.acknowledged',
  'control_exception.resolved',

  // Retrieval
  'search.executed',

  // Network restrictions
  'access_rule.created',
  'access_rule.deleted',

  // Audit of the audit trail itself
  'audit.exported',
] as const;

export type AuditAction = (typeof AUDIT_ACTIONS)[number];

/** Workflow *design* changes; every other `workflow.*` action is a running workflow. */
const WORKFLOW_DESIGN_ACTIONS = [
  'workflow.created',
  'workflow.version_created',
  'workflow.updated',
  'workflow.published',
  'workflow.archived',
  'workflow.unarchived',
  'workflow.deleted',
];

export interface AuditRecordType {
  /** The `objectType` sent to `GET /audit`. */
  value: string;
  label: string;
  /** Which actions are written against this record type. */
  actions: (action: string) => boolean;
}

const byPrefix =
  (...prefixes: string[]) =>
  (action: string) =>
    prefixes.some((p) => action.startsWith(p));

/** Settings an admin changes — the "configuration history" (story 18.7). SLA
 *  settings aren't here because the backend doesn't audit them. */
export const CONFIG_RECORD_TYPES: AuditRecordType[] = [
  { value: 'role', label: 'Roles & permissions', actions: byPrefix('role.') },
  { value: 'department', label: 'Departments', actions: byPrefix('department.') },
  { value: 'cabinet', label: 'Cabinets, access & metadata fields', actions: byPrefix('cabinet.') },
  { value: 'folder', label: 'Folders', actions: byPrefix('folder.') },
  {
    value: 'workflow',
    label: 'Workflow designs',
    actions: (a) => WORKFLOW_DESIGN_ACTIONS.includes(a),
  },
  { value: 'user', label: 'Users, roles & MFA', actions: byPrefix('user.') },
  { value: 'access_rule', label: 'IP & country rules', actions: byPrefix('access_rule.') },
];

export const ACTIVITY_RECORD_TYPES: AuditRecordType[] = [
  { value: 'document', label: 'Documents', actions: byPrefix('document.', 'checkout.') },
  { value: 'document_version', label: 'Document versions', actions: byPrefix('document.version') },
  {
    value: 'document_access_request',
    label: 'Access requests',
    actions: byPrefix('document.access'),
  },
  {
    value: 'workflow_instance',
    label: 'Running workflows',
    actions: (a) => a.startsWith('workflow.') && !WORKFLOW_DESIGN_ACTIONS.includes(a),
  },
  { value: 'task', label: 'Tasks', actions: byPrefix('task.') },
  { value: 'delegation', label: 'Delegations', actions: byPrefix('delegation.') },
  { value: 'circular', label: 'Circulars', actions: byPrefix('circular.') },
  {
    value: 'control_exception',
    label: 'Audit findings',
    actions: byPrefix('control_exception.'),
  },
  { value: 'search', label: 'Searches', actions: byPrefix('search.') },
  { value: 'audit_entry', label: 'Audit log', actions: byPrefix('audit.') },
];

export function auditRecordType(value: string): AuditRecordType | undefined {
  return [...CONFIG_RECORD_TYPES, ...ACTIVITY_RECORD_TYPES].find((t) => t.value === value);
}

const ACRONYMS: Record<string, string> = { mfa: 'MFA', otp: 'OTP', ai: 'AI' };

/** "document.version_viewed" → "Document version viewed", from the key, so a new action reads too. */
export function auditActionLabel(action: string): string {
  const words = action
    .split(/[._]/)
    .filter(Boolean)
    .map((w) => ACRONYMS[w] ?? w);
  const text = words.join(' ');
  return text.charAt(0).toUpperCase() + text.slice(1);
}
