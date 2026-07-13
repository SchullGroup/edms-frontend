'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useStore } from '@/store/useStore';
import { useUIStore } from '@/store/useUIStore';
import { Table, Column } from '@/components/ui/Table';
import { SevBadge } from '@/components/ui/Badges';
import { Icon } from '@/components/ui/Icons';

export default function ExceptionsPage() {
  const router = useRouter();
  const { auditAction } = useStore();
  const { setPageTitle, addToast } = useUIStore();

  const [rows, setRows] = useState([
    { id: 'ex-1', at: Date.now() - 2 * 86400000, type: 'SoD conflict', doc: 'doc-1008', detail: 'Uploader approved own memo — maker-checker did not trigger (legacy workflow version).', sev: 'High', status: 'Open' },
    { id: 'ex-2', at: Date.now() - 4 * 86400000, type: 'Control failure', doc: 'doc-1013', detail: 'Restricted document printed without watermark overlay.', sev: 'Medium', status: 'In Remediation' },
    { id: 'ex-3', at: Date.now() - 6 * 86400000, type: 'SLA breach', doc: 'doc-1005', detail: 'Officer Verification exceeded 48h SLA; escalated per policy.', sev: 'Medium', status: 'Acknowledged' },
    { id: 'ex-4', at: Date.now() - 9 * 86400000, type: 'Access anomaly', doc: 'doc-1009', detail: 'Access attempt to Top Secret litigation brief by unauthorised role (denied, logged).', sev: 'High', status: 'Closed' },
  ]);

  useEffect(() => {
    setPageTitle('Exceptions');
  }, [setPageTitle]);

  const handleAcknowledge = (id: string, docId: string, type: string) => {
    setRows(prev => prev.map(r => r.id === id ? { ...r, status: 'Acknowledged' } : r));
    auditAction('EXCEPTION_ACK', docId, 'Acknowledged exception: ' + type);
    addToast('Exception acknowledged and logged', 'success');
  };

  const cols: Column<any>[] = [
    { key: 'at', label: 'When', sortable: true, render: r => <span>{new Date(r.at).toLocaleDateString('en-GB')}</span> },
    { key: 'type', label: 'Type', render: r => <b>{r.type}</b> },
    { key: 'detail', label: 'Detail', render: r => <span style={{ fontSize: '12px', lineHeight: 1.5 }}>{r.detail}</span> },
    { key: 'sev', label: 'Severity', render: r => <SevBadge sev={r.sev} /> },
    { key: 'status', label: 'Status', render: r => <span className={`badge ${r.status === 'Closed' ? 'b-status-closed' : r.status === 'Open' ? 'b-status-overdue' : 'b-status-pending'}`}>{r.status}</span> },
    { key: 'act', label: '', render: r => (
        <div className="flex g8">
          <button className="btn btn-secondary btn-sm" onClick={(e) => { e.stopPropagation(); router.push(`/doc/${r.doc}`); }}>Open file</button>
          {r.status === 'Open' && (
            <button className="btn btn-primary btn-sm" onClick={(e) => { e.stopPropagation(); handleAcknowledge(r.id, r.doc, r.type); }}>Acknowledge</button>
          )}
        </div>
      )
    },
  ];

  return (
    <div>
      <div className="page-head">
        <div>
          <div className="page-title">Exceptions</div>
          <div className="page-sub">Control failures, SoD conflicts and access anomalies affecting your team.</div>
        </div>
      </div>

      <div className="banner warning mb16">
        <span style={{ marginRight: '8px' }}><Icon name="shield" size={15} /></span>
        Exceptions are shared with Internal Audit automatically. Acknowledging records your review; remediation is tracked as a finding.
      </div>

      <div className="card">
        <Table cols={cols} rows={rows} />
      </div>
    </div>
  );
}
