'use client';

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useStore } from '@/store/useStore';
import { useUIStore } from '@/store/useUIStore';
import { useTasks } from '@/apis/hooks/useTasks';
import {
  useWorkflowInstanceStatusCounts,
  useWorkflowInstances,
} from '@/apis/hooks/useWorkflowInstances';
import { useSlaBreaches } from '@/apis/hooks/useSla';
import { useNotifications, useMarkNotificationRead } from '@/apis/hooks/useNotifications';
import {
  isUnread,
  notificationHref,
  notificationMessage,
} from '@/apis/services/notifications.service';
import { Icon } from '@/components/ui/Icons';
import { EmptyState } from '@/components/ui/EmptyState';
import { TaskRow } from '@/components/ui/TaskRow';
import { QuickAccessCard } from '@/components/dashboard/QuickAccessCard';
import { StatusBadge } from '@/components/ui/Badges';
import { instanceTitle } from '@/utils/workflowDocuments';
import type { WorkflowInstance } from '@/types/models';
import { SkeletonNotifRows, SkeletonTaskRows } from '@/components/common/Skeleton';
import { ErrorMessage } from '@/components/common/ErrorMessage';
import { timeAgo, fmtDate } from '@/utils/helpers';
import {
  byUrgencyThenDue,
  changesRequestedRate,
  isOverdue,
  turnaroundDays,
} from '@/utils/supervisor';

