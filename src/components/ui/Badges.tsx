import React from 'react';
import { Icon } from './Icons';

export const StatusBadge = ({ status }: { status: string }) => {
  const statusIco: Record<string, string> = {
    Pending: 'clock',
    'In Progress': 'pulse',
    Closed: 'check',
    Overdue: 'alert',
    'On Hold': 'circle',
  };
  const cls = 'b-status-' + status.toLowerCase().replace(/\s+/g, '-');
  return (
    <span className={`badge ${cls}`}>
      <Icon name={statusIco[status] || 'circle'} size={10} /> {status}
    </span>
  );
};

export const ConfBadge = ({ level }: { level: string }) => {
  const cls = 'b-conf-' + level.toLowerCase().replace(/\s+/g, '-');
  return (
    <span className={`badge ${cls}`} title={`Confidentiality: ${level}`}>
      <Icon name="lock" size={10} /> {level}
    </span>
  );
};

export const UrgBadge = ({ level }: { level: string }) => {
  const cls = 'b-urg-' + level.toLowerCase();
  return (
    <span className={`badge ${cls}`} title={`Urgency: ${level}`}>
      <Icon name="flag" size={10} /> {level}
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
