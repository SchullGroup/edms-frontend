'use client';

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useUIStore } from '@/store/useUIStore';
import { Icon } from '@/components/ui/Icons';
import { Table, Column } from '@/components/ui/Table';

const MOCK_TENANTS = [
  { id: 't-1', name: 'First Atlantic Bank', domain: 'firstatlantic.schulltech.app', model: 'Subscription', plan: 'Enterprise', status: 'Active', users: 1250, storageGb: 812, storageLimit: 1000, health: 'ok', since: '2022-04', mrr: 12500 },
  { id: 't-2', name: 'Emerald Trust', domain: 'emerald.schulltech.app', model: 'White-label', plan: 'Enterprise', status: 'Active', users: 480, storageGb: 215, storageLimit: 500, health: 'ok', since: '2023-11', mrr: 8400 },
  { id: 't-3', name: 'Crimson Capital', domain: 'crimson.schulltech.app', model: 'Subscription', plan: 'Business', status: 'Active', users: 120, storageGb: 95, storageLimit: 100, health: 'warn', since: '2024-02', mrr: 2900 },
  { id: 't-4', name: 'Acme Corp', domain: 'acme.schulltech.app', model: 'Subscription', plan: 'Trial', status: 'Suspended', users: 5, storageGb: 1, storageLimit: 10, health: 'down', since: '2026-06', mrr: 0 },
];

export default function PlatformDashboard() {
  const router = useRouter();
  const { setPageTitle, openModal, closeModal } = useUIStore();
  const [tenants, setTenants] = useState(MOCK_TENANTS);

  useEffect(() => {
    setPageTitle('Tenant Directory');
  }, [setPageTitle]);

  const handleRowClick = (t: any) => {
    // Drawer implementation deferred
    openModal({
      title: t.name,
      body: (
        <div>
          <div className="flex g8 wrap mb16">
            <span className={`badge ${t.status === 'Active' ? 'b-status-closed' : t.status === 'Suspended' ? 'b-status-overdue' : 'b-status-pending'}`}>{t.status}</span>
            <span className="badge b-urg-normal">{t.model}</span>
            <span className="badge b-urg-low">{t.plan} plan</span>
          </div>
          <p>Domain: {t.domain}</p>
          <p>Users: {t.users}</p>
          <p>Storage: {t.storageGb} GB / {t.storageLimit} GB</p>
        </div>
      ),
      actions: [{ label: 'Close', kind: 'btn-secondary' }]
    });
  };

  const cols: Column<any>[] = [
    {
      key: 'name', label: 'Tenant', sortable: true, render: (t) => (
        <span>
          <b>{t.name}</b>
          <div className="caption">{t.domain}</div>
        </span>
      )
    },
    { key: 'model', label: 'Model' },
    { key: 'plan', label: 'Plan' },
    {
      key: 'status', label: 'Status', render: (t) => (
        <span className={`badge ${t.status === 'Active' ? 'b-status-closed' : t.status === 'Suspended' ? 'b-status-overdue' : 'b-status-pending'}`}>
          {t.status}
        </span>
      )
    },
    { key: 'users', label: 'Users', num: true, sortable: true, render: (t) => t.users.toLocaleString() },
    {
      key: 'storageGb', label: 'Storage', render: (t) => {
        const pct = Math.round(t.storageGb / t.storageLimit * 100);
        return (
          <div style={{ minWidth: '110px' }}>
            <div className={`pbar ${pct > 85 ? 'crit' : pct > 70 ? 'warn' : 'ok'}`}>
              <i style={{ width: `${pct}%` }}></i>
            </div>
            <div className="caption" style={{ marginTop: '3px' }}>{pct}%</div>
          </div>
        );
      }
    },
    {
      key: 'health', label: 'Health', render: (t) => (
        <span className={`health ${t.health}`}>
          <span className="hd"></span>{t.health.toUpperCase()}
        </span>
      )
    }
  ];

  const provisionModal = () => {
    alert('Provision tenant modal (Not implemented)');
  };

  return (
    <div>
      <div className="page-head">
        <div>
          <div className="page-title">Tenant Directory</div>
          <div className="page-sub">All tenants with status, plan, usage and health. Click a row for detail.</div>
        </div>
        <div className="actions">
          <button className="btn btn-primary" onClick={provisionModal}>
            <Icon name="plus" size={15} /> Provision tenant
          </button>
        </div>
      </div>

      <div className="grid cols-4 mb16">
        <div className="card kpi">
          <div className="kv">{tenants.length}</div>
          <div className="kl">Tenants</div>
        </div>
        <div className="card kpi">
          <div className="kv">{tenants.filter(t => t.status === 'Active').length}</div>
          <div className="kl">Active</div>
        </div>
        <div className="card kpi">
          <div className="kv">{tenants.reduce((a, t) => a + t.users, 0).toLocaleString()}</div>
          <div className="kl">Total seats</div>
        </div>
        <div className="card kpi">
          <div className="kv">${tenants.reduce((a, t) => a + t.mrr, 0).toLocaleString()}</div>
          <div className="kl">MRR</div>
        </div>
      </div>

      <div className="card">
        <Table cols={cols as any} rows={tenants} onRow={handleRowClick} />
      </div>
    </div>
  );
}
