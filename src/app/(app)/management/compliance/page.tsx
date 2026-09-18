'use client';

import React, { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useStore, userById } from '@/store/useStore';
import { useUIStore } from '@/store/useUIStore';
import { useAuditEntries } from '@/apis/hooks/useAudit';
import { useUsers } from '@/apis/hooks/useUsers';
import { Spinner } from '@/components/common/Spinner';
import { HBarChart } from '@/components/ui/Charts';
import { Table, Column } from '@/components/ui/Table';
import { SevBadge } from '@/components/ui/Badges';

/**
 * Access-control and privilege-change events — confirmed live 2026-09-18
 * against real `GET /audit` data (a 78-entry sample from this tenant), not
 * guessed. Replaces the old `REDACT_RELEASE`/`SIGN`/`PRINT`/`DOWNLOAD`/
 * `SLA_ESCALATION` list, which were app-invented codes with no backend
 * equivalent — none of them were ever real action names.
 */
const SENSITIVE_ACTIONS = [
  'document.access_requested',
  'document.access_granted',
  'document.access_denied',
  'role.permissions_updated',
  'role.created',
  'role.deleted',
  'user.deactivated',
  'user.password_reset',
];

export default function CompliancePosturePage() {
  const router = useRouter();
  const { findings } = useStore();

  const { data: auditData, isLoading: isLoadingAudit } = useAuditEntries({
    limit: 100,
    page: 1,
  });
  const { data: usersData, isLoading: isLoadingUsers } = useUsers();
  const audit = auditData?.data || [];
  const users = usersData?.data || [];

  const { setPageTitle } = useUIStore();

  useEffect(() => {
    setPageTitle('Compliance Posture');
  }, [setPageTitle]);

  if (isLoadingAudit || isLoadingUsers) return <Spinner />;

  const open = findings?.filter((f: any) => f.status !== 'Closed') || [];

  // Newest-first is already how `GET /audit` orders results, so the first
  // matches are also the most recent — no client-side sort needed.
  const sens = audit.filter((a) => SENSITIVE_ACTIONS.includes(a.action)).slice(0, 8);

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

      <div className="grid cols-4 mb-4">
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

      <div className="grid cols-2 mb-4">
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
              sens.map((a) => (
                <div key={a.id} className="meta-row">
                  <span className="k">
                    {new Date(a.occurredAt).toLocaleString('en-GB', {
                      day: '2-digit',
                      month: 'short',
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </span>
                  <span className="v" style={{ textAlign: 'left', fontWeight: 500 }}>
                    {a.actorType === 'system' || !a.actorId
                      ? 'System'
                      : userById(users, a.actorId)?.name || a.actorId}{' '}
                    · {a.action}
                    {a.objectType ? ` (${a.objectType})` : ''}
                  </span>
                </div>
              ))
            ) : (
              <p className="muted">No sensitive events in the last 100.</p>
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
