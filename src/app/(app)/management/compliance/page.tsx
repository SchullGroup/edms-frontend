'use client';

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useUIStore } from '@/store/useUIStore';
import { useAuditEntries } from '@/apis/hooks/useAudit';
import { useControlExceptionReport, useControlExceptions } from '@/apis/hooks/useControlExceptions';
import { usePermissions } from '@/hooks/usePermissions';
import { HBarChart } from '@/components/ui/Charts';
import { Icon } from '@/components/ui/Icons';
import { Table, Column } from '@/components/ui/Table';
import { ErrorMessage } from '@/components/common/ErrorMessage';
import { Skeleton } from '@/components/common/Skeleton';
import {
  CATEGORY_LABEL,
  ControlExceptionStatusBadge,
  STATUSES,
  STATUS_LABEL,
  SeverityBadge,
} from '@/components/controlExceptions/controlExceptionLabels';
import { SENSITIVE_AUDIT_ACTIONS, auditActionLabel } from '@/constants/auditVocabulary';
import { fmtDate } from '@/utils/helpers';
import type { ControlException, ControlExceptionStatus } from '@/types/models';

const STATUS_COLOR: Record<ControlExceptionStatus, string> = {
  open: 'var(--status-pending)',
  reported: 'var(--status-overdue)',
  acknowledged: 'var(--status-progress)',
  resolved: 'var(--status-closed)',
};

const DAY_MS = 24 * 60 * 60 * 1000;

