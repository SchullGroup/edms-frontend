'use client';

import React, { useState, useEffect } from 'react';
import { useStore } from '@/store/useStore';
import { useUIStore } from '@/store/useUIStore';
import { Table, Column } from '@/components/ui/Table';
import { Icon } from '@/components/ui/Icons';

/**
 * Deliberately still `SEED`-backed, unlike `/admin/audit` and `/auditor/trail`
 * (both migrated to the real `GET /audit` trail 2026-09-18). This page's
 * whole premise — browsing audit events *across tenants* — has no backend
 * equivalent: `GET /audit` is scoped to the caller's own tenant with no
 * cross-tenant query, and there is no platform-level multi-tenant API at all
 * in this backend today (nothing in `/platform/*` is real; tenants,
 * provisioning, billing and flags are all fixtures too). Migrating audit
 * alone wouldn't be meaningful without the rest of the platform module
 * having something real to query — that's a materially bigger, separate
 * backend ask, not a "point this hook at a real endpoint" change.
 */
export default function PlatformAuditPage() {
  const { audit, tenants, users } = useStore();
  const { setPageTitle } = useUIStore();

  const [tenantF, setTenantF] = useState('All');

  useEffect(() => {
    setPageTitle('Platform Audit');
  }, [setPageTitle]);

  const rows = (audit || []).filter((a: any) => tenantF === 'All' || a.tenant === tenantF);

  const handleExport = () => {
    const csvContent = [
      ['Timestamp', 'Tenant', 'Action', 'Detail'].join(','),
      ...rows.map((r: any) => [
        new Date(r.at).toISOString(),
        r.tenant,
        r.action,
        `"${r.detail?.replace(/"/g, '""') || ''}"`
      ].join(','))
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = 'platform-audit.csv';
    link.click();
  };

  const cols: Column<any>[] = [
    { key: 'at', label: 'When', sortable: true, render: a => new Date(a.at).toLocaleString() },
    { key: 'tenant', label: 'Tenant', render: a => a.tenant === 'platform' ? (
        <span className="badge b-urg-normal">Platform</span>
      ) : (
        tenants?.find((t: any) => t.id === a.tenant)?.name || a.tenant
      ) 
    },
    { key: 'user', label: 'Actor', render: a => users?.find((u: any) => u.id === a.user)?.name || a.user },
    { key: 'action', label: 'Action', render: a => <span className="kbd">{a.action}</span> },
    { key: 'detail', label: 'Detail', render: a => <span style={{ fontSize: '12px' }}>{a.detail}</span> },
  ];

  return (
    <div>
      <div className="page-head">
        <div>
          <div className="page-title">Platform Audit</div>
          <div className="page-sub">Cross-tenant action log — assist sessions, provisioning, entitlement and flag changes.</div>
        </div>
        <div className="actions">
          <select 
            className="input" 
            style={{ width: 'auto', height: '32px' }} 
            value={tenantF} 
            onChange={e => setTenantF(e.target.value)}
          >
            <option value="All">All tenants</option>
            <option value="platform">Platform actions</option>
            {tenants?.map((t: any) => (
              <option key={t.id} value={t.id}>{t.name}</option>
            ))}
          </select>
        </div>
      </div>

      <div className="banner info">
        <span style={{ display: 'inline-flex', marginRight: '8px' }}><Icon name="shield" size={15} /></span>
        Cross-tenant access is consent-gated. Assist sessions display a persistent banner to tenant users and are dual-logged.
      </div>

      <div className="card">
        <div className="card-head">
          <span className="h3">{rows.length} events across tenants</span>
          <button className="btn btn-secondary btn-sm" onClick={handleExport}>Export</button>
        </div>
        <Table cols={cols} rows={rows} />
      </div>
    </div>
  );
}
