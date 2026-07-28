'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useStore } from '@/store/useStore';
import { useUIStore } from '@/store/useUIStore';
import { Table, Column } from '@/components/ui/Table';

export default function AuditorTrailPage() {
  const router = useRouter();
  const { audit, users, auditAction } = useStore();
  const { setPageTitle, openModal, closeModal, addToast } = useUIStore();

  const [userF, setUserF] = useState('All');
  const [actionF, setActionF] = useState('All');
  const [days, setDays] = useState(30);
  const [q, setQ] = useState('');

  useEffect(() => {
    setPageTitle('Audit Trail');
  }, [setPageTitle]);

  const actions = ['All', ...Array.from(new Set((audit || []).map((a: any) => a.action)))];

  const rows = (audit || []).filter((a: any) => {
    if (a.at < Date.now() - days * 86400000) return false;
    if (userF !== 'All' && a.user !== userF) return false;
    if (actionF !== 'All' && a.action !== actionF) return false;
    if (q && !(a.detail + a.action + a.target).toLowerCase().includes(q.toLowerCase())) return false;
    return true;
  });

  const handleExport = () => {
    const csvContent = [
      ['Timestamp', 'Actor', 'Action', 'Target', 'Detail'].join(','),
      ...rows.map((r: any) => [
        new Date(r.at).toISOString(),
        users?.find((u: any) => u.id === r.user)?.name || r.user,
        r.action,
        r.target,
        `"${r.detail?.replace(/"/g, '""') || ''}"`
      ].join(','))
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = 'audit-extract.csv';
    link.click();
    auditAction('AUDIT_EXPORT', 'Audit Log', `Exported filtered extract (${rows.length} rows)`);
  };

  const handleRaiseFinding = (a: any) => {
    let title = '';
    let detail = `Observed in audit trail: ${a.action} — ${a.detail}`;
    let sev = 'Medium';

    openModal({
      title: 'Raise finding from event',
      body: (
        <div>
          <div className="field">
            <label>Title <span className="req">*</span></label>
            <input className="input" placeholder="Short finding title" onChange={e => title = e.target.value} />
          </div>
          <div className="field">
            <label>Detail & evidence <span className="req">*</span></label>
            <textarea className="input" style={{ minHeight: '90px' }} defaultValue={detail} onChange={e => detail = e.target.value}></textarea>
          </div>
          <div className="field">
            <label>Severity</label>
            <select className="input" defaultValue={sev} onChange={e => sev = e.target.value}>
              <option>High</option>
              <option>Medium</option>
              <option>Low</option>
            </select>
          </div>
        </div>
      ),
      actions: [
        { label: 'Cancel' },
        {
          label: 'Raise finding',
          kind: 'btn-primary',
          onClick: () => {
            if (!title.trim() || !detail.trim()) {
              addToast('Title and detail are required', 'error');
              return;
            }
            // Real implementation would add to findings state
            auditAction('FINDING_RAISE', 'FND-NEW', 'Raised: ' + title);
            addToast('Finding raised', 'success');
            closeModal();
          }
        }
      ]
    });
  };

  const cols: Column<any>[] = [
    { key: 'at', label: 'Timestamp', sortable: true, render: a => new Date(a.at).toLocaleString() },
    { key: 'user', label: 'Actor', render: a => users?.find((u: any) => u.id === a.user)?.name || a.user },
    { key: 'action', label: 'Action', render: a => <span className="kbd">{a.action}</span> },
    { key: 'target', label: 'Target', render: a => (
        a.target && String(a.target).startsWith('doc') ? (
          <button 
            className="btn btn-ghost btn-sm" 
            style={{ padding: '2px 6px', fontWeight: 700 }}
            onClick={(e) => { e.stopPropagation(); router.push(`/doc/${a.target}`); }}
          >
            {a.target.toUpperCase()}
          </button>
        ) : a.target
      ) 
    },
    { key: 'detail', label: 'Detail', render: a => <span style={{ fontSize: '12px', lineHeight: 1.5 }}>{a.detail}</span> },
    { key: 'raise', label: '', render: a => (
        <button className="btn btn-ghost btn-sm" title="Raise a finding from this event" onClick={(e) => {
          e.stopPropagation();
          handleRaiseFinding(a);
        }}>Raise finding</button>
      ) 
    },
  ];

  return (
    <div>
      <div className="page-head">
        <div>
          <div className="page-title">Audit Trail</div>
          <div className="page-sub">Filter events by actor, action and period; raise findings directly from evidence.</div>
        </div>
        <div className="actions">
          <input 
            className="input" 
            type="search" 
            placeholder="Search detail…" 
            style={{ width: '170px', height: '32px' }} 
            value={q} 
            onChange={e => setQ(e.target.value)} 
          />
          <select className="input" style={{ width: 'auto', height: '32px' }} value={userF} onChange={e => setUserF(e.target.value)}>
            <option value="All">All actors</option>
            {users?.map((u: any) => (
              <option key={u.id} value={u.id}>{u.name}</option>
            ))}
          </select>
          <select className="input" style={{ width: 'auto', height: '32px' }} value={actionF} onChange={e => setActionF(e.target.value)}>
            {actions.map((a: any) => (
              <option key={a} value={a}>{a === 'All' ? 'All actions' : a}</option>
            ))}
          </select>
          <select className="input" style={{ width: 'auto', height: '32px' }} value={days} onChange={e => setDays(Number(e.target.value))}>
            <option value={30}>Last 30 days</option>
            <option value={7}>Last 7 days</option>
            <option value={90}>Last 90 days</option>
          </select>
        </div>
      </div>

      <div className="card">
        <div className="card-head">
          <span className="h3">{rows.length} immutable events</span>
          <div className="flex g8">
            <button className="btn btn-secondary btn-sm" onClick={handleExport}>Export extract</button>
          </div>
        </div>
        <Table cols={cols} rows={rows} />
      </div>
    </div>
  );
}
