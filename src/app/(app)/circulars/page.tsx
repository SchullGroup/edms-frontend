'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useUIStore } from '@/store/useUIStore';
import { usePermissions } from '@/hooks/usePermissions';
import { useCircularInbox, useCircularInboxSummary } from '@/apis/hooks/useCirculars';
import { Icon } from '@/components/ui/Icons';
import { UrgBadge } from '@/components/ui/Badges';
import { Pagination } from '@/components/ui/Pagination';
import { EmptyState } from '@/components/ui/EmptyState';
import { ErrorMessage } from '@/components/common/ErrorMessage';
import { SkeletonTaskRows } from '@/components/common/Skeleton';
import { AckStateBadge, circularReference } from '@/components/circulars/circularLabels';
import { fmtDate } from '@/utils/helpers';
import type { CircularInboxFilter, CircularInboxItem } from '@/types/models';

const PAGE_SIZE = 20;

const FILTERS: [CircularInboxFilter, string][] = [
  ['all', 'All'],
  ['unread', 'Unread'],
  ['unacknowledged', 'To acknowledge'],
  ['acknowledged', 'Acknowledged'],
];

/**
 * The recipient inbox: circulars the signed-in user was sent. "In force" is
 * what's published now; the archive holds expired and superseded ones.
 * Withdrawn circulars never appear — the backend removes them.
 */
export default function CircularsInboxPage() {
  const router = useRouter();
  const { setPageTitle } = useUIStore();
  const { hasPermission } = usePermissions();
  const [archived, setArchived] = useState(false);
  const [filter, setFilter] = useState<CircularInboxFilter>('all');
  const [search, setSearch] = useState('');
  const [query, setQuery] = useState('');
  const [page, setPage] = useState(1);

  const { data, isLoading, isError, refetch } = useCircularInbox({
    archived,
    filter,
    search: query || undefined,
    page,
    limit: PAGE_SIZE,
  });
  const { data: summary } = useCircularInboxSummary();
  const items = data?.data ?? [];

  useEffect(() => {
    setPageTitle('Circulars');
  }, [setPageTitle]);

  // Debounce the search box so each keystroke isn't a request.
  useEffect(() => {
    const t = window.setTimeout(() => {
      setQuery(search.trim());
      setPage(1);
    }, 300);
    return () => window.clearTimeout(t);
  }, [search]);

  return (
    <div>
      <div className="page-head">
        <div>
          <div className="page-title">Circulars</div>
          <div className="page-sub">
            Notices sent to you.
            {summary && summary.unacknowledged > 0 && (
              <>
                {' '}
                <b>{summary.unacknowledged}</b> waiting for your acknowledgement.
              </>
            )}
          </div>
        </div>
        {hasPermission('circular', 'view') && (
          <div className="actions">
            <Link className="btn btn-secondary" href="/circulars/manage">
              Manage circulars
            </Link>
          </div>
        )}
      </div>

      <div className="tabs">
        <button
          className={`tab ${!archived ? 'active' : ''}`}
          onClick={() => {
            setArchived(false);
            setPage(1);
          }}
        >
          In force
          {summary && summary.unread > 0 ? ` (${summary.unread} unread)` : ''}
        </button>
        <button
          className={`tab ${archived ? 'active' : ''}`}
          onClick={() => {
            setArchived(true);
            setPage(1);
          }}
        >
          Archive
        </button>
      </div>

      <div className="flex gap-2 flex-wrap items-center mb-4">
        <div className="seg" role="group" aria-label="Filter circulars">
          {FILTERS.map(([value, label]) => (
            <button
              key={value}
              className={filter === value ? 'active' : ''}
              aria-pressed={filter === value}
              onClick={() => {
                setFilter(value);
                setPage(1);
              }}
            >
              {label}
            </button>
          ))}
        </div>
        <input
          className="input"
          style={{ maxWidth: 280, height: 32 }}
          placeholder="Search reference, title or category…"
          aria-label="Search circulars"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      <div className="card">
        {isLoading ? (
          <div role="status" aria-busy="true" aria-label="Loading circulars">
            <SkeletonTaskRows rows={6} />
          </div>
        ) : isError ? (
          <div style={{ padding: 32 }}>
            <ErrorMessage message="Failed to load your circulars." retry={() => refetch()} />
          </div>
        ) : items.length > 0 ? (
          <div className="rowlist">
            {items.map((c) => (
              <InboxRow key={c.id} item={c} onOpen={() => router.push(`/circulars/${c.id}`)} />
            ))}
          </div>
        ) : (
          <EmptyState
            icon="speaker"
            title={archived ? 'Nothing in the archive' : 'No circulars'}
            message={
              query || filter !== 'all'
                ? 'Nothing matches these filters.'
                : archived
                  ? 'Expired and replaced circulars move here.'
                  : 'Circulars sent to you appear here.'
            }
          />
        )}
      </div>

      {data?.pagination && data.pagination.totalPages > 1 && (
        <Pagination
          page={data.pagination.page}
          totalPages={data.pagination.totalPages}
          total={data.pagination.total}
          limit={data.pagination.limit}
          onPageChange={setPage}
        />
      )}
    </div>
  );
}

function InboxRow({ item: c, onOpen }: { item: CircularInboxItem; onOpen: () => void }) {
  const unread = !c.receipt.readAt;
  const overdue =
    c.requiresAcknowledgement &&
    !c.receipt.acknowledgedAt &&
    !!c.acknowledgementDueAt &&
    new Date(c.acknowledgementDueAt) < new Date();

  return (
    <div
      className={`task-row ${overdue ? 'overdue' : ''}`}
      role="button"
      tabIndex={0}
      onClick={onOpen}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onOpen();
        }
      }}
    >
      <Icon name="speaker" size={18} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontWeight: unread ? 800 : 600, fontSize: 13.5 }}>
          {unread && <span className="sr-only">Unread: </span>}
          {c.title}
        </div>
        <div className="caption" style={{ marginTop: 3 }}>
          {circularReference(c)}
          {c.category ? ` · ${c.category}` : ''} · {fmtDate(c.publishedAt)}
          {c.publisher?.name ? ` · ${c.publisher.name}` : ''}
          {c.requiresAcknowledgement && !c.receipt.acknowledgedAt && c.acknowledgementDueAt
            ? ` · acknowledge by ${fmtDate(c.acknowledgementDueAt)}`
            : ''}
          {c.status === 'superseded' ? ' · replaced by a newer version' : ''}
          {c.status === 'expired' ? ' · expired' : ''}
        </div>
      </div>
      {c.urgency !== 'normal' && <UrgBadge level={c.urgency} />}
      <AckStateBadge
        requiresAcknowledgement={c.requiresAcknowledgement}
        acknowledgedAt={c.receipt.acknowledgedAt}
      />
    </div>
  );
}
