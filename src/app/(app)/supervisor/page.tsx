'use client';

import React, { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useStore, userById } from '@/store/useStore';
import { useUIStore } from '@/store/useUIStore';
import { Icon } from '@/components/ui/Icons';
import { Table, Column } from '@/components/ui/Table';
import { Avatar } from '@/components/ui/Avatar';
import { HBarChart } from '@/components/ui/Charts';
import { StatusBadge, UrgBadge } from '@/components/ui/Badges';
import { exportCsv } from '@/utils/exportCsv';
import { effStatus } from '@/utils/helpers';

const TEAM = ['u-chika', 'u-ngozi', 'u-tunde', 'u-amara', 'u-seun'];

export default function SupervisorDashboard() {
  const router = useRouter();
  const { documents, users, cabinets } = useStore();
  const { setPageTitle, openModal, closeModal, openDrawer, closeDrawer, addToast } = useUIStore();

  useEffect(() => {
    setPageTitle('Team Overview');
  }, [setPageTitle]);

  const teamDocs = documents.filter((d) => TEAM.includes(d.assignee) || d.assignee === 'u-david');
  const count = (arr: any[], st: string) => arr.filter((d) => effStatus(d) === st).length;

  const tiles = [
    { label: 'Pending', val: count(teamDocs, 'Pending'), cls: 't-pending', ico: 'clock' },
    { label: 'In Progress', val: count(teamDocs, 'In Progress'), cls: 't-progress', ico: 'pulse' },
    {
      label: 'Closed (30d)',
      val: teamDocs.filter((d) => d.status === 'Closed').length,
      cls: 't-closed',
      ico: 'check',
    },
    { label: 'Overdue / SLA', val: count(teamDocs, 'Overdue'), cls: 't-overdue', ico: 'alert' },
  ];

  const matrix = TEAM.map((uid) => {
    const u = userById(users, uid);
    const md = documents.filter((d) => d.assignee === uid);
    return {
      uid,
      name: u?.name || 'Unknown',
      dept: u?.dept || '',
      pending: count(md, 'Pending'),
      progress: count(md, 'In Progress'),
      overdue: count(md, 'Overdue'),
      closed: md.filter((d) => d.status === 'Closed').length,
      total: md.length,
    };
  });

  const byCab = cabinets
    .map((c) => ({
      label: c.name,
      value: teamDocs.filter((d) => d.cabinet === c.id && d.status !== 'Closed').length,
      color: 'var(--brand-primary-light)',
      onClick: () => router.push(`/cabinets?cab=${c.id}`),
    }))
    .filter((c) => c.value > 0);

  const handleReassignModal = (doc: any, onDone?: () => void) => {
    let newAssignee = '';
    let note = '';
    const currentAssigneeUser = userById(users, doc.assignee);

    openModal({
      title: `Reassign — ${doc.title.slice(0, 44)}${doc.title.length > 44 ? '…' : ''}`,
      body: (
        <div>
          <div className="field mb12">
            <label>Current Assignee</label>
            <input className="input" disabled value={currentAssigneeUser?.name || 'Unassigned'} />
          </div>
          <div className="field mb12">
            <label>New Assignee <span className="req">*</span></label>
            <select className="input" onChange={e => newAssignee = e.target.value}>
              <option value="">Select team member...</option>
              {users.filter(u => u.status === 'Active' && u.id !== doc.assignee).map(u => (
                <option key={u.id} value={u.id}>{u.name} — {u.roleLabel} ({u.dept})</option>
              ))}
            </select>
          </div>
          <div className="field">
            <label>Handover Note</label>
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
            const prev = doc.assignee;
            const newUser = userById(users, newAssignee);
            useStore.getState().updateDocument(doc.id, { assignee: newAssignee });
            useStore.getState().auditAction('REASSIGN', doc.id, `Reassigned from ${userById(users, prev)?.name} to ${newUser?.name}${note ? ` (Note: ${note})` : ''}`);
            addToast(`Reassigned to ${newUser?.name}`, 'success');
            closeModal();
            if (onDone) onDone();
          }
        }
      ]
    });
  };

  const handleRowClick = (r: any) => {
    const member = userById(users, r.uid);
    const mDocs = documents.filter((d) => d.assignee === r.uid && d.status !== 'Closed');

    openDrawer({
      title: `${r.name} — open items`,
      body: (
        <div>
          <div className="flex aic g12 mb16">
            <Avatar user={{ name: r.name }} />
            <div>
              <b style={{ fontSize: '14px', color: 'var(--ink)' }}>{r.name}</b>
              <div className="caption">{member?.roleLabel || 'Staff Officer'} · {r.dept}</div>
            </div>
          </div>

          {mDocs.length > 0 ? (
            <div className="rowlist">
              {mDocs.map((d: any) => (
                <div
                  key={d.id}
                  className="task-row"
                  style={{
                    border: '1px solid var(--border)',
                    borderRadius: '9px',
                    marginBottom: '8px',
                    padding: '12px 14px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    cursor: 'pointer'
                  }}
                  onClick={() => { closeDrawer(); router.push(`/doc/${d.id}`); }}
                >
                  <div className="task-main">
                    <div className="task-title" style={{ fontWeight: 600, fontSize: '13px', marginBottom: '6px' }}>{d.title}</div>
                    <div className="task-meta flex aic g8">
                      <StatusBadge status={effStatus(d)} />
                      <UrgBadge level={d.urgency} />
                    </div>
                  </div>
                  <button
                    className="btn btn-secondary btn-sm"
                    style={{ marginLeft: '12px', flexShrink: 0 }}
                    onClick={(e) => {
                      e.stopPropagation();
                      handleReassignModal(d, () => handleRowClick(r));
                    }}
                  >
                    Reassign
                  </button>
                </div>
              ))}
            </div>
          ) : (
            <div className="empty" style={{ padding: '32px 16px' }}>
              <Icon name="approve" size={32} />
              <div className="h3 mt16 mb8">No open items</div>
              <p className="caption">This member’s queue is clear.</p>
            </div>
          )}
        </div>
      )
    });
  };

  const cols: Column<any>[] = [
    {
      key: 'name',
      label: 'Member',
      render: (r) => (
        <span className="flex aic g8">
          <Avatar user={{ name: r.name }} sm />
          <span>
            <div style={{ fontWeight: 700 }}>{r.name}</div>
            <div className="caption">{r.dept}</div>
          </span>
        </span>
      ),
    },
    { key: 'pending', label: 'Pending', num: true, sortable: true },
    { key: 'progress', label: 'In Prog.', num: true, sortable: true },
    {
      key: 'overdue',
      label: 'Overdue',
      num: true,
      sortable: true,
      render: (r) => (
        <span style={r.overdue ? { color: 'var(--status-overdue)', fontWeight: 800 } : undefined}>
          {r.overdue}
        </span>
      ),
    },
    { key: 'closed', label: 'Closed', num: true, sortable: true },
  ];

  return (
    <div>
      <div className="page-head">
        <div>
          <div className="page-title">Team Overview</div>
          <div className="page-sub">
            Live status across your team and cabinets. Click through to detail.
          </div>
        </div>
        <div className="actions">
          <button className="btn btn-primary" onClick={() => router.push('/supervisor/approvals')}>
            <Icon name="approve" size={15} /> Approvals queue
          </button>
        </div>
      </div>

      <div className="grid cols-4 mb16">
        {tiles.map((t, i) => (
          <div
            key={i}
            className={`tile ${t.cls}`}
            role="button"
            tabIndex={0}
            onClick={() =>
              router.push(
                t.label.startsWith('Overdue') ? '/supervisor/bottlenecks' : '/supervisor/workload',
              )
            }
          >
            <div className="cnt">{t.val}</div>
            <div className="lbl">
              <Icon name={t.ico} size={13} /> {t.label}
            </div>
          </div>
        ))}
      </div>

      <div className="dash-body">
        <div className="card">
          <div className="card-head">
            <span className="h3">Member × status matrix</span>
            <button
              className="btn btn-secondary btn-sm"
              onClick={() => exportCsv('Team_Overview_Matrix', matrix)}
            >
              Export
            </button>
          </div>
          <Table cols={cols} rows={matrix} onRow={handleRowClick} />
        </div>

        <div className="card">
          <div className="card-head">
            <span className="h3">Open items by cabinet</span>
          </div>
          <div className="card-body">
            <HBarChart items={byCab} />
          </div>
        </div>
      </div>
    </div>
  );
}
