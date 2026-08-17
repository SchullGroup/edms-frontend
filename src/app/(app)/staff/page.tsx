'use client';

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useStore } from '@/store/useStore';
import { useUIStore } from '@/store/useUIStore';
import { useTasks } from '@/apis/hooks/useTasks';
import { useNotifications, useMarkNotificationRead } from '@/apis/hooks/useNotifications';
import { Icon } from '@/components/ui/Icons';
import { EmptyState } from '@/components/ui/EmptyState';
import { TaskRow } from '@/components/ui/TaskRow';
import { Spinner } from '@/components/common/Spinner';
import { ErrorMessage } from '@/components/common/ErrorMessage';
import { effStatus, timeAgo, fmtDate } from '@/utils/helpers';

const URG_ORDER: Record<string, number> = { Critical: 0, High: 1, Normal: 2, Low: 3 };

// Simple pure SVG donut
const Donut = ({ value, color, label }: { value: number; color: string; label: string }) => {
  const dash = `${value} 100`;
  return (
    <div style={{ textAlign: 'center' }}>
      <svg
        viewBox="0 0 36 36"
        style={{ width: '80px', height: '80px', display: 'block', margin: '0 auto' }}
      >
        <path
          d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
          fill="none"
          stroke="var(--bg-card)"
          strokeWidth="3"
        />
        <path
          d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
          fill="none"
          stroke={color}
          strokeWidth="3"
          strokeDasharray={dash}
        />
        <text
          x="18"
          y="20.35"
          style={{ fontSize: '9px', fontWeight: 700, fill: 'var(--ink)', textAnchor: 'middle' }}
        >
          {value}%
        </text>
      </svg>
      <div style={{ fontSize: '12px', fontWeight: 600, marginTop: '8px' }}>{label}</div>
    </div>
  );
};

