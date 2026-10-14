'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useStore } from '@/store/useStore';
import { useUIStore } from '@/store/useUIStore';
import { useTasks } from '@/apis/hooks/useTasks';
import type { TaskFilters } from '@/apis/services/tasks.service';
import { byUrgencyThenDue, taskStatusLabel } from '@/utils/supervisor';
import { taskDocuments } from '@/utils/workflowDocuments';
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

  // Overdue and due-date order are decided server-side (edms-backend PR #50),
  // so they cover every task, not just the page that was fetched.
  // Pending, In Progress and On Hold aren't task statuses: they come from the
  // workflow's state (`taskStatusLabel`), so fetch open tasks that aren't
  // overdue and split them below.
  const labelledByWorkflow = ['Pending', 'In Progress', 'On Hold'].includes(statusF);
  const backendFilters: TaskFilters = { scope: 'mine' };
  if (statusF === 'Overdue') {
    backendFilters.overdue = true;
  } else if (labelledByWorkflow) {
    backendFilters.status = 'pending';
    backendFilters.overdue = false;
  }
  if (sortBy === 'due') backendFilters.sort = 'dueAt';

  const {
    data: tasksData,
    isLoading,
    isError,
    refetch,
  } = useTasks(backendFilters);
  const tasks = tasksData?.data || [];

  if (!currentUser) return null;

  let list = [...tasks];
  if (labelledByWorkflow) {
    list = list.filter((t) => taskStatusLabel(t) === statusF);
  }

  // A task matches when any of its documents has that urgency.
  if (urgF !== 'All') {
    list = list.filter((t) => taskDocuments(t).some((d) => d.urgency === urgF.toLowerCase()));
  }

  // 'due' keeps the server's order. The backend can only sort oldest-first,
  // so 'created' (newest first) sorts the fetched page here.
  if (sortBy === 'urgency') {
    list.sort(byUrgencyThenDue);
  } else if (sortBy === 'created') {
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
