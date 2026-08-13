'use client';

import React, { useEffect } from 'react';
import { useStore, userById } from '@/store/useStore';
import { useUIStore } from '@/store/useUIStore';
import { useDocuments, useUpdateDocument } from '@/apis/hooks/useDocuments';
import { useUsers } from '@/apis/hooks/useUsers';
import { useCreateAuditLog } from '@/apis/hooks/useAudit';
import { Spinner } from '@/components/common/Spinner';
import { TaskRow } from '@/components/ui/TaskRow';

export default function WorkloadPage() {
  const { currentUser } = useStore();
  const session = currentUser?.id;

  const { data: docsData, isLoading: isLoadingDocs } = useDocuments();
  const { data: usersData, isLoading: isLoadingUsers } = useUsers();
  const documents = docsData?.data || [];
  const users = usersData?.data || [];

  const updateDocument = useUpdateDocument();
  const createAuditLog = useCreateAuditLog();

  const { setPageTitle, openModal, closeModal, addToast } = useUIStore();

  useEffect(() => {
    setPageTitle('Workload & Reassign');
  }, [setPageTitle]);

  if (isLoadingDocs || isLoadingUsers) return <Spinner />;

  const team = users.slice(0, 5); // mock team
  const cap = 8;

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
            addToast('Tasks reassigned', 'success');
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
          <div className="page-title">Workload & Reassign</div>
          <div className="page-sub">
            Per-member load against capacity. Reassign directly from any row.
          </div>
        </div>
      </div>

      <div>
        {team.map((u) => {
          const open = documents.filter((d) => d.assignee === u.id && d.status !== 'closed');
          const pct = Math.min(100, Math.round((open.length / cap) * 100));
          const color =
            pct >= 90
              ? 'var(--status-overdue)'
              : pct >= 65
                ? 'var(--status-pending)'
                : 'var(--status-closed)';

          return (
            <div key={u.id} className="card card-pad mb16">
              <div className="flex jcb aic wrap g12">
                <div className="flex aic g12">
                  <div className="avatar">{u.name.charAt(0)}</div>
                  <div>
                    <b>{u.name}</b>
                    <div className="caption">
                      {(u as any).departmentId || 'System'} · {open.length} open / capacity {cap}
                    </div>
                  </div>
                </div>
                <div style={{ flex: 1, minWidth: '160px', maxWidth: '300px' }}>
                  <div
                    className="pbar"
                    style={{
                      height: '8px',
                      background: 'var(--bg-body)',
                      borderRadius: '4px',
                      overflow: 'hidden',
                    }}
                  >
                    <i
                      style={{
                        display: 'block',
                        height: '100%',
                        width: `${pct}%`,
                        background: color,
                      }}
                    />
                  </div>
                </div>
                <span
                  className="tnum"
                  style={{
                    fontWeight: 800,
                    color: pct >= 90 ? 'var(--status-overdue)' : 'inherit',
                  }}
                >
                  {pct}%
                </span>
              </div>

              {open.length > 0 && (
                <div className="rowlist mt8" style={{ borderTop: '1px solid var(--border)' }}>
                  {open.map((d: any) => (
                    <TaskRow
                      key={d.id}
                      doc={d}
                      extraActions={
                        <button
                          className="btn btn-secondary btn-sm"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleReassign(d);
                          }}
                        >
                          Reassign
                        </button>
                      }
                    />
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
