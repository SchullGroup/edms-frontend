'use client';

import React, { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useStore, userById } from '@/store/useStore';
import { useUIStore } from '@/store/useUIStore';
import { useAuditLogs } from '@/apis/hooks/useAudit';
import { useUsers } from '@/apis/hooks/useUsers';
import { Spinner } from '@/components/common/Spinner';
import { HBarChart } from '@/components/ui/Charts';
import { Table, Column } from '@/components/ui/Table';
import { SevBadge } from '@/components/ui/Badges';

export default function CompliancePosturePage() {
  const router = useRouter();
  const { findings } = useStore();

  const { data: auditData, isLoading: isLoadingAudit } = useAuditLogs();
  const { data: usersData, isLoading: isLoadingUsers } = useUsers();
  const audit = auditData?.data || [];
  const users = usersData?.data || [];

  const { setPageTitle } = useUIStore();

  useEffect(() => {
    setPageTitle('Compliance Posture');
  }, [setPageTitle]);

  if (isLoadingAudit || isLoadingUsers) return <Spinner />;

  const open = findings?.filter((f: any) => f.status !== 'Closed') || [];

  const sensitiveActions = [
    'REDACT_RELEASE',
    'REDACT_MARK',
    'ACCESS_REQUEST',
    'SIGN',
    'PRINT',
    'DOWNLOAD',
    'SLA_ESCALATION',
    'AUDIT_EXPORT',
  ];
  const sens = audit?.filter((a: any) => sensitiveActions.includes(a.action)).slice(0, 8) || [];

  const hbarItems = [
    {
      label: 'Open',
      value: findings?.filter((f: any) => f.status === 'Open').length || 0,
      color: 'var(--status-overdue)',
    },
    {
      label: 'In Remediation',
      value: findings?.filter((f: any) => f.status === 'In Remediation').length || 0,
      color: 'var(--status-pending)',
    },
    {
      label: 'Closed',
      value: findings?.filter((f: any) => f.status === 'Closed').length || 0,
      color: 'var(--status-closed)',
    },
  ];

  const cols: Column<any>[] = [
    { key: 'ref', label: 'Ref', render: (r) => <b>{r.ref}</b> },
    { key: 'title', label: 'Finding' },
    { key: 'severity', label: 'Severity', render: (r) => <SevBadge sev={r.severity} /> },
    { key: 'owner', label: 'Owner', render: (r) => <span>{userById(users, r.owner)?.name}</span> },
    {
      key: 'due',
      label: 'Due',
      sortable: true,
      render: (r) => <span>{new Date(r.due).toLocaleDateString('en-GB')}</span>,
    },
    {
      key: 'status',
      label: 'Status',
      render: (r) => (
        <span className={`badge ${r.status === 'Open' ? 'b-status-overdue' : 'b-status-pending'}`}>
          {r.status}
        </span>
      ),
    },
  ];

  return (
    <div>
      <div className="page-head">
        <div>
          <div className="page-title">Compliance Posture</div>
          <div className="page-sub">Findings, exceptions and sensitive activity at a glance.</div>
        </div>
      </div>

      <div className="grid cols-4 mb16">
        <div className="card kpi">
          <div
            className="kv"
            style={{ color: open.length ? 'var(--status-overdue)' : 'var(--status-closed)' }}
          >
            {open.length}
          </div>
          <div className="kl">Open findings</div>
        </div>
        <div className="card kpi">
          <div className="kv">4</div>
          <div className="kl">Exceptions (30d)</div>
        </div>
        <div className="card kpi">
          <div className="kv">98.6%</div>
          <div className="kl">Controls passing</div>
        </div>
        <div className="card kpi">
          <div className="kv">1</div>
          <div className="kl">Legal holds active</div>
        </div>
      </div>

      <div className="grid cols-2 mb16">
        <div className="card">
          <div className="card-head">
            <span className="h3">Findings by status</span>
            <button
              className="btn btn-ghost btn-sm"
              onClick={() => router.push('/auditor/findings')}
            >
              Open tracker
            </button>
          </div>
          <div className="card-body">
            <HBarChart items={hbarItems} />
          </div>
        </div>
        <div className="card">
          <div className="card-head">
            <span className="h3">Sensitive activity (live audit feed)</span>
          </div>
          <div className="card-body" style={{ paddingTop: '4px' }}>
            {sens.length > 0 ? (
              sens.map((a: any, idx: number) => (
                <div key={idx} className="meta-row">
                  <span className="k">
                    {new Date(a.at).toLocaleString('en-GB', {
                      day: '2-digit',
                      month: 'short',
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </span>
                  <span className="v" style={{ textAlign: 'left', fontWeight: 500 }}>
                    {userById(users, a.user as string)?.name} · {a.action} — {a.detail}
                  </span>
                </div>
              ))
            ) : (
              <p className="muted">No sensitive events in this window.</p>
            )}
          </div>
        </div>
      </div>

      <div className="card">
        <div className="card-head">
          <span className="h3">Open findings — drill-down</span>
        </div>
        <Table cols={cols} rows={open} onRow={() => router.push('/auditor/findings')} />
      </div>
    </div>
  );
}
