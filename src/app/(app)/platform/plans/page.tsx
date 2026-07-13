'use client';

import React, { useEffect } from 'react';
import { useStore } from '@/store/useStore';
import { useUIStore } from '@/store/useUIStore';
import { Table, Column } from '@/components/ui/Table';
import { Icon } from '@/components/ui/Icons';

export default function PlansPage() {
  const { plans, tenants, updateTenant, auditAction } = useStore();
  const { setPageTitle, addToast, openModal, closeModal } = useUIStore();

  useEffect(() => {
    setPageTitle('Plans & Entitlements');
  }, [setPageTitle]);

  const handleOverride = (t: any) => {
    let extra = 0;
    openModal({
      title: 'Override — ' + t.name,
      body: (
        <div>
          <div className="field">
            <label>Additional storage (GB)</label>
            <input className="input" type="number" defaultValue={0} min={0} onChange={e => extra = Number(e.target.value)} />
          </div>
          <div className="caption">Overrides are contract-backed and appear on the next invoice.</div>
        </div>
      ),
      actions: [
        { label: 'Cancel' },
        { 
          label: 'Apply override', 
          kind: 'btn-primary', 
          onClick: () => {
            updateTenant(t.id, { storageLimit: t.storageLimit + extra });
            auditAction('ENTITLEMENT_OVERRIDE', t.id, '+' + extra + ' GB for ' + t.name);
            addToast('Override applied', 'success');
            closeModal();
          } 
        }
      ]
    });
  };

  const cols: Column<any>[] = [
    { key: 'name', label: 'Tenant', render: t => <b>{t.name}</b> },
    { 
      key: 'plan', 
      label: 'Plan', 
      render: t => (
        <select 
          className="input" 
          style={{ height: '30px', width: 'auto' }} 
          aria-label={t.name + ' plan'} 
          value={t.plan}
          onChange={(e) => {
            const newPlanName = e.target.value;
            const planObj = plans?.find((p: any) => p.name === newPlanName);
            if (planObj) {
              updateTenant(t.id, { plan: newPlanName, storageLimit: planObj.storageGb });
              auditAction('PLAN_CHANGE', t.id, t.name + ' → ' + newPlanName);
              addToast(t.name + ' moved to ' + newPlanName, 'success');
            }
          }}
        >
          {plans?.map((p: any) => <option key={p.name} value={p.name}>{p.name}</option>)}
        </select>
      ) 
    },
    { key: 'storageLimit', label: 'Storage limit', render: t => t.storageLimit + ' GB' },
    { key: 'ov', label: 'Overrides', render: t => (
        <button className="btn btn-secondary btn-sm" onClick={(e) => { e.stopPropagation(); handleOverride(t); }}>Configure</button>
      ) 
    },
  ];

  return (
    <div>
      <div className="page-head">
        <div>
          <div className="page-title">Plans & Entitlements</div>
          <div className="page-sub">Commercial plans, per-tenant assignments, limits and overrides.</div>
        </div>
      </div>
      
      <div className="grid cols-3 mb16">
        {plans?.map((p: any) => (
          <div key={p.id || p.name} className="card card-pad">
            <div className="h2">{p.name}</div>
            <div style={{ fontSize: '26px', fontWeight: 800, margin: '8px 0' }}>
              ${p.priceMo.toLocaleString()} <span className="caption" style={{ fontWeight: 400 }}> /month</span>
            </div>
            <div className="caption mb8">Up to {p.users.toLocaleString()} users · {p.storageGb} GB storage</div>
            <div className="divider"></div>
            {p.features?.map((f: string, i: number) => (
              <div key={i} className="flex aic g8" style={{ padding: '4px 0', fontSize: '12.5px' }}>
                <span style={{ color: 'var(--status-closed)', display: 'inline-flex' }}><Icon name="check" size={13} /></span> {f}
              </div>
            ))}
            <div className="caption mt16">
              {tenants?.filter((t: any) => t.plan === p.name).length || 0} tenant(s) on this plan
            </div>
          </div>
        ))}
      </div>

      <div className="card">
        <div className="card-head">
          <span className="h3">Per-tenant entitlements & overrides</span>
        </div>
        <Table cols={cols} rows={tenants || []} />
      </div>
    </div>
  );
}