// Simple pure SVG donut. A null value draws an empty ring with a dash: no data,
// not a score of zero.
const Donut = ({ value, color, label }: { value: number | null; color: string; label: string }) => {
  const dash = `${value ?? 0} 100`;
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
          {value === null ? '—' : `${value}%`}
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
  const { data: notifData, isLoading: isNotifLoading } = useNotifications({
    limit: 5,
    channel: 'in_app',
  });
  const markRead = useMarkNotificationRead();
  // Status tiles are file/workflow-instance counts (per the Workflow Module API
  // guide, §5.2) — a different lens from the task list below. `inProgress`
  // already includes on_hold; don't add it again.
  const { data: statusCounts } = useWorkflowInstanceStatusCounts('mine');
  // Persisted SLA breach events, not ad-hoc deadline math. They also drive the
  // Overdue filter: `GET /tasks` carries no deadlines (edms-backend `919d0ef`),
  // but each open breach names its task.
  const { data: slaBreaches } = useSlaBreaches({ scope: 'mine', status: 'open', limit: 100 });
  const breachedTaskIds = new Set((slaBreaches?.data ?? []).map((b) => b.taskId));
  // The Pending / In Progress / Closed tiles count workflows, so clicking one lists
  // those workflows (same `mine` scope as the counts). In Progress includes on hold.
  const instanceStatus =
    filter === 'Pending'
      ? 'pending'
      : filter === 'In Progress'
        ? 'in_progress'
        : filter === 'Closed'
          ? 'closed'
          : null;
  const instancesQuery = useWorkflowInstances(
    { status: instanceStatus, limit: 8 },
    { enabled: !!instanceStatus },
  );
  const onHoldQuery = useWorkflowInstances(
    { status: 'on_hold', limit: 8 },
    { enabled: filter === 'In Progress' },
  );

  if (!currentUser) return null;

  const tasks = tasksData?.data || [];
  const notifications = notifData?.data || [];

  const mine = tasks;
  const open = mine.filter((t) => t.status !== 'completed');
  const counts: Record<string, number> = {
    Pending: statusCounts?.pending ?? 0,
    'In Progress': statusCounts?.inProgress ?? 0,
    Closed: statusCounts?.closed ?? 0,
    Overdue: slaBreaches?.pagination.total ?? 0,
  };

  let list = open.filter((t) => {
    if (filter !== 'Overdue') return true;
    return breachedTaskIds.has(t.id) || isOverdue(t);
  });
  const instances: WorkflowInstance[] = [
    ...(instancesQuery.data?.data ?? []),
    ...(filter === 'In Progress' ? (onHoldQuery.data?.data ?? []) : []),
  ];
  const instancesLoading =
    instancesQuery.isLoading || (filter === 'In Progress' && onHoldQuery.isLoading);

  list.sort(byUrgencyThenDue);

  const tileDefs = [
    { key: 'Pending', cls: 't-pending', icon: 'clock' },
    { key: 'In Progress', cls: 't-progress', icon: 'pulse' },
    { key: 'Closed', cls: 't-closed', icon: 'check' },
    { key: 'Overdue', cls: 't-overdue', icon: 'alert', label: 'Overdue / SLA' },
  ];

  // `/notifications` is already scoped to the authenticated user server-side.
  const myNotifs = notifications;

  // Same calc as staff/performance. SLA compliance has no source since tasks
  // lost their due date (edms-backend `919d0ef`) — on-time results are recorded
  // server-side, and an endpoint over them is requested — so it shows "—".
  const closedTasks = mine.filter((t) => t.status === 'completed');
  const turnarounds = closedTasks.map(turnaroundDays).filter((d): d is number => d !== null);
  const avgTurnaround = turnarounds.length
    ? (turnarounds.reduce((sum, d) => sum + d, 0) / turnarounds.length).toFixed(1) + ' days'
    : '—';

  const THIRTY_DAYS_MS = 30 * 86400000;
  const volume30d = closedTasks.filter(
    (t: any) => t.completedAt && Date.now() - new Date(t.completedAt).getTime() <= THIRTY_DAYS_MS,
  ).length;

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

      <div className="grid gap-4">
        <QuickAccessCard />

        <div className="grid grid-cols-2 gap-4">
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
            {isNotifLoading ? (
              <SkeletonNotifRows rows={4} />
            ) : myNotifs.length ? (
              myNotifs.map((n) => (
                <div
                  key={n.id}
                  className={`notif-item ${isUnread(n) ? '' : 'read'}`}
                  onClick={() => {
                    if (isUnread(n)) markRead.mutate(n.id);
                    router.push(notificationHref(n) || '/notifications');
                  }}
                >
                  <span className="dot"></span>
                  <div>
                    <div className="msg">{notificationMessage(n)}</div>
                    <div className="caption" style={{ marginTop: '3px' }}>
                      {timeAgo(Date.parse(n.createdAt))}
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
                <Donut value={null} label="SLA compliance" color="var(--status-closed)" />
                <div style={{ flex: 1 }}>
                  <div className="metric-li">
                    <span>Avg turnaround</span>
                    <b>{avgTurnaround}</b>
                  </div>
                  <div className="metric-li">
                    <span>Volume (30d)</span>
                    <b>{volume30d}</b>
                  </div>
                  <div className="metric-li">
                    <span>Changes requested</span>
                    <b>{changesRequestedRate(closedTasks)}</b>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="card">
          <div className="card-head">
            <span className="h3">
              <Icon name="inbox" size={16} />{' '}
              {instanceStatus
                ? `My workflows — ${filter}`
                : `My Tasks${filter ? ` — ${filter}` : ''}`}
            </span>
            <div className="flex gap-2">
              {filter && (
                <button className="btn btn-ghost btn-sm" onClick={() => setFilter(null)}>
                  Clear filter
                </button>
              )}
              <button
                className="btn btn-secondary btn-sm"
                onClick={() => router.push('/staff/tasks')}
              >
                View all
              </button>
            </div>
          </div>
          {instanceStatus ? (
            instancesQuery.isError ? (
              <div style={{ padding: '32px' }}>
                <ErrorMessage message="Failed to load workflows" retry={instancesQuery.refetch} />
              </div>
            ) : instancesLoading ? (
              <SkeletonTaskRows rows={4} />
            ) : instances.length ? (
              <div className="rowlist">
                {instances.slice(0, 8).map((wi) => (
                  <InstanceRow
                    key={wi.id}
                    instance={wi}
                    onOpen={() => router.push(`/workflow-instances/${wi.id}`)}
                  />
                ))}
              </div>
            ) : (
              <EmptyState
                icon="approve"
                title={`No ${filter?.toLowerCase()} workflows`}
                message="Workflows you're part of show here."
              />
            )
          ) : isTasksError ? (
            <div style={{ padding: '32px' }}>
              <ErrorMessage message="Failed to load tasks" retry={refetchTasks} />
            </div>
          ) : isTasksLoading ? (
            <SkeletonTaskRows rows={6} />
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
                <div className="flex gap-2" style={{ justifyContent: 'center' }}>
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
      </div>
    </div>
  );
}

/** One workflow in the tile drill-down; opens its workflow page. */
function InstanceRow({ instance, onOpen }: { instance: WorkflowInstance; onOpen: () => void }) {
  const docCount = instance.documents?.length ?? 0;
  return (
    <div
      className="task-row"
      tabIndex={0}
      role="button"
      onClick={onOpen}
      onKeyDown={(e) => {
        if (e.key === 'Enter') onOpen();
      }}
    >
      <div className="task-main">
        <div className="task-title">{instanceTitle(instance)}</div>
        <div className="task-meta">
          <StatusBadge status={instance.status} />
          {instance.workflowDefinition?.name && <span>{instance.workflowDefinition.name}</span>}
          {docCount > 1 && <span>· {docCount} documents</span>}
          <span>
            ·{' '}
            {instance.closedAt
              ? `Closed ${fmtDate(instance.closedAt)}`
              : `Started ${fmtDate(instance.startedAt)}`}
          </span>
        </div>
      </div>
      <div className="task-actions">
        <button
          className="btn btn-primary btn-sm"
          onClick={(e) => {
            e.stopPropagation();
            onOpen();
          }}
        >
          Open
        </button>
      </div>
    </div>
  );
}
