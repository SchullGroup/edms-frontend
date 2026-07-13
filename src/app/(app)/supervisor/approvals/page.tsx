'use client';

import React, { useState, useEffect } from 'react';
import { useStore, userById } from '@/store/useStore';
import { useUIStore } from '@/store/useUIStore';
import { TaskRow } from '@/components/ui/TaskRow';
import { Icon } from '@/components/ui/Icons';

export default function ApprovalsQueuePage() {
  const { documents, session, users, auditAction, updateDocument } = useStore();
  const { setPageTitle, openModal, closeModal, openConfirm, addToast } = useUIStore();

  useEffect(() => {
    setPageTitle('Approvals Queue');
  }, [setPageTitle]);

  const queue = documents.filter(d => d.assignee === session && d.status !== 'Closed')
    .sort((a, b) => {
      const u = { Critical: 0, High: 1, Normal: 2, Low: 3 };
      return (u[a.urgency as keyof typeof u] || 2) - (u[b.urgency as keyof typeof u] || 2);
    });

  const handleApprove = (d: any) => {
    openConfirm({
      title: `Approve “${d.title.slice(0, 40)}…”?`,
      message: 'The current stage completes and the file advances. Your decision is recorded in the immutable audit trail.',
      confirmLabel: 'Approve',
      onConfirm: () => {
        // Mock workflow advance
        updateDocument(d.id, {
          workflow: d.workflow.map((s: any) => s.state === 'current' ? { ...s, state: 'past' } : s)
        });
        auditAction('APPROVE', d.id, 'Approved via approvals queue');
        addToast('Approved', 'success');
      }
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
            <input className="input" disabled value={userById(users, d.assignee)?.name || ''} />
          </div>
          <div className="field">
            <label>New assignee</label>
            <select className="input" onChange={e => newAssignee = e.target.value}>
              <option value="">Select user...</option>
              {users.filter(u => u.status === 'Active' && u.id !== d.assignee).map(u => (
                <option key={u.id} value={u.id}>{u.name} — {u.roleLabel}</option>
              ))}
            </select>
          </div>
          <div className="field">
            <label>Note</label>
            <input className="input" placeholder="Optional handover note" onChange={e => note = e.target.value} />
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
            updateDocument(d.id, { assignee: newAssignee });
            const me = userById(users, session || '');
            addToast('Document ' + d.title + ' reassigned', 'success');
            auditAction('REASSIGN', d.id, `Reassigned from ${userById(users, prev)?.name} to ${userById(users, newAssignee)?.name}`);
            addToast(`Reassigned to ${userById(users, newAssignee)?.name}`, 'success');
            closeModal();
          }
        }
      ]
    });
  };

  return (
    <div>
      <div className="page-head">
        <div>
          <div className="page-title">Approvals Queue</div>
          <div className="page-sub">Items awaiting your decision — approve inline or open for full context.</div>
        </div>
      </div>

      <div className="card">
        {queue.length > 0 ? (
          <div className="rowlist">
            {queue.map((d: any) => (
              <TaskRow 
                key={d.id} 
                doc={d} 
                extraActions={
                  <>
                    <button className="btn btn-success btn-sm" onClick={(e) => { e.stopPropagation(); handleApprove(d); }}>Approve</button>
                    <button className="btn btn-secondary btn-sm" onClick={(e) => { e.stopPropagation(); handleReassign(d); }}>Reassign</button>
                  </>
                }
              />
            ))}
          </div>
        ) : (
          <div className="empty">
            <Icon name="approve" size={32} />
            <div className="h3 mt16 mb8">Approvals queue is clear</div>
            <p className="caption mb16">Items routed for your decision will appear here, ordered by urgency and SLA.</p>
          </div>
        )}
      </div>
    </div>
  );
}
