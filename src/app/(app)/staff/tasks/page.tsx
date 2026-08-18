'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useStore, effStatus } from '@/store/useStore';
import { useUIStore } from '@/store/useUIStore';
import { useTasks } from '@/apis/hooks/useTasks';
import { Icon } from '@/components/ui/Icons';
import { TaskRow } from '@/components/ui/TaskRow';
import { Spinner } from '@/components/common/Spinner';
import { ErrorMessage } from '@/components/common/ErrorMessage';

const URG_ORDER: Record<string, number> = { Critical: 1, High: 2, Normal: 3, Low: 4 };

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

  if (!currentUser) return null;

  let list = tasks;
  // Fallback frontend filtering for status just to be safe with Overdue since backend 'pending' includes overdue
  if (statusF !== 'All') {
    list = list.filter((t: any) => {
      const isCompleted = t.status === 'completed';
      const eff = isCompleted ? 'Closed' : effStatus(t);
      // Backend handles exact status mapping, but for 'Pending'/'Overdue' split we need to refine:
      if (statusF === 'Overdue') return eff === 'Overdue';
      if (statusF === 'Pending') return eff === 'Pending';
      return true; // Already filtered by backend for other exact matches
    });
  }
  
  if (urgF !== 'All') {
    list = list.filter((t) => t.workflowInstance?.document?.urgency === urgF.toLowerCase());
  }

  if (sortBy === 'urgency') {
    list.sort(
      (a, b) =>
        (URG_ORDER[a.workflowInstance?.document?.urgency ? a.workflowInstance.document.urgency.charAt(0).toUpperCase() + a.workflowInstance.document.urgency.slice(1) : 'Normal'] || 3) - 
        (URG_ORDER[b.workflowInstance?.document?.urgency ? b.workflowInstance.document.urgency.charAt(0).toUpperCase() + b.workflowInstance.document.urgency.slice(1) : 'Normal'] || 3) ||
        (a.dueAt ? Date.parse(a.dueAt) : 9e15) - (b.dueAt ? Date.parse(b.dueAt) : 9e15),
    );
  } else if (sortBy === 'due') {
    list.sort(
      (a, b) =>
        (a.dueAt ? Date.parse(a.dueAt) : 9e15) - (b.dueAt ? Date.parse(b.dueAt) : 9e15),
    );
  } else {
    // There is no createdAt on Task, so we fallback to dueAt for now or document createdAt.
    list.sort((a, b) => (b.dueAt ? Date.parse(b.dueAt) : 0) - (a.dueAt ? Date.parse(a.dueAt) : 0));
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
          <div style={{ padding: '32px' }}>
            <Spinner text="Loading tasks..." />
          </div>
        ) : list.length > 0 ? (
          <div className="rowlist">
            {list.map((t: any) => (
              <TaskRow key={t.id} item={t} />
            ))}
          </div>
        ) : (
          <div className="empty">
            <Icon name="inbox" size={32} />
            <div className="h3 mt16 mb8">No tasks in this view</div>
            <p className="caption mb16">Adjust the filters, or enjoy the quiet moment.</p>
          </div>
        )}
      </div>
    </div>
  );
}
