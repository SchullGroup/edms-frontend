'use client';

import React, { useEffect } from 'react';
import Link from 'next/link';
import { useStore } from '@/store/useStore';
import { useUIStore } from '@/store/useUIStore';
import { useDepartmentNames } from '@/apis/hooks/useDepartments';
import { useApprovalTasks, useTasks } from '@/apis/hooks/useTasks';
import { useAccessRequestsInbox } from '@/apis/hooks/useDocuments';
import { useBottlenecksAgeing } from '@/apis/hooks/useWorkflowInstances';
import { lastDaysRange, priorDaysRange, useSlaOutcomeSummary } from '@/apis/hooks/useSla';
import { usePermissions } from '@/hooks/usePermissions';
import { evaluateRouteAccess } from '@/lib/routeAccess';
import { SkeletonKpis, SkeletonTaskRows } from '@/components/common/Skeleton';
import { ErrorMessage } from '@/components/common/ErrorMessage';
import { EmptyState } from '@/components/ui/EmptyState';
import { Icon } from '@/components/ui/Icons';
import type { WorkflowBottleneckItem } from '@/types/models';

const PERIOD_DAYS = 30;
const OLDEST_COUNT = 5;

const AGE_BADGE: Record<string, string> = {
  breached: 'b-status-overdue',
  due_soon: 'b-status-pending',
};

/** Who holds an item: a person, a role pool ("Supervisor queue") or nobody. */
function holderLabel(item: WorkflowBottleneckItem): string {
  if (item.assignmentType !== 'role') return item.assigneeName || 'Unassigned';
  // Role names arrive as keys ("client_admin"); show them as words.
  const role = (item.assignedRoleName ?? item.assigneeName).replace(/_/g, ' ');
  return `${role.charAt(0).toUpperCase()}${role.slice(1)} queue`;
}

/**
 * Team Overview: what's waiting on the supervisor, and where the team is slipping.
 * Team figures all come from bottlenecks-ageing (workflow items), so they agree with that page.
 */
