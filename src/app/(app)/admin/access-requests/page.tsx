'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useUIStore } from '@/store/useUIStore';
import { Table, Column } from '@/components/ui/Table';
import { Pagination } from '@/components/ui/Pagination';
import {
  useAccessRequestsInbox,
  useGrantAccessRequest,
  useDenyAccessRequest,
} from '@/apis/hooks/useDocuments';
import { Spinner } from '@/components/common/Spinner';
import { ErrorMessage } from '@/components/common/ErrorMessage';
import { AccessRequest } from '@/types/models';
import { fmtDateTime } from '@/utils/helpers';

const PAGE_SIZE = 20;

export default function AccessRequestsInboxPage() {
  const router = useRouter();
  const { setPageTitle, openConfirm } = useUIStore();

  const [page, setPage] = useState(1);
  const [status, setStatus] = useState<'' | 'pending' | 'approved' | 'denied'>('pending');

  const {
    data,
    isLoading,
    isError,
    refetch,
  } = useAccessRequestsInbox({ page, limit: PAGE_SIZE, status: status || undefined });
  const rows = data?.data || [];

  const grantRequest = useGrantAccessRequest();
  const denyRequest = useDenyAccessRequest();

  useEffect(() => {
    setPageTitle('Access Requests');
  }, [setPageTitle]);

  const handleGrant = (r: AccessRequest) => {
    openConfirm({
      title: 'Grant access?',
      message: `Creates a standing, view-only access grant for ${r.requester.name} on "${r.document?.title}" — it bypasses confidentiality tier and own/department scope for viewing, but never edit, delete or checkout.`,
      confirmLabel: 'Grant view access',
      onConfirm: () =>
        grantRequest.mutateAsync({ id: r.documentId, requestId: r.id }).then(() => {}),
    });
  };

  const handleDeny = (r: AccessRequest) => {
    openConfirm({
      title: 'Deny this request?',
      message: `${r.requester.name} will not get access to "${r.document?.title}". No grant is created.`,
      confirmLabel: 'Deny request',
      danger: true,
      onConfirm: () =>
        denyRequest.mutateAsync({ id: r.documentId, requestId: r.id }).then(() => {}),
    });
  };

  const cols: Column<AccessRequest>[] = [
    {
      key: 'document',
      label: 'Document',
      render: (r) =>
        r.document ? (
          <a
            onClick={(e) => {
              e.stopPropagation();
              router.push(`/doc/${r.documentId}`);
            }}
            style={{ fontWeight: 700, cursor: 'pointer' }}
          >
            {r.document.title}
          </a>
        ) : (
          r.documentId
        ),
    },
    {
      key: 'requesterId',
      label: 'Requester',
      render: (r) => (
        <span>
          <div style={{ fontWeight: 600 }}>{r.requester.name}</div>
          <div className="caption">{r.requester.email}</div>
        </span>
      ),
    },
    {
      key: 'reason',
      label: 'Reason',
      render: (r) => <span style={{ fontSize: '12px' }}>{r.reason || '—'}</span>,
    },
    {
      key: 'createdAt',
      label: 'Requested',
      sortable: true,
      render: (r) => fmtDateTime(r.createdAt),
    },
    {
      key: 'status',
      label: 'Status',
      render: (r) => (
        <span
          className={`badge ${r.status === 'approved' ? 'b-status-closed' : r.status === 'denied' ? 'b-status-overdue' : 'b-status-pending'}`}
        >
          {r.status}
        </span>
      ),
    },
    {
      key: 'id',
      label: '',
      render: (r) =>
        r.status === 'pending' ? (
          <div className="flex gap-2">
            <button
              className="btn btn-secondary btn-sm"
              disabled={grantRequest.isPending || denyRequest.isPending}
              onClick={(e) => {
                e.stopPropagation();
                handleGrant(r);
              }}
            >
              Grant
            </button>
            <button
              className="btn btn-secondary btn-sm"
              disabled={grantRequest.isPending || denyRequest.isPending}
              onClick={(e) => {
                e.stopPropagation();
                handleDeny(r);
              }}
            >
              Deny
            </button>
          </div>
        ) : (
          <span className="caption">
            {r.reviewer ? `by ${r.reviewer.name}` : ''}
            {r.reviewedAt ? ` · ${fmtDateTime(r.reviewedAt)}` : ''}
          </span>
        ),
    },
  ];

  return (
    <div>
      <div className="page-head">
        <div>
          <div className="page-title">Access Requests</div>
          <div className="page-sub">
            Requests from users blocked by confidentiality tier or own/department scope.
            Granting creates a standing, view-only exception for that document.
          </div>
        </div>
        <div className="actions">
          <select
            className="input"
            style={{ width: 'auto', height: '32px' }}
            aria-label="Filter by status"
            value={status}
            onChange={(e) => {
              setStatus(e.target.value as typeof status);
              setPage(1);
            }}
          >
            <option value="pending">Pending</option>
            <option value="approved">Approved</option>
            <option value="denied">Denied</option>
            <option value="">All</option>
          </select>
        </div>
      </div>

      <div className="card">
        <div className="card-head">
          <span className="h3">{data?.pagination?.total ?? 0} requests</span>
        </div>
        {isLoading ? (
          <Spinner text="Loading access requests..." />
        ) : isError ? (
          <ErrorMessage message="Failed to load access requests." retry={refetch} />
        ) : rows.length === 0 ? (
          <div className="empty-state" style={{ padding: '32px' }}>
            No {status || ''} access requests.
          </div>
        ) : (
          <>
            <Table cols={cols} rows={rows} />
            {data?.pagination && (
              <Pagination
                page={data.pagination.page}
                totalPages={data.pagination.totalPages}
                total={data.pagination.total}
                limit={data.pagination.limit}
                onPageChange={setPage}
              />
            )}
          </>
        )}
      </div>
    </div>
  );
}
