'use client';

import React, { useEffect } from 'react';
import { useUIStore } from '@/store/useUIStore';
import { DonutChart, Sparkline } from '@/components/ui/Charts';
import { Table, Column } from '@/components/ui/Table';

export default function PerformanceOverviewPage() {
  const { setPageTitle, addToast } = useUIStore();

  useEffect(() => {
    setPageTitle('Performance Overview');
  }, [setPageTitle]);

  const teams = [
    { team: 'Operations — D. Adeyemi', sla: 85, closed: 78, members: 5, spark: [30, 34, 31, 39, 37, 41] },
    { team: 'Finance — K. Mohammed', sla: 91, closed: 66, members: 4, spark: [24, 26, 25, 28, 27, 29] },
    { team: 'Legal — I. Chukwu', sla: 74, closed: 22, members: 3, spark: [8, 9, 7, 10, 9, 8] },
    { team: 'Procurement — F. Bello', sla: 82, closed: 41, members: 3, spark: [14, 15, 13, 17, 16, 18] },
  ];

  const cols: Column<typeof teams[0]>[] = [
    { key: 'team', label: 'Team / Supervisor', render: r => <b>{r.team}</b> },
    { key: 'members', label: 'Members', sortable: true },
    { key: 'sla', label: 'SLA %', sortable: true, render: r => <span style={{ fontWeight: 800, color: r.sla >= 85 ? 'var(--status-closed)' : r.sla >= 80 ? 'var(--status-pending)' : 'var(--status-overdue)' }}>{r.sla}%</span> },
    { key: 'closed', label: 'Closed (30d)', sortable: true },
    { key: 'spark', label: '6-week closures', render: r => <Sparkline values={r.spark} color="var(--brand-primary-light)" /> },
  ];

  return (
    <div>
      <div className="page-head">
        <div>
          <div className="page-title">Performance Overview</div>
          <div className="page-sub">Team and individual summaries, org-wide.</div>
        </div>
      </div>

      <div className="grid cols-3 mb16">
        <div className="card card-pad" style={{ textAlign: 'center' }}>
          <DonutChart value={85} label="Org SLA" size={120} color="var(--status-closed)" />
        </div>
        <div className="card card-pad" style={{ textAlign: 'center' }}>
          <DonutChart value={62} label="Digitisation progress" size={120} color="var(--brand-primary-light)" />
        </div>
        <div className="card card-pad" style={{ textAlign: 'center' }}>
          <DonutChart value={94} label="Circular acknowledgement" size={120} color="var(--brand-accent)" />
        </div>
      </div>

      <div className="card">
        <div className="card-head">
          <span className="h3">Teams</span>
          <button className="btn btn-secondary btn-sm" onClick={() => addToast('Export not implemented', 'info')}>Export</button>
        </div>
        <Table cols={cols} rows={teams} />
      </div>
    </div>
  );
}
