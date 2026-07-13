'use client';

import React, { useEffect } from 'react';
import { useStore } from '@/store/useStore';
import { useUIStore } from '@/store/useUIStore';
import { Table, Column } from '@/components/ui/Table';
import { Icon } from '@/components/ui/Icons';

export default function TenantDirectoryPage() {
  const { tenants, plans, addTenant, updateTenant, auditAction } = useStore();
  const { setPageTitle, openModal, closeModal, openConfirm, addToast } = useUIStore();

  useEffect(() => {
    setPageTitle('Tenant Directory');
  }, [setPageTitle]);

  const handleProvision = () => {
    let name = '';
    let model = 'Subscription';
    let plan = plans?.[0]?.name || '';
    let admin = '';

    openModal({
      title: 'Provision new tenant',
      size: 'lg',
      body: (
        <div>
          <div className="grid cols-2" style={{ gap: '12px' }}>
            <div className="field">
              <label>Tenant name <span className="req">*</span></label>
              <input className="input" placeholder="Organisation name" onChange={e => name = e.target.value} />
            </div>
            <div className="field">
              <label>Commercial model</label>
              <select className="input" defaultValue={model} onChange={e => model = e.target.value}>
                <option value="Subscription">Subscription</option>
                <option value="White-label">White-label</option>
              </select>
            </div>
            <div className="field">
              <label>Plan</label>
              <select className="input" defaultValue={plan} onChange={e => plan = e.target.value}>
                {plans?.map((p: any) => <option key={p.name} value={p.name}>{p.name}</option>)}
              </select>
            </div>
            <div className="field">
              <label>Client administrator <span className="req">*</span></label>
              <input className="input" placeholder="admin@organisation.com" onChange={e => admin = e.target.value} />
            </div>
          </div>
          <div className="banner info">
            An isolated environment is created, usage metering begins immediately, and the administrator receives an invitation to complete branding and configuration.
          </div>
        </div>
      ),
      actions: [
        { label: 'Cancel' },
        {
          label: 'Provision tenant',
          kind: 'btn-primary',
          onClick: () => {
            if (!name.trim() || !admin.trim()) {
              addToast('Tenant name and administrator are required', 'error');
              return;
            }
            const selectedPlan = plans?.find((p: any) => p.name === plan);
            const t = {
              id: 't-' + Date.now(),
              name: name.trim(),
              model,
              plan,
              status: 'Provisioning',
              users: 1,
              storageGb: 0,
              storageLimit: selectedPlan?.storageGb || 100,
              health: 'ok',
              domain: name.trim().toLowerCase().replace(/[^a-z0-9]+/g, '') + '.schulltech.app',
              since: '2026-07',
              mrr: 0,
            };
            addTenant(t);
            auditAction('TENANT_PROVISION', t.id, `Provisioned tenant ${t.name} (${model}, ${plan})`);
            addToast(`Tenant provisioning started — invitation sent to ${admin}`, 'success');
            
            setTimeout(() => {
              updateTenant(t.id, { status: 'Trial' });
            }, 2500);

            closeModal();
          }
        }
      ]
    });
  };

  const openDrawer = (t: any) => {
    const usagePct = Math.round((t.storageGb / t.storageLimit) * 100);
    
    // In our UIStore, we don't have a built-in drawer, but we can use modal as a proxy or just create it
    // For this migration, we map it to modal for simplicity or we can just use the openModal if drawer is missing.
    // Let's use openModal to render the tenant details.
    openModal({
      title: t.name,
      body: (
        <div>
          <div className="flex g8 wrap mb16">
            <span className={`badge ${t.status === 'Active' ? 'b-status-closed' : t.status === 'Suspended' ? 'b-status-overdue' : 'b-status-pending'}`}>{t.status}</span>
            <span className="badge b-urg-normal">{t.model}</span>
            <span className="badge b-urg-low">{t.plan} plan</span>
          </div>
          
          {[
            ['Domain', t.domain],
            ['Customer since', t.since],
            ['Active users', t.users.toLocaleString()],
            ['MRR', t.mrr ? '$' + t.mrr.toLocaleString() : '— (trial)']
          ].map(([k, v]) => (
            <div key={k} className="meta-row">
              <span className="k">{k}</span>
              <span className="v">{v}</span>
            </div>
          ))}

          <div className="h3 mt16 mb8">Storage</div>
          <div className={`pbar ${usagePct > 85 ? 'crit' : usagePct > 70 ? 'warn' : 'ok'}`}>
            <i style={{ width: usagePct + '%' }}></i>
          </div>
          <div className="caption mt8">{t.storageGb} GB of {t.storageLimit} GB ({usagePct}%)</div>

          <div className="h3 mt16 mb8">Health</div>
          <span className={`health ${t.health}`}>
            <span className="hd"></span>
            {t.health === 'ok' ? 'All services nominal' : t.health === 'warn' ? 'Degraded — storage near limit' : 'Suspended / unreachable'}
          </span>
          <div className="divider"></div>
          
          <div className="flex g8 wrap">
            <button className="btn btn-secondary btn-sm" onClick={() => {
              closeModal();
              openConfirm?.({
                title: 'Start assist session for ' + t.name + '?',
                message: 'Cross-tenant assist requires recorded client consent. A persistent banner is shown to all tenant users and every action is written to both audit logs.',
                confirmLabel: 'Start with consent',
                onConfirm: () => {
                  auditAction('ASSIST_START', t.id, 'Started consented assist session for ' + t.name);
                  addToast('Assist session started — banner active, actions audited', 'info');
                }
              });
            }}>Assist (consented)</button>

            {t.status !== 'Suspended' ? (
              <button className="btn btn-danger btn-sm" onClick={() => {
                closeModal();
                openConfirm?.({
                  title: 'Suspend ' + t.name + '?',
                  message: 'All tenant users lose access until reinstated. Data is retained per contract. This is reversible but disruptive.',
                  confirmLabel: 'Suspend tenant',
                  danger: true,
                  onConfirm: () => {
                    updateTenant(t.id, { status: 'Suspended', health: 'down' });
                    auditAction('TENANT_SUSPEND', t.id, 'Suspended ' + t.name);
                    addToast(t.name + ' suspended', 'warning');
                  }
                });
              }}>Suspend</button>
            ) : (
              <button className="btn btn-success btn-sm" onClick={() => {
                closeModal();
                updateTenant(t.id, { status: 'Active', health: 'ok' });
                auditAction('TENANT_REINSTATE', t.id, 'Reinstated ' + t.name);
                addToast(t.name + ' reinstated', 'success');
              }}>Reinstate</button>
            )}
          </div>
        </div>
      ),
      actions: [{ label: 'Close' }]
    });
  };

  const cols: Column<any>[] = [
    { key: 'name', label: 'Tenant', sortable: true, render: t => (
        <span>
          <b>{t.name}</b>
          <div className="caption">{t.domain}</div>
        </span>
      ) 
    },
    { key: 'model', label: 'Model' },
    { key: 'plan', label: 'Plan' },
    { key: 'status', label: 'Status', render: t => (
        <span className={`badge ${t.status === 'Active' ? 'b-status-closed' : t.status === 'Suspended' ? 'b-status-overdue' : 'b-status-pending'}`}>
          {t.status}
        </span>
      ) 
    },
    { key: 'users', label: 'Users', sortable: true, render: t => t.users.toLocaleString() },
    { key: 'storageGb', label: 'Storage', render: t => {
        const pct = Math.round((t.storageGb / t.storageLimit) * 100);
        return (
          <div style={{ minWidth: '110px' }}>
            <div className={`pbar ${pct > 85 ? 'crit' : pct > 70 ? 'warn' : 'ok'}`}>
              <i style={{ width: pct + '%' }}></i>
            </div>
            <div className="caption" style={{ marginTop: '3px' }}>{pct}%</div>
          </div>
        );
      } 
    },
    { key: 'health', label: 'Health', render: t => (
        <span className={`health ${t.health}`}>
          <span className="hd"></span>{t.health.toUpperCase()}
        </span>
      ) 
    },
  ];

  return (
    <div>
      <div className="page-head">
        <div>
          <div className="page-title">Tenant Directory</div>
          <div className="page-sub">All tenants with status, plan, usage and health. Click a row for detail.</div>
        </div>
        <div className="actions">
          <button className="btn btn-primary" onClick={handleProvision}>
            <span style={{ display: 'inline-flex', alignItems: 'center', marginRight: '6px' }}><Icon name="plus" size={15} /></span>
            Provision tenant
          </button>
        </div>
      </div>
      
      <div className="grid cols-4 mb16">
        <div className="card kpi">
          <div className="kv">{tenants?.length || 0}</div>
          <div className="kl">Tenants</div>
        </div>
        <div className="card kpi">
          <div className="kv">{tenants?.filter((t: any) => t.status === 'Active').length || 0}</div>
          <div className="kl">Active</div>
        </div>
        <div className="card kpi">
          <div className="kv">{tenants?.reduce((a: number, t: any) => a + t.users, 0).toLocaleString()}</div>
          <div className="kl">Total seats</div>
        </div>
        <div className="card kpi">
          <div className="kv">${tenants?.reduce((a: number, t: any) => a + t.mrr, 0).toLocaleString()}</div>
          <div className="kl">MRR</div>
        </div>
      </div>

      <div className="card">
        <Table cols={cols} rows={tenants || []} onRow={openDrawer} />
      </div>
    </div>
  );
}
