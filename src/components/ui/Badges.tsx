import React from 'react';
import { Icon } from './Icons';
import { titleCase } from '@/utils/helpers';

export const StatusBadge = ({ status }: { status: string }) => {
  const statusIco: Record<string, string> = {
    Pending: 'clock',
    'In Progress': 'pulse',
    Closed: 'check',
    Overdue: 'alert',
    'On Hold': 'circle',
  };
  const label = titleCase(status);
  const cls = 'b-status-' + label.toLowerCase().replace(/\s+/g, '-');
  return (
    <span className={`badge ${cls}`}>
      <Icon name={statusIco[label] || 'circle'} size={10} /> {label}
    </span>
  );
};

/**
 * Time-risk state from `bottlenecks-ageing`/`sla/breaches` — deliberately a
 * separate chip from `StatusBadge` (process state). Never merge the two.
 */
export const SlaBadge = ({ status }: { status: string }) => {
  const label: Record<string, string> = {
    healthy: 'Healthy',
    due_soon: 'Due soon',
    breached: 'Breached',
    paused: 'Paused',
    not_started: 'Not started',
  };
  const cls: Record<string, string> = {
    healthy: 'b-status-closed',
    due_soon: 'b-status-pending',
    breached: 'b-status-overdue',
    paused: 'b-status-on-hold',
    not_started: 'b-status-not-started',
  };
  const ico: Record<string, string> = {
    healthy: 'check',
    due_soon: 'clock',
    breached: 'alert',
    paused: 'circle',
    not_started: 'circle',
  };
  return (
    <span className={`badge ${cls[status] || 'b-status-not-started'}`} title="SLA status">
      <Icon name={ico[status] || 'circle'} size={10} /> {label[status] || status}
    </span>
  );
};

export const ConfBadge = ({ level }: { level: string }) => {
  const label = titleCase(level);
  const cls = 'b-conf-' + label.toLowerCase().replace(/\s+/g, '-');
  return (
    <span className={`badge ${cls}`} title={`Confidentiality: ${label}`}>
      <Icon name="lock" size={10} /> {label}
    </span>
  );
};

export const UrgBadge = ({ level }: { level: string }) => {
  const label = titleCase(level);
  const cls = 'b-urg-' + label.toLowerCase();
  return (
    <span className={`badge ${cls}`} title={`Urgency: ${label}`}>
      <Icon name="flag" size={10} /> {label}
    </span>
  );
};

export const SevBadge = ({ sev }: { sev: string }) => {
  const map: Record<string, string> = {
    High: 'b-urg-critical',
    Medium: 'b-urg-high',
    Low: 'b-urg-normal',
  };
  return (
    <span className={`badge ${map[sev] || 'b-urg-low'}`}>
      <Icon name="finding" size={10} /> {sev}
    </span>
  );
};
