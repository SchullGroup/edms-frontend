'use client';

import React, { useState, useEffect } from 'react';
import { useUIStore } from '@/store/useUIStore';
import { Table, Column } from '@/components/ui/Table';
import { Pagination } from '@/components/ui/Pagination';
import { useAuditEntries, useExportAuditCsv, useVerifyAuditChain } from '@/apis/hooks/useAudit';
import { useUsers } from '@/apis/hooks/useUsers';
import { Spinner } from '@/components/common/Spinner';
import { ErrorMessage } from '@/components/common/ErrorMessage';
import { AuditEntry } from '@/types/models';

const PAGE_SIZE = 20;

export default function TenantAuditPage() {
  const { setPageTitle, addToast } = useUIStore();

  const [page, setPage] = useState(1);
  const [actorId, setActorId] = useState('');
  const [action, setAction] = useState('');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');

  const filters = {
    page,
    limit: PAGE_SIZE,
    actorId: actorId || undefined,
    action: action.trim() || undefined,
    from: from || undefined,
    to: to || undefined,
  };

  const {
    data: auditData,
    isLoading: isLoadingAudit,
    isError: isErrorAudit,
    refetch: refetchAudit,
  } = useAuditEntries(filters);
  const { data: usersData, isLoading: isLoadingUsers } = useUsers();

  const rows = auditData?.data || [];
  const users = usersData?.data || [];

  const exportCsv = useExportAuditCsv();
  const verifyChain = useVerifyAuditChain();

  useEffect(() => {
    setPageTitle('Tenant Audit');
  }, [setPageTitle]);

  const actorName = (a: AuditEntry) =>
    a.actorType === 'system' || !a.actorId
      ? 'System'
      : users.find((u: any) => u.id === a.actorId)?.name || a.actorId;

  const handleExport = () => {
    exportCsv.mutate({ actorId: filters.actorId, action: filters.action, from, to });
  };

  const handleVerify = () => {
    verifyChain.mutate(
      { from: from || undefined, to: to || undefined },
      {
        onSuccess: (result) => {
          addToast(
            result.intact
              ? `Chain verified — ${result.entriesChecked} entries, no breaks found`
              : `Chain verification FAILED over ${result.entriesChecked} entries — see console`,
            result.intact ? 'success' : 'error',
          );
          if (!result.intact) console.error('Audit chain verification failed', result);
        },
        onError: (err: any) => {
          addToast(err.response?.data?.message || 'Failed to verify chain', 'error');
        },
      },
    );
  };

  const cols: Column<AuditEntry>[] = [
    {
      key: 'occurredAt',
      label: 'When',
      sortable: true,
      render: (a) => new Date(a.occurredAt).toLocaleString(),
    },
    { key: 'actorId', label: 'Actor', render: (a) => actorName(a) },
    { key: 'action', label: 'Action', render: (a) => <span className="kbd">{a.action}</span> },
    {
      key: 'objectId',
      label: 'Object',
      render: (a) =>
        a.objectId ? (
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
  ];

  return (
    <div>
      <div className="page-head">
        <div>
          <div className="page-title">Tenant Audit</div>
          <div className="page-sub">Tenant-scoped, hash-chained immutable event log.</div>
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
          <input
            className="input"
            type="date"
            aria-label="From date"
            style={{ width: 'auto', height: '32px' }}
            value={from}
            onChange={(e) => {
              setFrom(e.target.value);
              setPage(1);
            }}
          />
          <input
            className="input"
            type="date"
            aria-label="To date"
            style={{ width: 'auto', height: '32px' }}
            value={to}
            onChange={(e) => {
              setTo(e.target.value);
              setPage(1);
            }}
          />
        </div>
      </div>

      <div className="card">
        <div className="card-head">
          <span className="h3">{auditData?.pagination?.total ?? 0} events (immutable, tenant-scoped)</span>
          <div className="flex gap-2">
            <button
              className="btn btn-secondary btn-sm"
              onClick={handleVerify}
              disabled={verifyChain.isPending}
            >
              {verifyChain.isPending ? 'Verifying…' : 'Verify integrity'}
            </button>
            <button
              className="btn btn-secondary btn-sm"
              onClick={handleExport}
              disabled={exportCsv.isPending}
            >
              {exportCsv.isPending ? 'Exporting…' : 'Export'}
            </button>
          </div>
        </div>
        {isLoadingAudit || isLoadingUsers ? (
          <Spinner text="Loading audit logs..." />
        ) : isErrorAudit ? (
          <ErrorMessage message="Failed to load audit logs." retry={refetchAudit} />
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
