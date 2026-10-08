'use client';

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useUIStore } from '@/store/useUIStore';
import { usePermissions } from '@/hooks/usePermissions';
import { useCirculars } from '@/apis/hooks/useCirculars';
import { Table, Column } from '@/components/ui/Table';
import { Pagination } from '@/components/ui/Pagination';
import { Icon } from '@/components/ui/Icons';
import { UrgBadge } from '@/components/ui/Badges';
import { ErrorMessage } from '@/components/common/ErrorMessage';
import { SkeletonTable } from '@/components/common/Skeleton';
import {
  CIRCULAR_STATUS_LABEL,
  CircularStatusBadge,
  circularReference,
} from '@/components/circulars/circularLabels';
import { fmtDate } from '@/utils/helpers';
import type { CircularListItem, CircularStatus } from '@/types/models';

const PAGE_SIZE = 20;

const STATUSES = Object.keys(CIRCULAR_STATUS_LABEL) as CircularStatus[];

/** What the date column means depends on where the circular is in its life. */
function lifecycleDate(c: CircularListItem): string {
  if (c.status === 'draft') return `Edited ${fmtDate(c.updatedAt)}`;
  if (c.status === 'scheduled') return `Goes out ${fmtDate(c.publishAt)}`;
  if (c.status === 'withdrawn') return `Withdrawn ${fmtDate(c.withdrawnAt)}`;
  return `Published ${fmtDate(c.publishedAt)}`;
}

/**
 * The circulars archive for authors, publishers and auditors — everything
 * within the caller's `circular:view` scope, any status.
 */
export default function ManageCircularsPage() {
  const router = useRouter();
  const { setPageTitle } = useUIStore();
  const { hasPermission } = usePermissions();
  const canCreate = hasPermission('circular', 'create');

  const [status, setStatus] = useState<CircularStatus | ''>('');
  const [search, setSearch] = useState('');
  const [query, setQuery] = useState('');
  const [page, setPage] = useState(1);

  const { data, isLoading, isError, refetch } = useCirculars({
    status: status || undefined,
    search: query || undefined,
    page,
    limit: PAGE_SIZE,
  });
  const rows = data?.data ?? [];

  useEffect(() => {
    setPageTitle('Manage circulars');
  }, [setPageTitle]);

  useEffect(() => {
    const t = window.setTimeout(() => {
      setQuery(search.trim());
      setPage(1);
    }, 300);
    return () => window.clearTimeout(t);
  }, [search]);

  const cols: Column<CircularListItem>[] = [
    {
      key: 'title',
      label: 'Circular',
      render: (c) => (
        <span>
          <b>{c.title}</b>
          <div className="caption">
            {circularReference(c)}
            {c.category ? ` · ${c.category}` : ''}
          </div>
        </span>
      ),
    },
    { key: 'status', label: 'Status', render: (c) => <CircularStatusBadge status={c.status} /> },
    {
      key: 'publishedAt',
      label: 'When',
      render: (c) => <span className="caption">{lifecycleDate(c)}</span>,
    },
    {
      key: 'recipientCount',
      label: 'Recipients',
      num: true,
      render: (c) => (c.status === 'draft' || c.status === 'scheduled' ? '—' : c.recipientCount),
    },
    {
      key: 'requiresAcknowledgement',
      label: 'Acknowledgement',
      render: (c) =>
        c.requiresAcknowledgement ? (
          <span className="caption">
            Required{c.acknowledgementDueAt ? ` by ${fmtDate(c.acknowledgementDueAt)}` : ''}
          </span>
        ) : (
          <span className="badge b-urg-low">FYI</span>
        ),
    },
    {
      key: 'urgency',
      label: 'Urgency',
      render: (c) => <UrgBadge level={c.urgency} />,
    },
    {
      key: 'creator',
      label: 'Author',
      render: (c) => <span className="caption">{c.creator?.name ?? '—'}</span>,
    },
  ];

  return (
    <div>
      <div className="page-head">
        <div>
          <div className="page-title">Manage circulars</div>
          <div className="page-sub">
            Draft, publish and track acknowledgement of circulars within your scope.
          </div>
        </div>
        <div className="actions">
          <button
            className="btn btn-primary"
            disabled={!canCreate}
            title={!canCreate ? "You don't have permission to write circulars" : undefined}
            onClick={() => router.push('/circulars/manage/new')}
          >
            <Icon name="plus" size={15} /> New circular
          </button>
        </div>
      </div>

      <div className="flex gap-2 flex-wrap items-center mb-4">
        <select
          className="input"
          style={{ width: 'auto', height: 32 }}
          aria-label="Status"
          value={status}
          onChange={(e) => {
            setStatus(e.target.value as CircularStatus | '');
            setPage(1);
          }}
        >
          <option value="">All statuses</option>
          {STATUSES.map((s) => (
            <option key={s} value={s}>
              {CIRCULAR_STATUS_LABEL[s]}
            </option>
          ))}
        </select>
        <input
          className="input"
          style={{ maxWidth: 300, height: 32 }}
          placeholder="Search reference, title, category or text…"
          aria-label="Search circulars"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      {isLoading ? (
        <SkeletonTable
          columns={[
            'Circular',
            'Status',
            'When',
            'Recipients',
            'Acknowledgement',
            'Urgency',
            'Author',
          ]}
          rows={8}
        />
      ) : isError ? (
        <ErrorMessage message="Failed to load circulars." retry={() => refetch()} />
      ) : (
        <>
          <div className="card">
            <Table
              cols={cols}
              rows={rows}
              onRow={(c) => router.push(`/circulars/manage/${c.id}`)}
              emptyMsg={query || status ? 'No circulars match these filters.' : 'No circulars yet.'}
            />
          </div>
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
  );
}
