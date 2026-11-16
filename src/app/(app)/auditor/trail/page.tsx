'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { useUIStore } from '@/store/useUIStore';
import { useAuditEntries, useExportAuditCsv } from '@/apis/hooks/useAudit';
import { UserSearchCombobox } from '@/components/common/UserSearchCombobox';
import { usePermissions } from '@/hooks/usePermissions';
import { Table, Column } from '@/components/ui/Table';
import { Pagination } from '@/components/ui/Pagination';
import { SkeletonTable } from '@/components/common/Skeleton';
import { ErrorMessage } from '@/components/common/ErrorMessage';
import { AuditEntry } from '@/types/models';
import { AuditTypeActionFilters } from '@/components/audit/AuditTypeActionFilters';
import { auditActionLabel } from '@/constants/auditVocabulary';

const PAGE_SIZE = 20;

export default function AuditorTrailPage() {
  const router = useRouter();
  const { setPageTitle } = useUIStore();

  const [page, setPage] = useState(1);
  const [actorId, setActorId] = useState('');
  const [action, setAction] = useState('');
  const [objectType, setObjectType] = useState('');
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
    action: action || undefined,
    objectType: objectType || undefined,
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
  const { can } = usePermissions();
  const canExport = can('audit', 'export');
  const canRaise = can('control_exception', 'create');

  useEffect(() => {
    setPageTitle('Audit Trail');
  }, [setPageTitle]);

  const actorName = (a: AuditEntry) =>
    a.actorType === 'system' || !a.actorId ? 'System' : a.actor?.name || 'Unknown user';

  const handleExport = () => {
    exportCsv.mutate({
      actorId: filters.actorId,
      action: filters.action,
      objectType: filters.objectType,
      from,
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
    {
      key: 'action',
      label: 'Action',
      render: (a) => (
        <span title={a.action} style={{ fontWeight: 500 }}>
          {auditActionLabel(a.action)}
        </span>
      ),
    },
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
    ...(canRaise
      ? [
          {
            key: 'id' as const,
            label: '',
            render: (a: AuditEntry) => (
              <button
                className="btn btn-ghost btn-sm"
                title="Raise a finding from this event"
                onClick={(e) => {
                  e.stopPropagation();
                  router.push(`/control-exceptions/new?fromAudit=${a.id}`);
                }}
              >
                Raise finding
              </button>
            ),
          },
        ]
      : []),
  ];

  return (
    <div>
      <div className="page-head">
        <div>
          <div className="page-title">Audit Trail</div>
          <div className="page-sub">
            Filter events by actor, action and period, and raise a finding from any event.
          </div>
        </div>
        <div className="actions">
          <AuditTypeActionFilters
            objectType={objectType}
            action={action}
            onChange={(next) => {
              setObjectType(next.objectType);
              setAction(next.action);
              setPage(1);
            }}
          />
          <UserSearchCombobox
            value={actorId}
            onChange={(id) => {
              setActorId(id);
              setPage(1);
            }}
            placeholder="All actors"
            ariaLabel="Filter by actor"
            compact
            style={{ width: 220 }}
          />
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
              disabled={exportCsv.isPending || !canExport}
              title={!canExport ? "You don't have permission to export the audit trail" : undefined}
            >
              {exportCsv.isPending ? 'Exporting…' : 'Export extract'}
            </button>
          </div>
        </div>
        {isLoading ? (
          <SkeletonTable columns={['Timestamp', 'Actor', 'Action', 'Object', 'Detail', '']} rows={8} />
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
