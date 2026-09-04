'use client';

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useUIStore } from '@/store/useUIStore';
import { useBottlenecksAgeing } from '@/apis/hooks/useWorkflowInstances';
import { useReassignTask } from '@/apis/hooks/useTasks';
import { useUsers } from '@/apis/hooks/useUsers';
import { useCreateAuditLog } from '@/apis/hooks/useAudit';
import { Spinner } from '@/components/common/Spinner';
import { ErrorMessage } from '@/components/common/ErrorMessage';
import { HBarChart } from '@/components/ui/Charts';
import { Table, Column } from '@/components/ui/Table';
import { Pagination } from '@/components/ui/Pagination';
import { Icon } from '@/components/ui/Icons';
import { StatusBadge, SlaBadge } from '@/components/ui/Badges';
import { WorkflowBottleneckItem } from '@/types/models';

const PAGE_SIZE = 20;

// Process state, not time-risk — kept as its own badge, separate from SlaBadge.
const WORKFLOW_STATUS_LABEL: Record<string, string> = {
  pending: 'Pending',
  in_progress: 'In Progress',
  on_hold: 'On Hold',
};

export default function BottlenecksPage() {
  const router = useRouter();
  const [page, setPage] = useState(1);

  const { data, isLoading, isError, refetch } = useBottlenecksAgeing({ page, limit: PAGE_SIZE });
  const { data: usersData, isLoading: isLoadingUsers } = useUsers();
  const users = usersData?.data || [];

  const reassignTask = useReassignTask();
  const createAuditLog = useCreateAuditLog();
  const { setPageTitle, openModal, closeModal, addToast } = useUIStore();

  useEffect(() => {
    setPageTitle('Bottlenecks & Ageing');
  }, [setPageTitle]);

  const summary = data?.summary;
  const ageingDistribution = data?.ageingDistribution || [];
  const stageDistribution = data?.stageDistribution || [];
  const items = data?.items || [];
  const pagination = data?.pagination;

  const buckets = ageingDistribution.map((b) => ({
    label: b.label,
    value: b.count,
    color:
      b.bucket === '0_3_days'
        ? 'var(--status-closed)'
        : b.bucket === '4_7_days'
          ? 'var(--status-pending)'
          : b.bucket === '8_14_days'
            ? 'var(--brand-accent)'
            : 'var(--status-overdue)',
  }));

  const stageItems = stageDistribution.map((s) => ({
    label: s.stageName,
    value: s.count,
    color: 'var(--brand-primary-light)',
  }));

  const handleReassign = (item: WorkflowBottleneckItem) => {
    if (!item.canReassign || !item.currentTaskId) return;
    const currentTaskId = item.currentTaskId;
    let newAssignee = '';
    let note = '';
    openModal({
      title: `Reassign — ${item.documentTitle.slice(0, 44)}${item.documentTitle.length > 44 ? '…' : ''}`,
      body: (
        <div>
          <div className="field">
            <label>Current assignee</label>
            <input className="input" disabled value={item.assigneeName} />
          </div>
          <div className="field">
            <label>New assignee</label>
            <select className="input" onChange={(e) => (newAssignee = e.target.value)}>
              <option value="">Select user...</option>
              {users
                .filter((u) => u.status === 'active' && u.id !== item.assigneeId)
                .map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.name}
                  </option>
                ))}
            </select>
          </div>
          <div className="field">
            <label>Note</label>
            <input
              className="input"
              placeholder="Optional handover note"
              onChange={(e) => (note = e.target.value)}
            />
          </div>
        </div>
      ),
      actions: [
        { label: 'Cancel' },
        {
          label: 'Reassign',
          kind: 'btn-primary',
          onClick: () => {
            if (!newAssignee) {
              addToast('Please select a new assignee', 'error');
              return;
            }
            const newName = users.find((u) => u.id === newAssignee)?.name || 'new assignee';
            reassignTask.mutate(
              { id: currentTaskId, assigneeId: newAssignee, note: note || undefined },
              {
                onSuccess: () => {
                  createAuditLog.mutate({
                    action: 'REASSIGN',
                    target: item.documentId,
                    detail: `Reassigned from ${item.assigneeName} to ${newName}`,
                  });
                  addToast(`Reassigned to ${newName}`, 'success');
                  closeModal();
                  refetch();
                },
              },
            );
          },
        },
      ],
    });
  };

  const cols: Column<WorkflowBottleneckItem>[] = [
    {
      key: 'documentTitle',
      label: 'Document',
      render: (r) => (
        <span>
          <b>{r.documentTitle}</b>
          <div className="caption">{r.cabinetName}</div>
        </span>
      ),
    },
    { key: 'currentStageName', label: 'Stuck at stage' },
    { key: 'assigneeName', label: 'Assignee' },
    {
      key: 'ageDays',
      label: 'Age',
      sortable: true,
      render: (r) => (
        <span style={r.ageDays > 7 ? { color: 'var(--status-overdue)', fontWeight: 800 } : {}}>
          {r.ageDays}d
        </span>
      ),
    },
    {
      key: 'slaStatus',
      label: 'SLA Status',
      render: (r) => <SlaBadge status={r.slaStatus} />,
    },
    {
      key: 'workflowStatus',
      label: 'Workflow Status',
      render: (r) => <StatusBadge status={WORKFLOW_STATUS_LABEL[r.workflowStatus] || r.workflowStatus} />,
    },
    {
      key: 'canReassign',
      label: '',
      render: (r) =>
        r.canReassign ? (
          <button
            className="btn btn-secondary btn-sm"
            onClick={(e) => {
              e.stopPropagation();
              handleReassign(r);
            }}
          >
            Reassign
          </button>
        ) : null,
    },
  ];

  return (
    <div>
      <div className="page-head">
        <div>
          <div className="page-title">Bottlenecks & Ageing</div>
          <div className="page-sub">Where files are stuck, and which have breached SLA.</div>
        </div>
      </div>

      {isLoading || isLoadingUsers ? (
        <Spinner />
      ) : isError ? (
        <ErrorMessage message="Failed to load bottlenecks" retry={() => refetch()} />
      ) : (
        <>
          {summary && summary.breachedItems > 0 ? (
            <div className="banner error">
              <span style={{ marginRight: '8px' }}>
                <Icon name="alert" size={15} />
              </span>
              <b>
                {summary.breachedItems} SLA breach{summary.breachedItems > 1 ? 'es' : ''}
              </b>{' '}
              — review and reassign before they age further.
            </div>
          ) : (
            <div className="banner success">No active SLA breaches. Nice.</div>
          )}

          <div className="grid cols-2 mb16">
            <div className="card">
              <div className="card-head">
                <span className="h3">Ageing distribution (open items)</span>
              </div>
              <div className="card-body">
                <HBarChart items={buckets} />
              </div>
            </div>
            <div className="card">
              <div className="card-head">
                <span className="h3">Open items by workflow stage</span>
              </div>
              <div className="card-body">
                <HBarChart items={stageItems} />
              </div>
            </div>
          </div>

          <div className="card">
            <div className="card-head">
              <span className="h3">Ageing detail — oldest first</span>
            </div>
            <Table
              cols={cols}
              rows={items}
              onRow={(r) => router.push(`/doc/${r.documentId}`)}
            />
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
        </>
      )}
    </div>
  );
}
