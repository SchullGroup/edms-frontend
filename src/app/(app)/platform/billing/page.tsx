'use client';

import React, { useEffect } from 'react';
import { useStore } from '@/store/useStore';
import { useUIStore } from '@/store/useUIStore';
import { Table, Column } from '@/components/ui/Table';
import { Icon } from '@/components/ui/Icons';
// Note: lineChart and hbarChart from EDMS.ui would need standard implementation. 
// For now, we will use simple placeholders or basic HTML representations 
// as we don't have a complex charting library installed by default in Next.js.

export default function BillingPage() {
  const { tenants, auditAction } = useStore();
  const { setPageTitle, addToast } = useUIStore();

  useEffect(() => {
    setPageTitle('Billing & Usage');
  }, [setPageTitle]);

  const invoices = (tenants || [])
    .filter((t: any) => t.mrr > 0)
    .map((t: any, i: number) => ({
      no: 'INV-2026-07-' + String(101 + i),
      tenant: t.name,
      amount: t.mrr,
      status: i === 1 ? 'Overdue' : i === 3 ? 'Pending' : 'Paid',
      issued: 'Jul 01, 2026',
    }));

  const handleExport = () => {
    const csvContent = [
      ['Invoice', 'Tenant', 'Amount', 'Status'].join(','),
      ...invoices.map((r: any) => [r.no, `"${r.tenant}"`, r.amount, r.status].join(','))
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = 'invoices.csv';
    link.click();
  };

  const cols: Column<any>[] = [
    { key: 'no', label: 'Invoice', render: r => <b>{r.no}</b> },
    { key: 'tenant', label: 'Tenant' },
    { key: 'issued', label: 'Issued' },
    { key: 'amount', label: 'Amount', sortable: true, render: r => '$' + r.amount.toLocaleString() },
    { key: 'status', label: 'Status', render: r => (
        <span className={`badge ${r.status === 'Paid' ? 'b-status-closed' : r.status === 'Overdue' ? 'b-status-overdue' : 'b-status-pending'}`}>
          {r.status}
        </span>
      ) 
    },
    { key: 'act', label: '', render: r => r.status !== 'Paid' ? (
        <button className="btn btn-secondary btn-sm" onClick={(e) => {
          e.stopPropagation();
          auditAction('BILLING_REMINDER', r.no, 'Sent reminder for ' + r.no);
          addToast('Payment reminder sent to ' + r.tenant, 'success');
        }}>Send reminder</button>
      ) : (
        <button className="btn btn-ghost btn-sm" onClick={(e) => {
          e.stopPropagation();
          addToast('Invoice PDF would download here', 'info');
        }}>PDF</button>
      ) 
    },
  ];

  return (
    <div>
      <div className="page-head">
        <div>
          <div className="page-title">Billing & Usage</div>
          <div className="page-sub">Usage metering and invoicing per tenant and aggregate.</div>
        </div>
        <div className="actions">
          <button className="btn btn-secondary" onClick={handleExport}>Export invoices</button>
        </div>
      </div>

      <div className="grid cols-2 mb16">
        <div className="card">
          <div className="card-head">
            <span className="h3">MRR trend</span>
          </div>
          <div className="card-body" style={{ padding: '24px', textAlign: 'center', color: '#666' }}>
            <div style={{ fontSize: '32px', fontWeight: 'bold', color: 'var(--status-closed)', marginBottom: '8px' }}>$37k</div>
            <div className="caption">Current MRR (Up from $29.8k in Feb)</div>
            {/* Chart placeholder */}
            <div style={{ height: '150px', background: '#f5f5f5', borderRadius: '4px', marginTop: '16px', display: 'flex', alignItems: 'flex-end', padding: '8px', gap: '8px' }}>
              {[29800, 31400, 33600, 35100, 36400, 37000].map((val, i) => (
                <div key={i} style={{ flex: 1, background: 'var(--status-closed)', height: `${(val / 40000) * 100}%`, borderRadius: '2px 2px 0 0' }}></div>
              ))}
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '8px', fontSize: '11px' }}>
              {['Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul'].map(m => <div key={m}>{m}</div>)}
            </div>
          </div>
        </div>

        <div className="card">
          <div className="card-head">
            <span className="h3">Storage consumption by tenant</span>
          </div>
          <div className="card-body" style={{ padding: '20px' }}>
            {tenants?.map((t: any) => {
              const pct = (t.storageGb / t.storageLimit) * 100;
              const isHigh = pct > 85;
              return (
                <div key={t.id} style={{ marginBottom: '12px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px', fontSize: '12px' }}>
                    <span>{t.name}</span>
                    <span>{t.storageGb} GB</span>
                  </div>
                  <div className="pbar" style={{ background: '#eee' }}>
                    <i style={{ width: `${Math.min(pct, 100)}%`, background: isHigh ? 'var(--status-overdue)' : 'var(--brand-primary-light)' }}></i>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      <div className="card">
        <div className="card-head">
          <span className="h3">Invoices — July 2026</span>
        </div>
        <Table cols={cols} rows={invoices} />
      </div>
    </div>
  );
}
