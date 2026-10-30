import React from 'react';
import type {
  ControlExceptionCategory,
  ControlExceptionSeverity,
  ControlExceptionStatus,
} from '@/types/models';

export const CATEGORY_LABEL: Record<ControlExceptionCategory, string> = {
  missing_competitive_quotes: 'Missing competitive quotes',
  missing_approval: 'Missing approval',
  missing_documentation: 'Missing documentation',
  policy_breach: 'Policy breach',
  sla_breach: 'SLA breach',
  other: 'Other',
};

export const SEVERITY_LABEL: Record<ControlExceptionSeverity, string> = {
  low: 'Low',
  medium: 'Medium',
  high: 'High',
  critical: 'Critical',
};

export const STATUS_LABEL: Record<ControlExceptionStatus, string> = {
  open: 'Open',
  reported: 'Reported',
  acknowledged: 'Acknowledged',
  resolved: 'Resolved',
};

export const CATEGORIES = Object.keys(CATEGORY_LABEL) as ControlExceptionCategory[];
export const SEVERITIES = Object.keys(SEVERITY_LABEL) as ControlExceptionSeverity[];
export const STATUSES = Object.keys(STATUS_LABEL) as ControlExceptionStatus[];

// Reuses the urgency palette, one step per severity.
const SEVERITY_CLASS: Record<ControlExceptionSeverity, string> = {
  low: 'b-urg-low',
  medium: 'b-urg-normal',
  high: 'b-urg-high',
  critical: 'b-urg-critical',
};

// Grey = still with the auditor, amber = waiting on the permanent secretary, green = closed.
const STATUS_CLASS: Record<ControlExceptionStatus, string> = {
  open: 'b-status-not-started',
  reported: 'b-status-pending',
  acknowledged: 'b-status-in-progress',
  resolved: 'b-status-closed',
};

export const SeverityBadge = ({ severity }: { severity: ControlExceptionSeverity }) => (
  <span className={`badge ${SEVERITY_CLASS[severity] ?? ''}`}>
    {SEVERITY_LABEL[severity] ?? severity}
  </span>
);

export const ControlExceptionStatusBadge = ({ status }: { status: ControlExceptionStatus }) => (
  <span className={`badge ${STATUS_CLASS[status] ?? ''}`}>{STATUS_LABEL[status] ?? status}</span>
);

/** "YYYY-MM-DD" → ISO bounds for the backend's raised-date filter, whose `to` is inclusive. */
export function dayStart(day: string): string | undefined {
  return day ? new Date(`${day}T00:00:00`).toISOString() : undefined;
}

export function dayEnd(day: string): string | undefined {
  return day ? new Date(`${day}T23:59:59.999`).toISOString() : undefined;
}