export default function SupervisorDashboard() {
  const { setPageTitle } = useUIStore();
  const currentUser = useStore((s) => s.currentUser);
  const departmentName = useDepartmentNames();
  const { can, granted } = usePermissions();

  useEffect(() => {
    setPageTitle('Team Overview');
  }, [setPageTitle]);

  // Each "Waiting on you" row shows only if its list would open, so no count 403s.
  const canOpen = (path: string) =>
    evaluateRouteAccess(path, {
      roles: currentUser?.roles ?? [],
      permissions: granted,
      scopedPermissions: (currentUser?.permissions ?? []).filter(
        (p): p is string => typeof p === 'string',
      ),
    }).allowed;
  const showApprovals = canOpen('/supervisor/approvals');
  const showOverdue = can('task', 'view') && canOpen('/staff/workflows');
  const showAccess = canOpen('/admin/access-requests');
  const showTeam = can('workflow_instance', 'view');
  const showOnTime = can('task', 'view');

  const approvalsQuery = useApprovalTasks(
    { scope: 'all', status: 'pending', limit: 1 },
    { enabled: showApprovals },
  );
  // Same query as the staff Overdue tile, so the count matches the list it opens.
  const overdueQuery = useTasks(
    { scope: 'mine', overdue: true, limit: 1 },
    { enabled: showOverdue },
  );
  const accessQuery = useAccessRequestsInbox(
    { status: 'pending', limit: 1 },
    { enabled: showAccess },
  );

  const ageingQuery = useBottlenecksAgeing({ page: 1, limit: OLDEST_COUNT }, { enabled: showTeam });
  const onTimeQuery = useSlaOutcomeSummary(lastDaysRange(PERIOD_DAYS), { enabled: showOnTime });
  const onTimeBeforeQuery = useSlaOutcomeSummary(priorDaysRange(PERIOD_DAYS), {
    enabled: showOnTime,
  });

  const summary = ageingQuery.data?.summary;
  const oldest = ageingQuery.data?.items ?? [];

  const outcomes = onTimeQuery.data;
  const before = onTimeBeforeQuery.data;
  const onTime = outcomes && outcomes.total > 0 ? Math.round(outcomes.onTimeRate * 100) : null;
  const onTimeBefore = before && before.total > 0 ? Math.round(before.onTimeRate * 100) : null;

  let trend = { text: '', dir: '' };
  if (onTime === null) trend.text = `No completed stages in the last ${PERIOD_DAYS} days`;
  else if (onTimeBefore === null) trend.text = `No results the ${PERIOD_DAYS} days before`;
  else if (onTime === onTimeBefore) trend.text = `Same as the ${PERIOD_DAYS} days before`;
  else
    trend = {
      text: `${onTime > onTimeBefore ? '▲' : '▼'} from ${onTimeBefore}%`,
      dir: onTime > onTimeBefore ? 'up' : 'down',
    };

  const waiting = [
    showApprovals && {
      key: 'approvals',
      label: 'Approvals',
      href: '/supervisor/approvals',
      query: approvalsQuery,
      count: approvalsQuery.data?.pagination?.total ?? 0,
      urgent: false,
    },
    showOverdue && {
      key: 'overdue',
      label: 'Overdue tasks',
      href: '/staff/workflows?status=overdue',
      query: overdueQuery,
      count: overdueQuery.data?.pagination?.total ?? 0,
      urgent: true,
    },
    showAccess && {
      key: 'access',
      label: 'Access requests',
      href: '/admin/access-requests',
      query: accessQuery,
      count: accessQuery.data?.pagination?.total ?? 0,
      urgent: false,
    },
  ].filter((w): w is Exclude<typeof w, false> => !!w);

  const kpiCount = (showTeam ? 2 : 0) + (showOnTime ? 1 : 0);
  const healthLoading =
    (showTeam && ageingQuery.isLoading) || (showOnTime && onTimeQuery.isLoading);
  const department = currentUser?.departmentId
    ? departmentName(currentUser.departmentId)
    : undefined;

  return (
    <div>
      <div className="page-head">
        <div>
          <div className="page-title">Team Overview</div>
          <div className="page-sub">
            {department ? `${department} · ` : ''}What needs you, and where your team is slipping.
          </div>
        </div>
      </div>

      {kpiCount > 0 &&
        (healthLoading ? (
          <SkeletonKpis count={kpiCount} />
        ) : (
          <div className={`grid cols-${kpiCount} mb-4`}>
            {showTeam && (
              <div className="card kpi">
                <div className="kl">Past SLA</div>
                {ageingQuery.isError ? (
                  <div className="kv">—</div>
                ) : (
                  <div
                    className="kv"
                    style={summary?.breachedItems ? { color: 'var(--status-overdue)' } : undefined}
                  >
                    {summary?.breachedItems ?? 0}{' '}
                    <span className="kv-of">of {summary?.totalOpenItems ?? 0} open</span>
                  </div>
                )}
              </div>
            )}
            {showOnTime && (
              <div className="card kpi">
                <div className="kl">On time, last {PERIOD_DAYS} days</div>
                <div
                  className="kv"
                  title={
                    outcomes ? `${outcomes.onTime} of ${outcomes.total} stages on time` : undefined
                  }
                >
                  {onTime === null ? '—' : `${onTime}%`}
                </div>
                <div className={`kd ${trend.dir}`}>
                  {onTimeQuery.isError ? 'Failed to load' : trend.text}
                </div>
              </div>
            )}
            {showTeam && (
              <div className="card kpi">
                <div className="kl">Oldest item</div>
                <div className="kv">
                  {oldest[0]
                    ? `${oldest[0].ageDays} day${oldest[0].ageDays === 1 ? '' : 's'}`
                    : '—'}
                </div>
                {!ageingQuery.isError && !oldest[0] && <div className="kd">Nothing open</div>}
              </div>
            )}
          </div>
        ))}

      <div className={waiting.length && showTeam ? 'overview-body' : 'grid'}>
        {waiting.length > 0 && (
          <div className="card">
            <div className="card-head">
              <span className="h3">Waiting on you</span>
            </div>
            <div className="rowlist">
              {waiting.map((w) => (
                <Link
                  key={w.key}
                  href={w.href}
                  className={`wait-row${w.urgent && w.count > 0 ? ' urgent' : ''}`}
                  aria-label={`${w.query.isLoading ? '' : `${w.count} `}${w.label}`}
                >
                  <span className="wait-stack">
                    <span className="wn">
                      {w.query.isLoading ? '…' : w.query.isError ? '—' : w.count}
                    </span>
                    <span className="wl">{w.label}</span>
                  </span>
                  <Icon name="chevR" size={16} />
                </Link>
              ))}
            </div>
          </div>
        )}

        {showTeam && (
          <div className="card">
            <div className="card-head">
              <span className="h3">Oldest open items</span>
              <Link href="/supervisor/bottlenecks" className="btn btn-secondary btn-sm">
                See all
              </Link>
            </div>
            {ageingQuery.isLoading ? (
              <SkeletonTaskRows rows={OLDEST_COUNT} />
            ) : ageingQuery.isError ? (
              <div style={{ padding: '32px' }}>
                <ErrorMessage
                  message="Failed to load open items"
                  retry={() => ageingQuery.refetch()}
                />
              </div>
            ) : oldest.length ? (
              <div className="rowlist">
                {oldest.map((item) => (
                  <Link
                    key={`${item.workflowInstanceId}:${item.documentId}`}
                    href={`/workflow-instances/${item.workflowInstanceId}`}
                    className="task-row"
                  >
                    <div className="task-main">
                      <div className="task-title">{item.documentTitle}</div>
                      <div className="task-meta">
                        {item.currentStageName} · {holderLabel(item)}
                      </div>
                    </div>
                    <span
                      className={`badge ${AGE_BADGE[item.slaStatus] ?? 'b-status-not-started'}`}
                      title={`${item.ageDays} days old`}
                    >
                      {item.ageDays} d
                    </span>
                  </Link>
                ))}
              </div>
            ) : (
              <EmptyState
                icon="approve"
                title="Nothing open"
                message="Your team has no workflow items in progress."
              />
            )}
          </div>
        )}
      </div>
    </div>
  );
}
