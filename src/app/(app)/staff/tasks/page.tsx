'use client';

import React, { useState, useEffect } from 'react';
import { useStore } from '@/store/useStore';
import { useUIStore } from '@/store/useUIStore';
import { useTasks } from '@/apis/hooks/useTasks';
import type { TaskFilters } from '@/apis/services/tasks.service';
import { Icon } from '@/components/ui/Icons';
import { TaskRow } from '@/components/ui/TaskRow';
import { Pagination } from '@/components/ui/Pagination';
import { SkeletonTaskRows } from '@/components/common/Skeleton';
import { ErrorMessage } from '@/components/common/ErrorMessage';

const PAGE_SIZE = 20;

/** Every filter, sort and page is `GET /tasks`'s own, so each page is what the server
 *  returns; anything the API can't do would only reorder one page, so isn't offered. */
export default function MyTasksPage() {
  const { currentUser } = useStore();
  const { setPageTitle } = useUIStore();

  // Open by default, or completed tasks fill the oldest-first pages. `status`
  // takes one value, so escalated tasks show only under All.
  const [view, setView] = useState<'open' | 'overdue' | 'all'>('open');
  const [sortBy, setSortBy] = useState<'createdAt' | 'dueAt'>('createdAt');
  const [page, setPage] = useState(1);

  useEffect(() => {
    setPageTitle('My Tasks');
  }, [setPageTitle]);

  const filters: TaskFilters = { scope: 'mine', page, limit: PAGE_SIZE, sort: sortBy };
  if (view === 'open') filters.status = 'pending';
  if (view === 'overdue') filters.overdue = true;

  const { data: tasksData, isLoading, isError, refetch } = useTasks(filters);
  const tasks = tasksData?.data || [];
  const pagination = tasksData?.pagination;

  if (!currentUser) return null;

  return (
    <div>
      <div className="page-head">
        <div>
          <div className="page-title">My Tasks</div>
          <div className="page-sub">Everything assigned to you, filterable and sortable.</div>
        </div>
        <div className="actions">
          <select
            className="input"
            style={{ width: 'auto', height: '32px' }}
            value={view}
            onChange={(e) => {
              setView(e.target.value as 'open' | 'overdue' | 'all');
              setPage(1);
            }}
            aria-label="Status"
          >
            <option value="open">Status: Open</option>
            <option value="overdue">Overdue</option>
            <option value="all">All</option>
          </select>
          <select
            className="input"
            style={{ width: 'auto', height: '32px' }}
            value={sortBy}
            onChange={(e) => {
              setSortBy(e.target.value as 'createdAt' | 'dueAt');
              setPage(1);
            }}
            aria-label="Sort"
          >
            <option value="createdAt">Sort: Oldest first</option>
            <option value="dueAt">Sort: Due date</option>
          </select>
        </div>
      </div>

      <div className="card">
        {isError ? (
          <div style={{ padding: '32px' }}>
            <ErrorMessage message="Failed to load tasks" retry={refetch} />
          </div>
        ) : isLoading ? (
          <SkeletonTaskRows rows={6} />
        ) : tasks.length > 0 ? (
          <>
            <div className="rowlist">
              {tasks.map((t) => (
                <TaskRow key={t.id} item={t} />
              ))}
            </div>
            {pagination && (
              <Pagination
                page={pagination.page}
                totalPages={pagination.totalPages}
                total={pagination.total}
                limit={pagination.limit}
                onPageChange={setPage}
              />
            )}
          </>
        ) : (
          <div className="empty">
            <Icon name="inbox" size={32} />
            <div className="h3 mt-4 mb-2">No tasks in this view</div>
            <p className="caption mb-4">Adjust the filters, or enjoy the quiet moment.</p>
          </div>
        )}
      </div>
    </div>
  );
}
