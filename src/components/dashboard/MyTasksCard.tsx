'use client';

import React, { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useTasks } from '@/apis/hooks/useTasks';
import type { TaskFilters } from '@/apis/services/tasks.service';
import { Icon } from '@/components/ui/Icons';
import { EmptyState } from '@/components/ui/EmptyState';
import { TaskRow } from '@/components/ui/TaskRow';
import { Pagination } from '@/components/ui/Pagination';
import { SkeletonTaskRows } from '@/components/common/Skeleton';
import { ErrorMessage } from '@/components/common/ErrorMessage';
import { useDebouncedCallback } from '@/hooks/useDebouncedCallback';
import { taskUrgency } from '@/utils/workflowDocuments';
import type { Task } from '@/types/models';

/** `GET /tasks` caps `limit` at 100; the urgency filter works within that. */
const FETCH_LIMIT = 100;
const PAGE_SIZE = 10;

type StatusFilter = 'pending' | 'escalated' | 'overdue' | 'completed' | 'all';
type SortFilter = 'dueAt' | 'oldest' | 'newest';

/** Status, sort, search and paging run on the server. `GET /tasks` has no urgency filter,
 *  so with one set the card fetches the first 100 matches and filters and pages those. */
export function MyTasksCard() {
  const router = useRouter();
  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState<StatusFilter>('pending');
  const [urgency, setUrgency] = useState('');
  const [sort, setSort] = useState<SortFilter>('dueAt');
  const [page, setPage] = useState(1);

  const serverPaged = !urgency;
  const filters: TaskFilters = serverPaged
    ? { scope: 'mine', page, limit: PAGE_SIZE }
    : { scope: 'mine', limit: FETCH_LIMIT };
  if (search) filters.search = search;
  if (status === 'overdue') filters.overdue = true;
  else if (status !== 'all') filters.status = status;
  if (sort === 'dueAt') filters.sort = 'dueAt';
  else {
    filters.sort = 'createdAt';
    filters.order = sort === 'newest' ? 'desc' : 'asc';
  }

  const { data, isLoading, isError, refetch } = useTasks(filters, { keepPrevious: true });
  const total = data?.pagination?.total ?? 0;

  const matches = useMemo(
    () =>
      serverPaged
        ? (data?.data ?? [])
        : (data?.data ?? []).filter((t: Task) => taskUrgency(t)?.toLowerCase() === urgency),
    [data, serverPaged, urgency],
  );

  const filtered = !!search || !!urgency;
  const listed = serverPaged ? total : matches.length;
  const pageCount = Math.max(1, Math.ceil(listed / PAGE_SIZE));
  const current = Math.min(page, pageCount);
  const rows = serverPaged
    ? matches
    : matches.slice((current - 1) * PAGE_SIZE, current * PAGE_SIZE);

  // Any filter change starts again from page 1.
  const reset =
    <T,>(set: (v: T) => void) =>
    (v: T) => {
      set(v);
      setPage(1);
    };
  const applySearch = useDebouncedCallback((value: string) => reset(setSearch)(value.trim()), 300);

  return (
    <div className="card">
      <div className="card-head">
        <span className="h3">
          <Icon name="inbox" size={16} /> My Tasks
        </span>
        <button className="btn btn-secondary btn-sm" onClick={() => router.push('/staff/tasks')}>
          View all
        </button>
      </div>

      <div
        className="flex items-center gap-2 flex-wrap"
        style={{ padding: '12px 20px', borderBottom: '1px solid var(--border)' }}
      >
        <input
          className="input"
          style={{ flex: '1 1 220px', height: '32px' }}
          type="search"
          placeholder="Search document or workflow…"
          aria-label="Search my tasks"
          value={searchInput}
          onChange={(e) => {
            setSearchInput(e.target.value);
            applySearch(e.target.value);
          }}
        />
        <select
          className="input"
          style={{ width: 'auto', height: '32px' }}
          aria-label="Filter by status"
          value={status}
          onChange={(e) => reset(setStatus)(e.target.value as StatusFilter)}
        >
          <option value="pending">Status: Open</option>
          <option value="escalated">Escalated</option>
          <option value="overdue">Overdue</option>
          <option value="completed">Completed</option>
          <option value="all">All</option>
        </select>
        <select
          className="input"
          style={{ width: 'auto', height: '32px' }}
          aria-label="Filter by urgency"
          value={urgency}
          onChange={(e) => reset(setUrgency)(e.target.value)}
        >
          <option value="">Any urgency</option>
          <option value="critical">Critical</option>
          <option value="high">High</option>
          <option value="normal">Normal</option>
          <option value="low">Low</option>
        </select>
        <select
          className="input"
          style={{ width: 'auto', height: '32px' }}
          aria-label="Sort"
          value={sort}
          onChange={(e) => reset(setSort)(e.target.value as SortFilter)}
        >
          <option value="dueAt">Sort: Due date</option>
          <option value="oldest">Oldest first</option>
          <option value="newest">Newest first</option>
        </select>
      </div>

      {isError ? (
        <div style={{ padding: '32px' }}>
          <ErrorMessage message="Failed to load tasks" retry={refetch} />
        </div>
      ) : isLoading ? (
        <SkeletonTaskRows rows={6} />
      ) : rows.length ? (
        <>
          <div className="rowlist">
            {rows.map((t) => (
              <TaskRow key={t.id} item={t} />
            ))}
          </div>
          <Pagination
            page={current}
            totalPages={pageCount}
            total={listed}
            limit={PAGE_SIZE}
            onPageChange={setPage}
          />
          {!serverPaged && total > FETCH_LIMIT && (
            <p className="caption" style={{ padding: '0 20px 12px' }}>
              Urgency is checked on the first {FETCH_LIMIT} of {total} tasks only. Open View all for
              the rest.
            </p>
          )}
        </>
      ) : filtered || status !== 'pending' ? (
        <EmptyState
          icon="search"
          title="No tasks match"
          message="Try another search or change the filters."
        />
      ) : (
        <EmptyState
          icon="approve"
          title="You're all caught up"
          message="No open tasks. Upload a document or search the archive to keep working."
          action={
            <div className="flex gap-2" style={{ justifyContent: 'center' }}>
              <button className="btn btn-primary btn-sm" onClick={() => router.push('/upload')}>
                Upload a document
              </button>
              <button className="btn btn-secondary btn-sm" onClick={() => router.push('/search')}>
                Search
              </button>
            </div>
          }
        />
      )}
    </div>
  );
}
