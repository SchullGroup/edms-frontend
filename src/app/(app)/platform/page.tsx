'use client';

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useUIStore } from '@/store/useUIStore';
import { useStore } from '@/store/useStore';
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
  const { setPageTitle, openModal, closeModal, addToast } = useUIStore();
  const { auditAction } = useStore();
  const [tenants, setTenants] = useState(MOCK_TENANTS);

  useEffect(() => {
    setPageTitle('Tenant Directory');
  }, [setPageTitle]);

  const handleRowClick = (t: any) => {
    openModal({
      title: `${t.name} — Tenant Overview`,
      size: 'lg',
      body: (
        <div>
          <div className="flex g8 wrap mb16">
            <span className={`badge ${t.status === 'Active' ? 'b-status-closed' : t.status === 'Suspended' ? 'b-status-overdue' : 'b-status-pending'}`}>{t.status}</span>
            <span className="badge b-urg-normal">{t.model}</span>
            <span className="badge b-urg-low">{t.plan} Plan</span>
            <span className={`health ${t.health}`} style={{ marginLeft: 'auto' }}>
              <span className="hd"></span>Health: {t.health.toUpperCase()}
            </span>
          </div>

          <div className="grid cols-2 gap12 mb16">
            <div className="card card-pad">
              <div className="caption mb4">Domain Endpoint</div>
              <div className="h4">https://{t.domain}</div>
            </div>
            <div className="card card-pad">
              <div className="caption mb4">Monthly Recurring Revenue</div>
              <div className="h4">${t.mrr?.toLocaleString() || 0} / mo</div>
            </div>
          </div>

          <div className="meta-row"><span className="k">Tenant ID</span><span className="v">{t.id}</span></div>
          <div className="meta-row"><span className="k">Provisioned Since</span><span className="v">{t.since}</span></div>
          <div className="meta-row"><span className="k">Active User Seats</span><span className="v">{t.users?.toLocaleString()}</span></div>
          <div className="meta-row"><span className="k">Storage Allocation</span><span className="v">{t.storageGb} GB used of {t.storageLimit} GB limit</span></div>

          <div className="mt16">
            <div className="pbar ok mb8">
              <i style={{ width: `${Math.round((t.storageGb / t.storageLimit) * 100)}%` }}></i>
            </div>
          </div>
        </div>
      ),
      actions: [
        { label: 'Close', kind: 'btn-secondary' },
        {
          label: t.status === 'Active' ? 'Suspend Tenant' : 'Activate Tenant',
          kind: t.status === 'Active' ? 'btn-danger' : 'btn-success',
          onClick: () => {
            const nextStatus = t.status === 'Active' ? 'Suspended' : 'Active';
            setTenants(prev => prev.map(x => x.id === t.id ? { ...x, status: nextStatus } : x));
            auditAction('TENANT_UPDATE', t.id, `Status changed to ${nextStatus}`);
            addToast(`${t.name} is now ${nextStatus}`, 'info');
            closeModal();
          }
        }
      ]
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
    let name = '';
    let domainPrefix = '';
    let model = 'Subscription';
    let plan = 'Business';
    let seats = '50';
    let storage = '500';

    openModal({
      title: 'Provision New Tenant',
      size: 'lg',
      body: (
        <div>
          <div className="field mb12">
            <label>Organization / Tenant Name <span className="req">*</span></label>
            <input className="input" placeholder="e.g. Acme Financial Services" onChange={e => name = e.target.value} />
          </div>
          <div className="field mb12">
            <label>Subdomain Prefix <span className="req">*</span></label>
            <div className="flex aic g8">
              <input className="input" placeholder="acme" style={{ flex: 1 }} onChange={e => domainPrefix = e.target.value} />
              <span className="caption">.schulltech.app</span>
            </div>
          </div>
          <div className="grid cols-2 gap12 mb12">
            <div className="field">
              <label>Deployment Model</label>
              <select className="input" defaultValue={model} onChange={e => model = e.target.value}>
                <option value="Subscription">Subscription</option>
                <option value="White-label">White-label Enterprise</option>
              </select>
            </div>
            <div className="field">
              <label>Tier Plan</label>
              <select className="input" defaultValue={plan} onChange={e => plan = e.target.value}>
                <option value="Trial">Trial</option>
                <option value="Business">Business</option>
                <option value="Enterprise">Enterprise</option>
              </select>
            </div>
          </div>
          <div className="grid cols-2 gap12 mb12">
            <div className="field">
              <label>Initial User Seats</label>
              <input type="number" className="input" defaultValue={seats} onChange={e => seats = e.target.value} />
            </div>
            <div className="field">
              <label>Storage Limit (GB)</label>
              <input type="number" className="input" defaultValue={storage} onChange={e => storage = e.target.value} />
            </div>
          </div>
        </div>
      ),
      actions: [
        { label: 'Cancel' },
        {
          label: 'Provision Tenant',
          kind: 'btn-primary',
          onClick: () => {
            if (!name.trim() || !domainPrefix.trim()) {
              addToast('Tenant name and domain prefix are required', 'error');
              return;
            }
            const newTenant = {
              id: 't-' + (tenants.length + 1),
              name: name.trim(),
              domain: `${domainPrefix.trim().toLowerCase()}.schulltech.app`,
              model,
              plan,
              status: 'Active',
              users: parseInt(seats, 10) || 50,
              storageGb: 0,
              storageLimit: parseInt(storage, 10) || 500,
              health: 'ok',
              since: new Date().toISOString().slice(0, 7),
              mrr: plan === 'Enterprise' ? 12000 : plan === 'Business' ? 3500 : 0,
            };

            setTenants([newTenant, ...tenants]);
            auditAction('TENANT_PROVISION', newTenant.id, `Provisioned ${newTenant.name}`);
            addToast(`Tenant ${newTenant.name} provisioned successfully`, 'success');
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
