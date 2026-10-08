'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useStore } from '@/store/useStore';
import { useUIStore } from '@/store/useUIStore';
import { useTasks } from '@/apis/hooks/useTasks';
import { useSlaBreaches } from '@/apis/hooks/useSla';
import { byUrgencyThenDue, taskStatusLabel } from '@/utils/supervisor';
import { taskDocuments, taskDueAt } from '@/utils/workflowDocuments';
import { Icon } from '@/components/ui/Icons';
import { TaskRow } from '@/components/ui/TaskRow';
import { SkeletonTaskRows } from '@/components/common/Skeleton';
import { ErrorMessage } from '@/components/common/ErrorMessage';

export default function MyTasksPage() {
  const router = useRouter();
  const { currentUser } = useStore();
  const { setPageTitle } = useUIStore();

  const [statusF, setStatusF] = useState('All');
  const [urgF, setUrgF] = useState('All');
  const [sortBy, setSortBy] = useState('urgency');

  useEffect(() => {
    setPageTitle('My Tasks');
  }, [setPageTitle]);

  // Build backend filters
  const backendFilters: Record<string, any> = { scope: 'mine' };
  if (statusF !== 'All') {
    // Map frontend 'Pending' etc to backend task statuses
    if (statusF === 'Pending' || statusF === 'Overdue') {
      backendFilters.status = 'pending';
    } else if (statusF === 'In Progress') {
      backendFilters.status = 'in_progress';
    } else if (statusF === 'Closed') {
      backendFilters.status = 'completed';
    } else if (statusF === 'On Hold') {
      backendFilters.status = 'on_hold';
    }
  }

  const {
    data: tasksData,
    isLoading,
    isError,
    refetch,
  } = useTasks(backendFilters);
  const tasks = tasksData?.data || [];
  // `GET /tasks` carries no deadlines (edms-backend `919d0ef`), so Overdue also
  // counts tasks with an open SLA breach — the same source as the dashboard tile.
  const { data: slaBreaches } = useSlaBreaches({ scope: 'mine', status: 'open', limit: 100 });
  const breachedTaskIds = new Set((slaBreaches?.data ?? []).map((b) => b.taskId));

  if (!currentUser) return null;

  let list = tasks;
  // Backend 'pending' covers both — refine the Pending/Overdue split client-side.
  if (statusF !== 'All') {
    list = list.filter((t) => {
      const overdue = breachedTaskIds.has(t.id) || taskStatusLabel(t) === 'Overdue';
      if (statusF === 'Overdue') return overdue;
      if (statusF === 'Pending') return !overdue && taskStatusLabel(t) === 'Pending';
      return true; // Already filtered by backend for other exact matches
    });
  }

  // A task matches when any of its documents has that urgency.
  if (urgF !== 'All') {
    list = list.filter((t) => taskDocuments(t).some((d) => d.urgency === urgF.toLowerCase()));
  }

  const dueMs = (t: (typeof list)[number]) => {
    const due = taskDueAt(t);
    return due ? Date.parse(due) : Number.MAX_SAFE_INTEGER;
  };
  if (sortBy === 'urgency') {
    list.sort(byUrgencyThenDue);
  } else if (sortBy === 'due') {
    // Tasks whose deadline isn't returned sort last.
    list.sort((a, b) => dueMs(a) - dueMs(b));
  } else {
    list.sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt));
  }

  const URG_LEVELS = ['Critical', 'High', 'Normal', 'Low'];

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
            value={statusF}
            onChange={(e) => setStatusF(e.target.value)}
            aria-label="Status"
          >
            {['All', 'Pending', 'In Progress', 'Overdue', 'On Hold'].map((o) => (
              <option key={o} value={o}>
                {o === 'All' ? 'Status: All' : o}
              </option>
            ))}
          </select>
          <select
            className="input"
            style={{ width: 'auto', height: '32px' }}
            value={urgF}
            onChange={(e) => setUrgF(e.target.value)}
            aria-label="Urgency"
          >
            {['All', ...URG_LEVELS].map((o) => (
              <option key={o} value={o}>
                {o === 'All' ? 'Urgency: All' : o}
              </option>
            ))}
          </select>
          <select
            className="input"
            style={{ width: 'auto', height: '32px' }}
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value)}
            aria-label="Sort"
          >
            <option value="urgency">Sort: Urgency then due</option>
            <option value="due">Sort: Due date</option>
            <option value="created">Sort: Newest</option>
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
        ) : list.length > 0 ? (
          <div className="rowlist">
            {list.map((t: any) => (
              <TaskRow key={t.id} item={t} />
            ))}
          </div>
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
