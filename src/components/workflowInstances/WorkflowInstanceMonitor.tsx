'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useWorkflowInstances } from '@/apis/hooks/useWorkflowInstances';
import { useWorkflows } from '@/apis/hooks/useWorkflows';
import { useWorkflowInstanceLifecycle } from '@/hooks/useWorkflowInstanceLifecycle';
import { useUIStore } from '@/store/useUIStore';
import { Table, Column } from '@/components/ui/Table';
import { Pagination } from '@/components/ui/Pagination';
import { SkeletonTable } from '@/components/common/Skeleton';
import { StatusBadge } from '@/components/ui/Badges';
import { WorkflowInstanceDetail } from './WorkflowInstanceDetail';
import { fmtDate, dueLabel } from '@/utils/helpers';
import type { WorkflowInstance, WorkflowInstanceStatus } from '@/types/models';

const PAGE_SIZE = 20;

const STATUS_LABEL: Record<WorkflowInstanceStatus, string> = {
  pending: 'Pending',
  in_progress: 'In Progress',
  on_hold: 'On Hold',
  closed: 'Closed',
};

const STATUS_TABS: { value: '' | WorkflowInstanceStatus; label: string }[] = [
  { value: 'in_progress', label: 'In progress' },
  { value: 'on_hold', label: 'On hold' },
  { value: 'pending', label: 'Not started' },
  { value: 'closed', label: 'Closed' },
  { value: '', label: 'All' },
];

interface Row {
  id: string;
  instance: WorkflowInstance;
  document: string;
  workflow: string;
  stage: string;
  status: string;
  started: string;
  due: string;
  overdue: boolean;
}

/**
 * Tenant-wide view of every workflow that has been started — the answer to
 * "where is this file and who is sitting on it" without opening documents one
 * at a time. Mounted by both the supervisor console and the admin designer.
 */
