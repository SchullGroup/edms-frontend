'use client';

import React, { useState, useEffect } from 'react';
import { useStore } from '@/store/useStore';
import { useUIStore } from '@/store/useUIStore';
import { Table, Column } from '@/components/ui/Table';

export default function TenantAuditPage() {
  const { audit, users } = useStore();
  const { setPageTitle } = useUIStore();

  const [q, setQ] = useState('');
  const [userF, setUserF] = useState('All');
  const [actionF, setActionF] = useState('All');

  useEffect(() => {
    setPageTitle('Tenant Audit');
  }, [setPageTitle]);

  const rows = (audit || [])
    .filter((a: any) => a.tenant === 't-1')
    .filter((a: any) => userF === 'All' || a.user === userF)
    .filter((a: any) => actionF === 'All' || a.action === actionF)
    .filter((a: any) => {
      if (!q) return true;
      const searchStr = `${a.detail} ${a.action} ${a.target}`.toLowerCase();
      return searchStr.includes(q.toLowerCase());
    });

  const actions = ['All', ...Array.from(new Set((audit || []).map((a: any) => a.action)))];

  const handleExport = () => {
    const csvContent = [
      ['Timestamp', 'User', 'Action', 'Detail'].join(','),
      ...rows.map((r: any) => [
        new Date(r.at).toISOString(),
        users.find((u: any) => u.id === r.user)?.name || r.user,
        r.action,
        `"${r.detail?.replace(/"/g, '""') || ''}"`
      ].join(','))
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = 'tenant-audit.csv';
    link.click();
  };

  const cols: Column<any>[] = [
    { key: 'at', label: 'When', sortable: true, render: a => new Date(a.at).toLocaleString() },
    { key: 'user', label: 'Actor', render: a => users?.find((u: any) => u.id === a.user)?.name || a.user },
    { key: 'action', label: 'Action', render: a => <span className="kbd">{a.action}</span> },
    { key: 'target', label: 'Target', render: a => a.target?.startsWith('doc') ? (
        <a href={`#/doc/${a.target}`} onClick={e => e.stopPropagation()}>{a.target.toUpperCase()}</a>
      ) : a.target 
    },
    { key: 'detail', label: 'Detail', render: a => <span style={{ fontSize: '12px' }}>{a.detail}</span> },
  ];

  return (
    <div>
      <div className="page-head">
        <div>
          <div className="page-title">Tenant Audit</div>
          <div className="page-sub">Tenant-scoped immutable event log.</div>
        </div>
        <div className="actions">
          <input 
            className="input" 
            type="search" 
            placeholder="Filter detail…" 
            style={{ width: '180px', height: '32px' }} 
            value={q} 
            onChange={e => setQ(e.target.value)} 
          />
          <select 
            className="input" 
            style={{ width: 'auto', height: '32px' }} 
            value={userF} 
            onChange={e => setUserF(e.target.value)}
          >
            <option value="All">All actors</option>
            {users?.map((u: any) => (
              <option key={u.id} value={u.id}>{u.name}</option>
            ))}
          </select>
          <select 
            className="input" 
            style={{ width: 'auto', height: '32px' }} 
            value={actionF} 
            onChange={e => setActionF(e.target.value)}
          >
            {actions.map((a: any) => (
              <option key={a} value={a}>{a === 'All' ? 'All actions' : a}</option>
            ))}
          </select>
        </div>
      </div>

      <div className="card">
        <div className="card-head">
          <span className="h3">{rows.length} events (immutable, tenant-scoped)</span>
          <button className="btn btn-secondary btn-sm" onClick={handleExport}>Export</button>
        </div>
        <Table cols={cols} rows={rows} />
      </div>
    </div>
  );
}
