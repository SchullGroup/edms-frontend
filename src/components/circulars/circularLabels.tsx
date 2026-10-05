import React from 'react';
import { Icon } from '@/components/ui/Icons';
import type {
  CircularAudience,
  CircularStatus,
  Department,
  DocumentConfidentiality,
  DocumentUrgency,
} from '@/types/models';

export const CIRCULAR_STATUS_LABEL: Record<CircularStatus, string> = {
  draft: 'Draft',
  scheduled: 'Scheduled',
  published: 'Published',
  expired: 'Expired',
  withdrawn: 'Withdrawn',
  superseded: 'Superseded',
};

// Reuses the document status palette: green = in force, violet = waiting on
// the clock, red = retracted, grey = not (or no longer) in front of anyone.
const STATUS_CLASS: Record<CircularStatus, string> = {
  draft: 'b-status-not-started',
  scheduled: 'b-status-on-hold',
  published: 'b-status-closed',
  expired: 'b-status-pending',
  withdrawn: 'b-status-overdue',
  superseded: 'b-status-not-started',
};

export const CircularStatusBadge = ({ status }: { status: CircularStatus }) => (
  <span className={`badge ${STATUS_CLASS[status] ?? ''}`}>
    {CIRCULAR_STATUS_LABEL[status] ?? status}
  </span>
);

export const CONFIDENTIALITY_OPTIONS: [DocumentConfidentiality, string][] = [
  ['public', 'Public'],
  ['internal', 'Internal'],
  ['confidential', 'Confidential'],
  ['restricted', 'Restricted'],
  ['top_secret', 'Top Secret'],
];

export const URGENCY_OPTIONS: [DocumentUrgency, string][] = [
  ['low', 'Low'],
  ['normal', 'Normal'],
  ['high', 'High'],
  ['critical', 'Critical'],
];

/** `CIR-2026-0014 · v2`, or a placeholder for a draft that has no reference yet. */
export function circularReference(c: { referenceNumber: string | null; versionNumber: number }) {
  const ref = c.referenceNumber ?? 'No reference yet';
  return c.versionNumber > 1 ? `${ref} · v${c.versionNumber}` : ref;
}

/** "Acknowledge" button / badge for a recipient's own receipt. */
export const AckStateBadge = ({
  requiresAcknowledgement,
  acknowledgedAt,
}: {
  requiresAcknowledgement: boolean;
  acknowledgedAt: string | null;
}) =>
  !requiresAcknowledgement ? (
    <span className="badge b-urg-low">FYI</span>
  ) : acknowledgedAt ? (
    <span className="badge b-status-closed">
      <Icon name="check" size={10} /> Acknowledged
    </span>
  ) : (
    <span className="badge b-status-pending">Acknowledgement required</span>
  );

export interface FlatDepartment {
  id: string;
  name: string;
  depth: number;
}

/** Depth-first flatten of the `GET /departments` tree, for pickers. */
export function flattenDepartments(nodes: Department[], depth = 0): FlatDepartment[] {
  const out: FlatDepartment[] = [];
  for (const node of nodes) {
    out.push({ id: node.id, name: node.name, depth });
    if (node.children?.length) out.push(...flattenDepartments(node.children, depth + 1));
  }
  return out;
}

/**
 * One-line description of an audience, e.g. "All staff" or
 * "Finance (incl. sub-departments) · Supervisors · 3 named people".
 * Names it can't resolve (the caller may not be allowed to list roles) fall
 * back to a generic word rather than an id.
 */
export function describeAudience(
  audience: CircularAudience | null | undefined,
  names: {
    department: (id: string) => string | undefined;
    role: (id: string) => string | undefined;
  },
): string {
  if (!audience) return '—';
  if (audience.allStaff) return 'All staff';
  const parts = audience.groups.map((g) => {
    const dept = g.departmentId ? (names.department(g.departmentId) ?? 'A department') : null;
    const role = g.roleId ? (names.role(g.roleId) ?? 'a role') : null;
    const sub = dept && g.includeSubDepartments !== false ? ' (incl. sub-departments)' : '';
    if (dept && role) return `${role} in ${dept}${sub}`;
    return `${dept ?? role}${sub}`;
  });
  if (audience.userIds.length) {
    parts.push(
      `${audience.userIds.length} named ${audience.userIds.length === 1 ? 'person' : 'people'}`,
    );
  }
  return parts.join(' · ') || '—';
}

export function formatFileSize(size: number | string | null | undefined): string {
  const n = typeof size === 'string' ? Number(size) : size;
  if (!n || Number.isNaN(n)) return '';
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(0)} KB`;
  return `${(n / (1024 * 1024)).toFixed(1)} MB`;
}
