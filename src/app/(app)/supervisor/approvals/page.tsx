'use client';

import React, { useState, useEffect } from 'react';
import { useStore, userById } from '@/store/useStore';
import { useUIStore } from '@/store/useUIStore';
import { useDocuments, useUpdateDocument } from '@/apis/hooks/useDocuments';
import { useUsers } from '@/apis/hooks/useUsers';
import { useCreateAuditLog } from '@/apis/hooks/useAudit';
import { Spinner } from '@/components/common/Spinner';
import { TaskRow } from '@/components/ui/TaskRow';
import { Icon } from '@/components/ui/Icons';

export default function ApprovalsQueuePage() {
  const { currentUser } = useStore();
  const session = currentUser?.id;

  const { data: docsData, isLoading: isLoadingDocs } = useDocuments();
  const { data: usersData, isLoading: isLoadingUsers } = useUsers();
  const documents = docsData?.data || [];
  const users = usersData?.data || [];

  const updateDocument = useUpdateDocument();
  const createAuditLog = useCreateAuditLog();

  const { setPageTitle, openModal, closeModal, openConfirm, addToast } = useUIStore();

  useEffect(() => {
    setPageTitle('Approvals Queue');
  }, [setPageTitle]);

  if (isLoadingDocs || isLoadingUsers) return <Spinner />;

  const queue = documents
    .filter((d) => d.assignee === session && d.status !== 'closed')
    .sort((a, b) => {
      const u = { Critical: 0, High: 1, Normal: 2, Low: 3 };
      return (u[a.urgency as keyof typeof u] || 2) - (u[b.urgency as keyof typeof u] || 2);
    });

  const handleApprove = (d: any) => {
    openConfirm({
      title: `Approve “${d.title.slice(0, 40)}…”?`,
      message:
        'The current stage completes and the file advances. Your decision is recorded in the immutable audit trail.',
      confirmLabel: 'Approve',
      onConfirm: () => {
        // Mock workflow advance
        updateDocument.mutate({
          id: d.id,
          updates: {
            workflow: d.workflow.map((s: any) =>
              s.state === 'current' ? { ...s, state: 'past' } : s,
            ),
          } as any,
        });
        createAuditLog.mutate({
          action: 'APPROVE',
          target: d.id,
          detail: 'Approved via approvals queue',
        });
        addToast('Approved', 'success');
      },
    });
  };

  const handleReassign = (d: any) => {
    let newAssignee = '';
    let note = '';
    openModal({
      title: `Reassign — ${d.title.slice(0, 44)}${d.title.length > 44 ? '…' : ''}`,
      body: (
        <div>
          <div className="field">
            <label>Current assignee</label>
            <input
              className="input"
              disabled
              value={userById(users, d.assignee as string)?.name || ''}
            />
          </div>
          <div className="field">
            <label>New assignee</label>
            <select className="input" onChange={(e) => (newAssignee = e.target.value)}>
              <option value="">Select user...</option>
              {users
                .filter((u) => u.status === 'active' && u.id !== d.assignee)
                .map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.name} — {(u as any).roleLabel || (u as any).role || u.roles?.[0]}
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
            const prev = d.assignee;
            updateDocument.mutate({ id: d.id, updates: { assignee: newAssignee } });
            addToast('Document ' + d.title + ' reassigned', 'success');
            createAuditLog.mutate({
              action: 'REASSIGN',
              target: d.id,
              detail: `Reassigned from ${userById(users, prev as string)?.name} to ${userById(users, newAssignee as string)?.name}`,
            });
            addToast(`Reassigned to ${userById(users, newAssignee as string)?.name}`, 'success');
            closeModal();
          },
        },
      ],
    });
  };

  return (
    <div>
      <div className="page-head">
        <div>
          <div className="page-title">Approvals Queue</div>
          <div className="page-sub">
            Items awaiting your decision — approve inline or open for full context.
          </div>
        </div>
      </div>

      <div className="card">
        {queue.length > 0 ? (
          <div className="rowlist">
            {queue.map((d: any) => (
              <TaskRow
                key={d.id}
                item={d}
                extraActions={
                  <>
                    <button
                      className="btn btn-success btn-sm"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleApprove(d);
                      }}
                    >
                      Approve
                    </button>
                    <button
                      className="btn btn-secondary btn-sm"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleReassign(d);
                      }}
                    >
                      Reassign
                    </button>
                  </>
                }
              />
            ))}
          </div>
        ) : (
          <div className="empty">
            <Icon name="approve" size={32} />
            <div className="h3 mt16 mb8">Approvals queue is clear</div>
            <p className="caption mb16">
              Items routed for your decision will appear here, ordered by urgency and SLA.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