/** Audit findings (`/control-exceptions`) and sensitive audit-trail activity, for management and auditors. */
export default function ComplianceOverviewPage() {
  const router = useRouter();
  const { setPageTitle } = useUIStore();
  const { can } = usePermissions();
  const canViewFindings = can('control_exception', 'view');
  const canViewAudit = can('audit', 'view');

  // Fixed on mount so the query key doesn't change on every render.
  const [since] = useState(() => new Date(Date.now() - 30 * DAY_MS).toISOString());

  const report = useControlExceptionReport({}, { enabled: canViewFindings });
  const recentReport = useControlExceptionReport({ from: since }, { enabled: canViewFindings });
  const latest = useControlExceptions({ page: 1, limit: 8 }, { enabled: canViewFindings });
  const audit = useAuditEntries({ limit: 100, page: 1 }, { enabled: canViewAudit });

  useEffect(() => {
    setPageTitle('Compliance overview');
  }, [setPageTitle]);

  const byStatus = report.data?.byStatus ?? {};
  const withManagement = (byStatus.reported ?? 0) + (byStatus.acknowledged ?? 0);
  const openRegister = (status?: ControlExceptionStatus) =>
    router.push(status ? `/control-exceptions?status=${status}` : '/control-exceptions');
  const tileKeys = (status: ControlExceptionStatus) => ({
    role: 'button',
    tabIndex: 0,
    onClick: () => openRegister(status),
    onKeyDown: (e: React.KeyboardEvent) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        openRegister(status);
      }
    },
  });

  // `GET /audit` is newest first, so the first matches are the most recent.
  const sensitive = (audit.data?.data ?? [])
    .filter((a) => SENSITIVE_AUDIT_ACTIONS.includes(a.action))
    .slice(0, 8);

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
      key: 'status',
      label: 'Status',
      render: (c) => <ControlExceptionStatusBadge status={c.status} />,
    },
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

  const tileValue = (n: number | undefined) =>
    report.isLoading ? <Skeleton height={28} width={40} /> : (n ?? 0);

  return (
    <div>
      <div className="page-head">
        <div>
          <div className="page-title">Compliance overview</div>
          <div className="page-sub">
            Audit findings and sensitive account activity in one place.
          </div>
        </div>
        {canViewFindings && (
          <div className="actions">
            <button
              className="btn btn-secondary"
              onClick={() => router.push('/control-exceptions/report')}
            >
              <Icon name="report" size={15} /> Findings report
            </button>
          </div>
        )}
      </div>

      {!canViewFindings ? (
        <div className="banner info">
          <Icon name="info" size={15} />
          <span>
            Your role can&apos;t view audit findings. An administrator can add Audit findings · View
            to your role.
          </span>
        </div>
      ) : report.isError ? (
        <div className="mb-4">
          <ErrorMessage
            message="Failed to load audit findings."
            retry={() => {
              report.refetch();
              recentReport.refetch();
            }}
          />
        </div>
      ) : (
        <div className="grid cols-4 mb-4">
          <div className="tile t-pending" {...tileKeys('open')}>
            <div className="cnt">{tileValue(byStatus.open)}</div>
            <div className="lbl">
              <Icon name="edit" size={13} /> Not yet reported
            </div>
          </div>
          {/* Two statuses, and the register filters by one, so this tile doesn't link. */}
          <div className="tile t-overdue" style={{ cursor: 'default' }}>
            <div className="cnt">{tileValue(withManagement)}</div>
            <div className="lbl">
              <Icon name="clock" size={13} /> With management
            </div>
          </div>
          <div className="tile t-closed" {...tileKeys('resolved')}>
            <div className="cnt">{tileValue(byStatus.resolved)}</div>
            <div className="lbl">
              <Icon name="check" size={13} /> Resolved
            </div>
          </div>
          <div className="tile t-progress" style={{ cursor: 'default' }}>
            <div className="cnt">
              {recentReport.isLoading ? (
                <Skeleton height={28} width={40} />
              ) : (
                (recentReport.data?.total ?? 0)
              )}
            </div>
            <div className="lbl">
              <Icon name="finding" size={13} /> Raised in the last 30 days
            </div>
          </div>
        </div>
      )}

      <div className="grid cols-2 mb-4">
        {canViewFindings && (
          <div className="card">
            <div className="card-head">
              <span className="h3">Findings by status</span>
              <button className="btn btn-ghost btn-sm" onClick={() => openRegister()}>
                Open register
              </button>
            </div>
            <div className="card-body">
              {report.isLoading ? (
                <Skeleton height={120} />
              ) : report.data?.total ? (
                <HBarChart
                  items={STATUSES.map((s) => ({
                    label: STATUS_LABEL[s],
                    value: byStatus[s] ?? 0,
                    color: STATUS_COLOR[s],
                  }))}
                />
              ) : (
                <p className="muted">No audit findings yet.</p>
              )}
            </div>
          </div>
        )}
        <div className="card">
          <div className="card-head">
            <span className="h3">Recent sensitive activity</span>
          </div>
          <div className="card-body" style={{ paddingTop: '4px' }}>
            {!canViewAudit ? (
              <p className="muted">
                Your role can&apos;t read the audit trail, so sensitive activity isn&apos;t shown
                here. An administrator can add Audit · View to your role.
              </p>
            ) : audit.isLoading ? (
              <Skeleton height={120} />
            ) : audit.isError ? (
              <ErrorMessage
                message="Failed to load the audit trail."
                retry={() => audit.refetch()}
              />
            ) : sensitive.length > 0 ? (
              sensitive.map((a) => (
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
                      : a.actor?.name || 'Unknown user'}{' '}
                    · {auditActionLabel(a.action)}
                  </span>
                </div>
              ))
            ) : (
              <p className="muted">
                No access grants, role changes, deactivations or password resets among the last 100
                audit entries.
              </p>
            )}
          </div>
        </div>
      </div>

      {canViewFindings && (
        <div className="card">
          <div className="card-head">
            <span className="h3">Latest findings</span>
            <button className="btn btn-ghost btn-sm" onClick={() => openRegister()}>
              View all
            </button>
          </div>
          {latest.isError ? (
            <ErrorMessage message="Failed to load audit findings." retry={() => latest.refetch()} />
          ) : latest.isLoading ? (
            <div className="card-body">
              <Skeleton height={160} />
            </div>
          ) : (
            <Table
              cols={cols}
              rows={latest.data?.data ?? []}
              onRow={(c) => router.push(`/control-exceptions/${c.id}`)}
              emptyMsg="No audit findings yet."
            />
          )}
        </div>
      )}
    </div>
  );
}
