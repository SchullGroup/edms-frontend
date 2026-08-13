'use client';

import React, { useState, useEffect } from 'react';
import { useStore } from '@/store/useStore';
import { useUIStore } from '@/store/useUIStore';
import { Table, Column } from '@/components/ui/Table';
import { ConfBadge, UrgBadge } from '@/components/ui/Badges';
import { Spinner } from '@/components/common/Spinner';
import { ErrorMessage } from '@/components/common/ErrorMessage';
import {
  usePolicies,
  useUpdatePolicyConfidentiality,
  useUpdatePolicyUrgency,
  useUpdatePolicyControl,
} from '@/apis/hooks/usePolicies';

export default function PoliciesPage() {
  const { auditAction } = useStore();
  const { setPageTitle, addToast } = useUIStore();

  const { data: policiesData, isLoading, isError, refetch } = usePolicies();
  const updatePolicyConfidentiality = useUpdatePolicyConfidentiality();
  const updatePolicyUrgency = useUpdatePolicyUrgency();
  const updatePolicyControl = useUpdatePolicyControl();

  const [tab, setTab] = useState<'conf' | 'urg' | 'ret' | 'ctl'>('conf');

  const policies = policiesData as any; // type casting to any to handle nested properties from mock data

  useEffect(() => {
    setPageTitle('Policies');
  }, [setPageTitle]);

  if (isLoading) {
    return <Spinner text="Loading policies..." />;
  }

  if (isError) {
    return <ErrorMessage message="Failed to load policies." retry={refetch} />;
  }

  const handleConfToggle = (level: string, key: string, value: boolean) => {
    updatePolicyConfidentiality.mutate(
      { level, updates: { [key]: value } },
      {
        onSuccess: () => {
          auditAction('POLICY_EDIT', 'confidentiality', `${level}: ${key} → ${value}`);
        },
      },
    );
  };

  const handleUrgSlaChange = (level: string, sla: number) => {
    updatePolicyUrgency.mutate(
      { level, updates: { sla } },
      {
        onSuccess: () => {
          auditAction('POLICY_EDIT', 'urgency', `${level} SLA → ${sla}h`);
        },
      },
    );
  };

  const handleCtrlToggle = (rule: string, enabled: boolean) => {
    updatePolicyControl.mutate(
      { ruleName: rule, enabled },
      {
        onSuccess: () => {
          auditAction('CONTROL_TOGGLE', rule, enabled ? 'Enabled' : 'Disabled');
        },
      },
    );
  };

  const handleRetentionRun = () => {
    auditAction('RETENTION_RUN', 'Policies', 'Manually ran retention job');
    addToast('Retention job queued — eligible files will be archived per schedule', 'success');
  };

  const confCols: Column<any>[] = [
    { key: 'level', label: 'Level', render: (r) => <ConfBadge level={r.level} /> },
    {
      key: 'desc',
      label: 'Behaviour',
      render: (r) => <span style={{ fontSize: '12px', lineHeight: 1.5 }}>{r.desc}</span>,
    },
    {
      key: 'watermark',
      label: 'Watermark',
      render: (r) => (
        <label className="switch">
          <input
            type="checkbox"
            checked={r.watermark || false}
            onChange={(e) => handleConfToggle(r.level, 'watermark', e.target.checked)}
          />
          <i></i>
        </label>
      ),
    },
    {
      key: 'download',
      label: 'Download',
      render: (r) => (
        <label className="switch">
          <input
            type="checkbox"
            checked={r.download || false}
            onChange={(e) => handleConfToggle(r.level, 'download', e.target.checked)}
          />
          <i></i>
        </label>
      ),
    },
    {
      key: 'print',
      label: 'Print',
      render: (r) => (
        <label className="switch">
          <input
            type="checkbox"
            checked={r.print || false}
            onChange={(e) => handleConfToggle(r.level, 'print', e.target.checked)}
          />
          <i></i>
        </label>
      ),
    },
  ];

  const urgCols: Column<any>[] = [
    { key: 'level', label: 'Level', render: (r) => <UrgBadge level={r.level} /> },
    {
      key: 'sla',
      label: 'Default SLA',
      render: (r) => (
        <input
          className="input"
          type="number"
          defaultValue={r.sla}
          style={{ width: '90px' }}
          onBlur={(e) => handleUrgSlaChange(r.level, +e.target.value)}
        />
      ),
    },
    {
      key: 'note',
      label: '',
      render: () => <span className="caption">hours to breach; escalation per workflow stage</span>,
    },
  ];

  const retCols: Column<any>[] = [
    { key: 'type', label: 'Record type', render: (r) => <b>{r.type}</b> },
    {
      key: 'years',
      label: 'Retention',
      render: (r) =>
        r.years ? `${r.years} years` : <span className="badge b-status-pending">Legal hold</span>,
    },
    { key: 'action', label: 'End-of-life action' },
  ];

  const ctlCols: Column<any>[] = [
    {
      key: 'rule',
      label: 'Control rule',
      render: (r) => <b style={{ fontSize: '12.5px' }}>{r.rule}</b>,
    },
    { key: 'scope', label: 'Scope' },
    {
      key: 'enabled',
      label: 'Enabled',
      render: (r) => (
        <label className="switch">
          <input
            type="checkbox"
            checked={r.enabled || false}
            onChange={(e) => handleCtrlToggle(r.rule, e.target.checked)}
          />
          <i></i>
        </label>
      ),
    },
  ];

  return (
    <div>
      <div className="page-head">
        <div>
          <div className="page-title">Policies</div>
          <div className="page-sub">
            Confidentiality behaviour, urgency SLAs, retention schedules and control rules.
          </div>
        </div>
      </div>

      <div className="tabs mb16">
        <button className={`tab ${tab === 'conf' ? 'active' : ''}`} onClick={() => setTab('conf')}>
          Confidentiality
        </button>
        <button className={`tab ${tab === 'urg' ? 'active' : ''}`} onClick={() => setTab('urg')}>
          Urgency & SLA
        </button>
        <button className={`tab ${tab === 'ret' ? 'active' : ''}`} onClick={() => setTab('ret')}>
          Retention
        </button>
        <button className={`tab ${tab === 'ctl' ? 'active' : ''}`} onClick={() => setTab('ctl')}>
          Controls
        </button>
      </div>

      {tab === 'conf' && (
        <div className="card">
          <Table cols={confCols} rows={policies?.confidentiality || []} />
        </div>
      )}

      {tab === 'urg' && (
        <div className="card">
          <Table cols={urgCols} rows={policies?.urgency || []} />
        </div>
      )}

      {tab === 'ret' && (
        <div className="card">
          <div className="card-head">
            <span className="h3">Retention schedules</span>
            <button className="btn btn-secondary btn-sm" onClick={handleRetentionRun}>
              Run retention job
            </button>
          </div>
          <Table cols={retCols} rows={policies?.retention || []} />
        </div>
      )}

      {tab === 'ctl' && (
        <div className="card">
          <Table cols={ctlCols} rows={policies?.controls || []} />
        </div>
      )}
    </div>
  );
}