export function WorkflowInstanceMonitor() {
  const router = useRouter();
  const { openDrawer, closeDrawer } = useUIStore();
  const { confirmHold, confirmResume, confirmClose, isPending } = useWorkflowInstanceLifecycle();

  const [status, setStatus] = useState<'' | WorkflowInstanceStatus>('in_progress');
  const [workflowId, setWorkflowId] = useState('');
  const [query, setQuery] = useState('');
  const [page, setPage] = useState(1);

  // Fetched wide because this list is a stage-name lookup table, not just a filter.
  const { data: workflowsData } = useWorkflows({ limit: 100 });
  const workflows = workflowsData?.data || [];

  const { data, isLoading } = useWorkflowInstances({
    page,
    limit: PAGE_SIZE,
    ...(status ? { status } : {}),
    ...(workflowId ? { workflowDefinitionId: workflowId } : {}),
  });

  const instances = data?.data || [];
  const pagination = data?.pagination;

  // The list response carries stage *ids*, not names — resolve them through the
  // definition that the workflows list already gives us.
  const definitionOf = (id: string) => workflows.find((w) => w.id === id);
  const stageNameOf = (instance: WorkflowInstance) => {
    if (!instance.currentStage) return instance.status === 'closed' ? '—' : 'Not started';
    const stages = definitionOf(instance.workflowDefinitionId)?.definition?.stages;
    return stages?.find((s) => s.id === instance.currentStage)?.name || instance.currentStage;
  };

  const rows: Row[] = instances
    .map((instance) => ({
      id: instance.id,
      instance,
      document: instance.document?.title || instance.documentId,
      workflow:
        instance.workflowDefinition?.name ||
        definitionOf(instance.workflowDefinitionId)?.name ||
        'Unknown workflow',
      stage: stageNameOf(instance),
      status: STATUS_LABEL[instance.status],
      started: instance.startedAt || '',
      due: instance.stageDueAt || '',
      overdue:
        instance.status !== 'closed' &&
        !!instance.stageDueAt &&
        new Date(instance.stageDueAt).getTime() < Date.now(),
    }))
    .filter((r) =>
      query.trim() ? r.document.toLowerCase().includes(query.trim().toLowerCase()) : true,
    );

  const overdueCount = rows.filter((r) => r.overdue).length;

  const openInstance = (r: Row) =>
    openDrawer({
      title: r.document,
      body: (
        <WorkflowInstanceDetail
          instanceId={r.id}
          onOpenDocument={(docId) => {
            closeDrawer();
            router.push(`/doc/${docId}`);
          }}
        />
      ),
    });

  const cols: Column<Row>[] = [
    {
      key: 'document',
      label: 'Document',
      sortable: true,
      render: (r) => <b>{r.document}</b>,
    },
    { key: 'workflow', label: 'Workflow', sortable: true },
    { key: 'stage', label: 'Current stage', sortable: true },
    {
      key: 'status',
      label: 'Status',
      render: (r) => <StatusBadge status={r.overdue ? 'Overdue' : r.status} />,
    },
    {
      key: 'started',
      label: 'Started',
      sortable: true,
      render: (r) => <span className="tnum">{r.started ? fmtDate(r.started) : '—'}</span>,
    },
    {
      key: 'due',
      label: 'Stage due',
      sortable: true,
      render: (r) => {
        if (!r.due) return <span className="muted">—</span>;
        const d = dueLabel(r.due);
        return (
          <span style={d.late ? { color: 'var(--status-overdue)', fontWeight: 700 } : {}}>
            {d.text}
          </span>
        );
      },
    },
    {
      key: 'id',
      label: '',
      render: (r) => (
        <div className="flex g8">
          {r.instance.status === 'on_hold' && (
            <button
              className="btn btn-secondary btn-sm"
              disabled={isPending}
              onClick={(e) => {
                e.stopPropagation();
                confirmResume(r.instance);
              }}
            >
              Resume
            </button>
          )}
          {r.instance.status === 'in_progress' && (
            <button
              className="btn btn-secondary btn-sm"
              disabled={isPending}
              onClick={(e) => {
                e.stopPropagation();
                confirmHold(r.instance);
              }}
            >
              Hold
            </button>
          )}
          {r.instance.status !== 'closed' && (
            <button
              className="btn btn-danger btn-sm"
              disabled={isPending}
              onClick={(e) => {
                e.stopPropagation();
                confirmClose(r.instance);
              }}
            >
              Close
            </button>
          )}
        </div>
      ),
    },
  ];

  return (
    <div>
      <div className="page-head">
        <div>
          <div className="page-title">Workflow Monitor</div>
          <div className="page-sub">
            Every workflow that has been started — where each file sits, who owes an action, and
            what has already happened to it.
          </div>
        </div>
      </div>

      {overdueCount > 0 && (
        <div className="banner error">
          <b>
            {overdueCount} of the {rows.length} shown
          </b>{' '}
          {overdueCount === 1 ? 'has' : 'have'} passed the stage SLA.
        </div>
      )}

      <div className="card">
        <div className="card-head">
          <div className="seg" role="group" aria-label="Filter by status">
            {STATUS_TABS.map((t) => (
              <button
                key={t.value || 'all'}
                type="button"
                className={status === t.value ? 'active' : ''}
                onClick={() => {
                  setStatus(t.value);
                  setPage(1);
                }}
              >
                {t.label}
              </button>
            ))}
          </div>
          <div className="flex g8 aic wrap">
            <select
              className="input"
              style={{ width: 'auto' }}
              value={workflowId}
              onChange={(e) => {
                setWorkflowId(e.target.value);
                setPage(1);
              }}
              aria-label="Filter by workflow"
            >
              <option value="">All workflows</option>
              {workflows.map((w) => (
                <option key={w.id} value={w.id}>
                  {w.name}
                </option>
              ))}
            </select>
            <input
              className="input"
              style={{ width: 'auto' }}
              type="search"
              placeholder="Filter this page by title…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              aria-label="Filter by document title"
            />
          </div>
        </div>

        {isLoading ? (
          <SkeletonTable
            columns={['Document', 'Workflow', 'Current stage', 'Status', 'Started', 'Stage due', '']}
          />
        ) : (
          <>
            <Table
              cols={cols}
              rows={rows}
              onRow={openInstance}
              defaultSortKey="started"
              defaultSortDir={-1}
              emptyMsg={
                query.trim()
                  ? 'No document on this page matches that title.'
                  : 'No workflows in this state. Route a document from a cabinet to start one.'
              }
            />
            {pagination && !query.trim() && (
              <Pagination
                page={pagination.page}
                totalPages={pagination.totalPages}
                total={pagination.total}
                limit={pagination.limit}
                onPageChange={setPage}
              />
            )}
          </>
        )}
      </div>
    </div>
  );
}