export default function StaffDashboard() {
  const router = useRouter();
  const { currentUser } = useStore();
  const { setPageTitle } = useUIStore();
  const [filter, setFilter] = useState<string | null>(null);

  useEffect(() => {
    setPageTitle('Dashboard');
  }, [setPageTitle]);

  const {
    data: tasksData,
    isLoading: isTasksLoading,
    isError: isTasksError,
    refetch: refetchTasks,
  } = useTasks();
  const { data: notifData, isLoading: isNotifLoading } = useNotifications();
  const markRead = useMarkNotificationRead();

  if (!currentUser) return null;

  const tasks = tasksData?.data || [];
  const notifications = notifData?.data || [];

  const mine = tasks;
  const open = mine.filter((t) => t.status !== 'completed');
  const counts: Record<string, number> = {
    Pending: open.filter((t) => t.status === 'pending').length,
    'In Progress': open.filter((t) => t.status === 'pending').length, // Same as pending for now
    Closed: mine.filter((t) => t.status === 'completed').length,
    Overdue: open.filter((t) => t.dueAt && new Date(t.dueAt) < new Date()).length,
  };

  let list = open.filter((t) => {
    if (!filter) return true;
    if (filter === 'Overdue') return t.dueAt && new Date(t.dueAt) < new Date();
    if (filter === 'Closed') return t.status === 'completed';
    return t.status === 'pending';
  });

  list.sort(
    (a, b) =>
      (URG_ORDER[a.workflowInstance?.document?.urgency ? a.workflowInstance.document.urgency.charAt(0).toUpperCase() + a.workflowInstance.document.urgency.slice(1) : 'Normal'] || 3) -
      (URG_ORDER[b.workflowInstance?.document?.urgency ? b.workflowInstance.document.urgency.charAt(0).toUpperCase() + b.workflowInstance.document.urgency.slice(1) : 'Normal'] || 3) ||
      (a.dueAt ? new Date(a.dueAt).getTime() : 9e15) - (b.dueAt ? new Date(b.dueAt).getTime() : 9e15),
  );

  const tileDefs = [
    { key: 'Pending', cls: 't-pending', icon: 'clock' },
    { key: 'In Progress', cls: 't-progress', icon: 'pulse' },
    { key: 'Closed', cls: 't-closed', icon: 'check', label: 'Closed (30d)' },
    { key: 'Overdue', cls: 't-overdue', icon: 'alert', label: 'Overdue / SLA' },
  ];

  const myNotifs = notifications.filter((n) => n.user === currentUser.id).slice(0, 5);
  const closedMine = mine.filter((t) => t.status === 'completed').length;
  const slaPct = 86;

  const hour = new Date().getHours();
  const greet = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening';

  return (
    <div>
      <div className="page-head">
        <div>
          <div className="page-title">{`${greet}, ${currentUser.name.split(' ')[0]}`}</div>
          <div className="page-sub">{`You have ${open.length} open item${open.length === 1 ? '' : 's'}${counts.Overdue ? `, ${counts.Overdue} overdue` : ''} · ${fmtDate(Date.now())}`}</div>
        </div>
        <div className="actions">
          <button className="btn btn-secondary" onClick={() => router.push('/search')}>
            <Icon name="search" size={15} /> Search
          </button>
          <button className="btn btn-accent" onClick={() => router.push('/upload')}>
            <Icon name="upload" size={15} /> Upload document
          </button>
        </div>
      </div>

      <div className="grid cols-4" style={{ marginBottom: '16px' }}>
        {tileDefs.map((t) => (
          <div
            key={t.key}
            className={`tile ${t.cls} ${filter === t.key ? 'selected' : ''}`}
            tabIndex={0}
            role="button"
            aria-label={`${t.label || t.key}: ${counts[t.key]}`}
            onClick={() => setFilter(filter === t.key ? null : t.key)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') setFilter(filter === t.key ? null : t.key);
            }}
          >
            <div className="cnt">{counts[t.key]}</div>
            <div className="lbl">
              <Icon name={t.icon} size={13} /> {t.label || t.key}
            </div>
          </div>
        ))}
      </div>

      <div className="dash-body">
        <div className="card">
          <div className="card-head">
            <span className="h3">
              <Icon name="inbox" size={16} /> My Tasks{filter ? ` — ${filter}` : ''}
            </span>
            <div className="flex g8">
              {filter && (
                <button className="btn btn-ghost btn-sm" onClick={() => setFilter(null)}>
                  Clear filter
                </button>
              )}
              <button className="btn btn-secondary btn-sm" onClick={() => router.push('/search')}>
                View all
              </button>
            </div>
          </div>
          {isTasksError ? (
            <div style={{ padding: '32px' }}>
              <ErrorMessage message="Failed to load tasks" retry={refetchTasks} />
            </div>
          ) : isTasksLoading ? (
            <div style={{ padding: '32px' }}>
              <Spinner text="Loading tasks..." />
            </div>
          ) : list.length ? (
            <div className="rowlist">
              {list.slice(0, 8).map((t) => (
                <TaskRow key={t.id} item={t} />
              ))}
            </div>
          ) : (
            <EmptyState
              icon="approve"
              title="You're all caught up"
              message="No tasks match. Upload a document or search the archive to keep working."
              action={
                <div className="flex g8" style={{ justifyContent: 'center' }}>
                  <button className="btn btn-primary btn-sm" onClick={() => router.push('/upload')}>
                    Upload a document
                  </button>
                  <button
                    className="btn btn-secondary btn-sm"
                    onClick={() => router.push('/search')}
                  >
                    Search
                  </button>
                </div>
              }
            />
          )}
        </div>

        <div className="grid" style={{ gap: '16px' }}>
          <div className="card">
            <div className="card-head">
              <span className="h3">
                <Icon name="bell" size={16} /> Notifications
              </span>
              <button
                className="btn btn-ghost btn-sm"
                onClick={() => router.push('/notifications')}
              >
                View all
              </button>
            </div>
            {myNotifs.length ? (
              myNotifs.map((n) => (
                <div
                  key={n.id}
                  className={`notif-item ${n.read ? 'read' : ''}`}
                  onClick={() => {
                    markRead.mutate(n.id);
                    if (n.docId) router.push(`/doc/${n.docId}`);
                    else router.push('/notifications');
                  }}
                >
                  <span className="dot"></span>
                  <div>
                    <div className="msg">{n.text}</div>
                    <div className="caption" style={{ marginTop: '3px' }}>
                      {timeAgo(n.at)}
                    </div>
                  </div>
                </div>
              ))
            ) : (
              <EmptyState
                icon="bell"
                title="No notifications"
                message="You'll see workflow updates and mentions here."
              />
            )}
          </div>

          <div className="card">
            <div className="card-head">
              <span className="h3">
                <Icon name="gauge" size={16} /> My Performance
              </span>
              <button
                className="btn btn-ghost btn-sm"
                onClick={() => router.push('/staff/performance')}
              >
                Details
              </button>
            </div>
            <div className="card-body">
              <div className="ring-wrap">
                <Donut value={slaPct} label="SLA compliance" color="var(--status-closed)" />
                <div style={{ flex: 1 }}>
                  <div className="metric-li">
                    <span>Avg turnaround</span>
                    <b>1.8 days</b>
                  </div>
                  <div className="metric-li">
                    <span>Volume (30d)</span>
                    <b>{closedMine + 9}</b>
                  </div>
                  <div className="metric-li">
                    <span>Rework rate</span>
                    <b>4.2%</b>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
