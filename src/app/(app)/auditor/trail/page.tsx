'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { useStore } from '@/store/useStore';
import { useUIStore } from '@/store/useUIStore';
import { useAuditEntries, useExportAuditCsv } from '@/apis/hooks/useAudit';
import { useUsers } from '@/apis/hooks/useUsers';
import { Table, Column } from '@/components/ui/Table';
import { Pagination } from '@/components/ui/Pagination';
import { Spinner } from '@/components/common/Spinner';
import { ErrorMessage } from '@/components/common/ErrorMessage';
import { AuditEntry } from '@/types/models';

const PAGE_SIZE = 20;

export default function AuditorTrailPage() {
  const router = useRouter();
  // `auditAction` here is the separate, local, SEED-backed pseudo-log used
  // for "raise a finding" (findings has no real backend at all yet) — not
  // the same thing as the real trail this page now reads.
  const { auditAction } = useStore();
  const { setPageTitle, openModal, closeModal, addToast } = useUIStore();
  const { data: usersData } = useUsers();
  const users = usersData?.data || [];

  const [page, setPage] = useState(1);
  const [actorId, setActorId] = useState('');
  const [action, setAction] = useState('');
  const [days, setDays] = useState(30);

  // Memoized on `days` alone — recomputing this from `Date.now()` on every
  // render changed `filters.from` by a few milliseconds each time, which
  // changed `useAuditEntries`' query key every render and made the trail
  // refetch forever (the endpoint was always returning data fine; the query
  // just never reused its own result).
  const from = useMemo(
    () => new Date(Date.now() - days * 86400000).toISOString(),
    [days],
  );
  const filters = {
    page,
    limit: PAGE_SIZE,
    actorId: actorId || undefined,
    action: action.trim() || undefined,
    from,
  };

  const {
    data: auditData,
    isLoading,
    isError,
    refetch,
  } = useAuditEntries(filters);
  const rows = auditData?.data || [];

  const exportCsv = useExportAuditCsv();

  useEffect(() => {
    setPageTitle('Audit Trail');
  }, [setPageTitle]);

  const actorName = (a: AuditEntry) =>
    a.actorType === 'system' || !a.actorId
      ? 'System'
      : users.find((u: any) => u.id === a.actorId)?.name || a.actorId;

  const handleExport = () => {
    exportCsv.mutate({ actorId: filters.actorId, action: filters.action, from });
  };

  const handleRaiseFinding = (a: AuditEntry) => {
    let title = '';
    let detail = `Observed in audit trail: ${a.action}${a.objectType ? ` on ${a.objectType}` : ''}`;
    let sev = 'Medium';

    openModal({
      title: 'Raise finding from event',
      body: (
        <div>
          <div className="field">
            <label>
              Title <span className="req">*</span>
            </label>
            <input
              className="input"
              placeholder="Short finding title"
              onChange={(e) => (title = e.target.value)}
            />
          </div>
          <div className="field">
            <label>
              Detail &amp; evidence <span className="req">*</span>
            </label>
            <textarea
              className="input"
              style={{ minHeight: '90px' }}
              defaultValue={detail}
              onChange={(e) => (detail = e.target.value)}
            ></textarea>
          </div>
          <div className="field">
            <label>Severity</label>
            <select className="input" defaultValue={sev} onChange={(e) => (sev = e.target.value)}>
              <option>High</option>
              <option>Medium</option>
              <option>Low</option>
            </select>
          </div>
        </div>
      ),
      actions: [
        { label: 'Cancel' },
        {
          label: 'Raise finding',
          kind: 'btn-primary',
          onClick: () => {
            if (!title.trim() || !detail.trim()) {
              addToast('Title and detail are required', 'error');
              return false;
            }
            // Real implementation would add to findings state — see
            // docs/05 §5: no `Finding` model exists on the backend yet.
            auditAction('FINDING_RAISE', 'FND-NEW', 'Raised: ' + title);
            addToast('Finding raised', 'success');
          },
        },
      ],
    });
  };

  const cols: Column<AuditEntry>[] = [
    {
      key: 'occurredAt',
      label: 'Timestamp',
      sortable: true,
      render: (a) => new Date(a.occurredAt).toLocaleString(),
    },
    { key: 'actorId', label: 'Actor', render: (a) => actorName(a) },
    { key: 'action', label: 'Action', render: (a) => <span className="kbd">{a.action}</span> },
    {
      key: 'objectId',
      label: 'Object',
      render: (a) =>
        a.objectType === 'document' && a.objectId ? (
          <button
            className="btn btn-ghost btn-sm"
            style={{ padding: '2px 6px', fontWeight: 700 }}
            onClick={(e) => {
              e.stopPropagation();
              router.push(`/doc/${a.objectId}`);
            }}
          >
            {a.objectId.slice(0, 8).toUpperCase()}
          </button>
        ) : a.objectId ? (
          <span className="caption">
            {a.objectType} · {a.objectId.slice(0, 8)}
          </span>
        ) : (
          <span className="caption">—</span>
        ),
    },
    {
      key: 'metadata',
      label: 'Detail',
      render: (a) =>
        a.metadata ? (
          <span style={{ fontSize: '12px' }} title={JSON.stringify(a.metadata)}>
            {Object.entries(a.metadata)
              .slice(0, 2)
              .map(([k, v]) => `${k}: ${String(v)}`)
              .join(' · ')}
          </span>
        ) : (
          <span className="caption">—</span>
        ),
    },
    {
      key: 'id',
      label: '',
      render: (a) => (
        <button
          className="btn btn-ghost btn-sm"
          title="Raise a finding from this event"
          onClick={(e) => {
            e.stopPropagation();
            handleRaiseFinding(a);
          }}
        >
          Raise finding
        </button>
      ),
    },
  ];

  return (
    <div>
      <div className="page-head">
        <div>
          <div className="page-title">Audit Trail</div>
          <div className="page-sub">
            Filter events by actor, action and period; raise findings directly from evidence.
          </div>
        </div>
        <div className="actions">
          <input
            className="input"
            type="text"
            placeholder="Filter by action…"
            style={{ width: '160px', height: '32px' }}
            value={action}
            onChange={(e) => {
              setAction(e.target.value);
              setPage(1);
            }}
          />
          <select
            className="input"
            style={{ width: 'auto', height: '32px' }}
            aria-label="Filter by actor"
            value={actorId}
            onChange={(e) => {
              setActorId(e.target.value);
              setPage(1);
            }}
          >
            <option value="">All actors</option>
            {users.map((u: any) => (
              <option key={u.id} value={u.id}>
                {u.name}
              </option>
            ))}
          </select>
          <select
            className="input"
            style={{ width: 'auto', height: '32px' }}
            value={days}
            onChange={(e) => {
              setDays(Number(e.target.value));
              setPage(1);
            }}
          >
            <option value={30}>Last 30 days</option>
            <option value={7}>Last 7 days</option>
            <option value={90}>Last 90 days</option>
          </select>
        </div>
      </div>

      <div className="card">
        <div className="card-head">
          <span className="h3">{auditData?.pagination?.total ?? 0} immutable events</span>
          <div className="flex gap-2">
            <button
              className="btn btn-secondary btn-sm"
              onClick={handleExport}
              disabled={exportCsv.isPending}
            >
              {exportCsv.isPending ? 'Exporting…' : 'Export extract'}
            </button>
          </div>
        </div>
        {isLoading ? (
          <Spinner text="Loading audit trail..." />
        ) : isError ? (
          <ErrorMessage message="Failed to load the audit trail." retry={refetch} />
        ) : (
          <>
            <Table cols={cols} rows={rows} />
            {auditData?.pagination && (
              <Pagination
                page={auditData.pagination.page}
                totalPages={auditData.pagination.totalPages}
                total={auditData.pagination.total}
                limit={auditData.pagination.limit}
                onPageChange={setPage}
              />
            )}
          </>
        )}
      </div>
    </div>
  );
}
