'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useUIStore } from '@/store/useUIStore';
import { useAuditActionTotal, useAuditEntries } from '@/apis/hooks/useAudit';
import { useControlExceptionReport, useControlExceptions } from '@/apis/hooks/useControlExceptions';
import { usePermissions } from '@/hooks/usePermissions';
import { Icon } from '@/components/ui/Icons';
import { Table, Column } from '@/components/ui/Table';
import { ErrorMessage } from '@/components/common/ErrorMessage';
import { Skeleton } from '@/components/common/Skeleton';
import { QuickAccessCard } from '@/components/dashboard/QuickAccessCard';
import {
  CATEGORY_LABEL,
  SeverityBadge,
} from '@/components/controlExceptions/controlExceptionLabels';
import { SENSITIVE_AUDIT_ACTIONS, auditActionLabel } from '@/constants/auditVocabulary';
import { fmtDate } from '@/utils/helpers';
import type { ControlException, ControlExceptionStatus } from '@/types/models';

const DAY_MS = 24 * 60 * 60 * 1000;
const isoDay = (d: Date) => d.toISOString().slice(0, 10);

/** The auditor's own work: findings to report, sensitive activity to review, documents to sample. */
export default function AuditorDashboard() {
  const router = useRouter();
  const { setPageTitle } = useUIStore();
  const { can } = usePermissions();
  const canViewFindings = can('control_exception', 'view');
  const canRaise = can('control_exception', 'create');
  const canViewAudit = can('audit', 'view');

  // Fixed on mount so query keys don't change on every render.
  const [weekAgo] = useState(() => new Date(Date.now() - 7 * DAY_MS).toISOString());
  const [monthAgoDay] = useState(() => isoDay(new Date(Date.now() - 30 * DAY_MS)));

  const report = useControlExceptionReport({}, { enabled: canViewFindings });
  const openFindings = useControlExceptions(
    { status: 'open', page: 1, limit: 8 },
    { enabled: canViewFindings },
  );
  const sensitiveTotal = useAuditActionTotal(SENSITIVE_AUDIT_ACTIONS, weekAgo, {
    enabled: canViewAudit,
  });
  const audit = useAuditEntries({ limit: 100, page: 1 }, { enabled: canViewAudit });

  useEffect(() => {
    setPageTitle('Audit dashboard');
  }, [setPageTitle]);

  const byStatus = report.data?.byStatus ?? {};
  const withManagement = (byStatus.reported ?? 0) + (byStatus.acknowledged ?? 0);
  const go = (href: string) => () => router.push(href);
  const asButton = (href: string) => ({
    role: 'button',
    tabIndex: 0,
    onClick: go(href),
    onKeyDown: (e: React.KeyboardEvent) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        router.push(href);
      }
    },
  });
  const findingsTile = (status: ControlExceptionStatus) => `/control-exceptions?status=${status}`;
  const count = (loading: boolean, n: number) =>
    loading ? <Skeleton height={28} width={40} /> : n;

  // `GET /audit` is newest first, so the first matches are the most recent.
  const sensitive = (audit.data?.data ?? [])
    .filter((a) => SENSITIVE_AUDIT_ACTIONS.includes(a.action))
    .slice(0, 9);

  const cols: Column<ControlException>[] = [
    {
      key: 'title',
      label: 'Finding',
      render: (c) => (
        <span>
          <b>{c.title}</b>
          <div className="caption">{CATEGORY_LABEL[c.category] ?? c.category}</div>
        </span>
      ),
    },
    { key: 'severity', label: 'Severity', render: (c) => <SeverityBadge severity={c.severity} /> },
    {
      key: 'department',
      label: 'Department',
      render: (c) => <span className="caption">{c.department?.name ?? '—'}</span>,
    },
    {
      key: 'raisedAt',
      label: 'Raised',
      render: (c) => <span className="caption">{fmtDate(c.raisedAt)}</span>,
    },
  ];

  const shortcuts = [
    { label: 'Restricted documents', href: '/search?confidentiality=restricted' },
    { label: 'Top Secret documents', href: '/search?confidentiality=top_secret' },
    { label: 'Closed documents', href: '/search?status=closed' },
    { label: 'Created in the last 30 days', href: `/search?from=${monthAgoDay}` },
  ];

  return (
    <div>
      <div className="page-head">
        <div>
          <div className="page-title">Audit dashboard</div>
          <div className="page-sub">Raise and report findings, and review sensitive activity.</div>
        </div>
        <div className="actions">
          <button className="btn btn-secondary" onClick={go('/auditor/trail')}>
            Open audit trail
          </button>
          {canRaise && (
            <button className="btn btn-primary" onClick={go('/control-exceptions/new')}>
              <Icon name="plus" size={15} /> Raise finding
            </button>
          )}
        </div>
      </div>

      <div className="grid cols-4 mb-4">
        {canViewFindings && (
          <>
            <div className="tile t-pending" {...asButton(findingsTile('open'))}>
              <div className="cnt">{count(report.isLoading, byStatus.open ?? 0)}</div>
              <div className="lbl">
                <Icon name="edit" size={13} /> Not yet reported
              </div>
            </div>
            {/* Two statuses, and the register filters by one, so this tile doesn't link. */}
            <div className="tile t-overdue" style={{ cursor: 'default' }}>
              <div className="cnt">{count(report.isLoading, withManagement)}</div>
              <div className="lbl">
                <Icon name="clock" size={13} /> With management
              </div>
            </div>
            <div className="tile t-closed" {...asButton(findingsTile('resolved'))}>
              <div className="cnt">{count(report.isLoading, byStatus.resolved ?? 0)}</div>
              <div className="lbl">
                <Icon name="check" size={13} /> Resolved
              </div>
            </div>
          </>
        )}
        {canViewAudit && (
          <div className="tile t-progress" {...asButton('/auditor/trail')}>
            <div className="cnt">
              {sensitiveTotal.isError ? '—' : count(sensitiveTotal.isLoading, sensitiveTotal.total)}
            </div>
            <div className="lbl">
              <Icon name="eye" size={13} /> Sensitive events (7 days)
            </div>
          </div>
        )}
      </div>

      <div className="dash-body">
        <div className="grid" style={{ gap: '16px' }}>
          {canViewFindings && (
            <div className="card">
              <div className="card-head">
                <span className="h3">Open findings, not yet reported</span>
                <button className="btn btn-ghost btn-sm" onClick={go(findingsTile('open'))}>
                  View all
                </button>
              </div>
              {openFindings.isError ? (
                <ErrorMessage
                  message="Failed to load audit findings."
                  retry={() => openFindings.refetch()}
                />
              ) : openFindings.isLoading ? (
                <div className="card-body">
                  <Skeleton height={160} />
                </div>
              ) : (
                <Table
                  cols={cols}
                  rows={openFindings.data?.data ?? []}
                  onRow={(c) => router.push(`/control-exceptions/${c.id}`)}
                  emptyMsg="Nothing waiting to be reported."
                />
              )}
            </div>
          )}

          <div className="card">
            <div className="card-head">
              <span className="h3">Recent sensitive activity</span>
              <button className="btn btn-ghost btn-sm" onClick={go('/auditor/trail')}>
                Full trail
              </button>
            </div>
            <div className="card-body" style={{ paddingTop: '4px' }}>
              {!canViewAudit ? (
                <p className="muted">
                  Your role can&apos;t read the audit trail. An administrator can add Audit · View
                  to your role.
                </p>
              ) : audit.isLoading ? (
                <Skeleton height={160} />
              ) : audit.isError ? (
                <ErrorMessage
                  message="Failed to load the audit trail."
                  retry={() => audit.refetch()}
                />
              ) : sensitive.length > 0 ? (
                sensitive.map((a) => (
                  <div key={a.id} className="meta-row">
                    <span className="k" style={{ minWidth: '120px' }}>
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
                        : a.actor?.name || 'Unknown user'}{' '}
                      · {auditActionLabel(a.action)}
                    </span>
                  </div>
                ))
              ) : (
                <p className="muted">
                  No access grants, role changes, deactivations or password resets among the last
                  100 audit entries.
                </p>
              )}
            </div>
          </div>
        </div>

        <div className="card">
          <div className="card-head">
            <span className="h3">Sampling shortcuts</span>
          </div>
          <div className="card-body" style={{ paddingTop: '6px' }}>
            {shortcuts.map((s) => (
              <Link
                key={s.href}
                href={s.href}
                className="metric-li"
                style={{ color: 'inherit', textDecoration: 'none' }}
              >
                <span>{s.label}</span>
                <span className="caption">Sample →</span>
              </Link>
            ))}
            <div className="caption mt-2">
              Every document view and download is recorded in the audit trail.
            </div>
          </div>
        </div>
      </div>

      <div className="mt-4">
        <QuickAccessCard showActions={false} />
      </div>
    </div>
  );
}
