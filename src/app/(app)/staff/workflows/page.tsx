'use client';

import React, { Suspense, useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useUIStore } from '@/store/useUIStore';
import { useTasks } from '@/apis/hooks/useTasks';
import {
  useWorkflowInstanceStatusCounts,
  useWorkflowInstances,
} from '@/apis/hooks/useWorkflowInstances';
import { Icon } from '@/components/ui/Icons';
import { EmptyState } from '@/components/ui/EmptyState';
import { TaskRow } from '@/components/ui/TaskRow';
import { Pagination } from '@/components/ui/Pagination';
import { StatusBadge } from '@/components/ui/Badges';
import { SkeletonTaskRows } from '@/components/common/Skeleton';
import { ErrorMessage } from '@/components/common/ErrorMessage';
import { instanceTitle } from '@/utils/workflowDocuments';
import { fmtDate } from '@/utils/helpers';
import type { WorkflowInstance } from '@/types/models';

const PAGE_SIZE = 20;

/** `?status=` values; `on_hold` is a sub-view of the In progress tab. */
type MyWorkflowsStatus = 'pending' | 'in_progress' | 'on_hold' | 'closed' | 'overdue';
const STATUSES: MyWorkflowsStatus[] = ['pending', 'in_progress', 'on_hold', 'closed', 'overdue'];

export default function MyWorkflowsPage() {
  // useSearchParams needs a Suspense boundary above it.
  return (
    <Suspense fallback={<SkeletonTaskRows rows={8} />}>
      <MyWorkflows />
    </Suspense>
  );
}

/** The dashboard tiles' drill-down: my workflows by status, and my overdue tasks. */
function MyWorkflows() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { setPageTitle } = useUIStore();
  const [page, setPage] = useState(1);

  const status = STATUSES.find((s) => s === searchParams.get('status')) ?? 'pending';
  const isOverdueView = status === 'overdue';

  useEffect(() => {
    setPageTitle('My Workflows');
  }, [setPageTitle]);

  const setStatus = (next: MyWorkflowsStatus) => {
    setPage(1);
    router.replace(`/staff/workflows?status=${next}`, { scroll: false });
  };

  const { data: counts } = useWorkflowInstanceStatusCounts('mine');
  // Same query as the dashboard's Overdue tile, so the count and this list agree.
  const { data: overdueCount } = useTasks({ scope: 'mine', overdue: true, limit: 1 });

  const instancesQuery = useWorkflowInstances(
    { status: isOverdueView ? undefined : status, page, limit: PAGE_SIZE },
    { enabled: !isOverdueView },
  );
  const tasksQuery = useTasks(
    { scope: 'mine', overdue: true, sort: 'dueAt', page, limit: PAGE_SIZE },
    { enabled: isOverdueView },
  );

  // Status counts' `inProgress` already includes on hold.
  const onHold = counts?.onHold ?? 0;
  const tabs: { key: MyWorkflowsStatus; label: string; count?: number }[] = [
    { key: 'pending', label: 'Pending', count: counts?.pending },
    { key: 'in_progress', label: 'In progress', count: counts?.inProgress },
    { key: 'closed', label: 'Closed', count: counts?.closed },
    { key: 'overdue', label: 'Overdue', count: overdueCount?.pagination?.total },
  ];
  const activeTab = status === 'on_hold' ? 'in_progress' : status;

  const query = isOverdueView ? tasksQuery : instancesQuery;
  const pagination = query.data?.pagination;

  return (
    <div>
      <div className="crumbs">
        <Link href="/staff" className="back">
          <Icon name="chevL" size={13} /> Dashboard
        </Link>
      </div>
      <div className="page-head">
        <div>
          <div className="page-title">My Workflows</div>
          <div className="page-sub">
            Workflows you hold a task in, by status, and your tasks past their deadline.
          </div>
        </div>
      </div>

      <div className="tabs" role="tablist" aria-label="Workflow status">
        {tabs.map((t) => (
          <button
            key={t.key}
            type="button"
            role="tab"
            aria-selected={activeTab === t.key}
            className={`tab ${activeTab === t.key ? 'active' : ''}`}
            onClick={() => setStatus(t.key)}
          >
            {t.label}
            {t.count !== undefined && <span className="tabular-nums"> ({t.count})</span>}
          </button>
        ))}
      </div>

      {activeTab === 'in_progress' && (
        <div className="seg mb-4" role="group" aria-label="In progress or on hold">
          <button
            type="button"
            className={status === 'in_progress' ? 'active' : ''}
            aria-pressed={status === 'in_progress'}
            onClick={() => setStatus('in_progress')}
          >
            Active{counts ? ` (${counts.inProgress - onHold})` : ''}
          </button>
          <button
            type="button"
            className={status === 'on_hold' ? 'active' : ''}
            aria-pressed={status === 'on_hold'}
            onClick={() => setStatus('on_hold')}
          >
            On hold{counts ? ` (${onHold})` : ''}
          </button>
        </div>
      )}

      <div className="card">
        {query.isError ? (
          <div style={{ padding: '32px' }}>
            <ErrorMessage
              message={isOverdueView ? 'Failed to load tasks' : 'Failed to load workflows'}
              retry={query.refetch}
            />
          </div>
        ) : query.isLoading ? (
          <SkeletonTaskRows rows={6} />
        ) : isOverdueView ? (
          tasksQuery.data?.data.length ? (
            <div className="rowlist">
              {tasksQuery.data.data.map((t) => (
                <TaskRow key={t.id} item={t} />
              ))}
            </div>
          ) : (
            <EmptyState
              icon="check"
              title="Nothing overdue"
              message="Every task you hold is inside its deadline."
            />
          )
        ) : instancesQuery.data?.data.length ? (
          <div className="rowlist">
            {instancesQuery.data.data.map((wi) => (
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
            title={`No ${status === 'on_hold' ? 'on hold' : status.replace('_', ' ')} workflows`}
            message="Workflows show here while you hold a task in them. Once a document you routed moves on to someone else's stage, it leaves this list; its own page still says it's in a workflow."
          />
        )}
        {pagination && (
          <Pagination
            page={pagination.page}
            totalPages={pagination.totalPages}
            total={pagination.total}
            limit={pagination.limit}
            onPageChange={setPage}
          />
        )}
      </div>
    </div>
  );
}

/** One workflow in the list; opens its workflow page. */
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
    </div>
  );
}
