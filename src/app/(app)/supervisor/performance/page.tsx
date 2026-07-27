'use client';

import React, { useEffect } from 'react';
import { useUIStore } from '@/store/useUIStore';
import { exportCsv } from '@/utils/exportCsv';
import { LineChart, Sparkline } from '@/components/ui/Charts';
import { Table, Column } from '@/components/ui/Table';

export default function TeamPerformancePage() {
  const { setPageTitle, addToast } = useUIStore();

  useEffect(() => {
    setPageTitle('Team Performance');
  }, [setPageTitle]);

  const weeks = ['W23', 'W24', 'W25', 'W26', 'W27', 'W28'];
  const perf = [
    { name: 'Chika Okafor', sla: 86, closed: 21, turnaround: 1.8, spark: [8, 11, 9, 12, 10, 12] },
    { name: 'Ngozi Eze', sla: 92, closed: 18, turnaround: 1.5, spark: [7, 8, 9, 8, 10, 9] },
    { name: 'Tunde Balogun', sla: 78, closed: 14, turnaround: 2.6, spark: [6, 7, 5, 8, 6, 7] },
    { name: 'Amara Obi', sla: 81, closed: 9, turnaround: 2.2, spark: [4, 5, 3, 4, 5, 4] },
    { name: 'Seun Adesina', sla: 88, closed: 16, turnaround: 1.9, spark: [7, 6, 8, 9, 8, 8] },
  ];

  const cols: Column<typeof perf[0]>[] = [
    { key: 'name', label: 'Member', render: r => <b>{r.name}</b> },
    { key: 'sla', label: 'SLA %', sortable: true, render: r => <span style={{ color: r.sla >= 85 ? 'var(--status-closed)' : r.sla >= 80 ? 'var(--status-pending)' : 'var(--status-overdue)', fontWeight: 800 }}>{r.sla}%</span> },
    { key: 'closed', label: 'Closed (30d)', sortable: true },
    { key: 'turnaround', label: 'Avg turnaround', sortable: true, render: r => `${r.turnaround} d` },
    { key: 'spark', label: '6-week trend', render: r => <Sparkline values={r.spark} color="var(--brand-primary-light)" /> },
  ];

  return (
    <div>
      <div className="page-head">
        <div>
          <div className="page-title">Team Performance</div>
          <div className="page-sub">Comparative metrics and trends across your team.</div>
        </div>
        <div className="actions">
          <button className="btn btn-secondary" onClick={() => exportCsv('Team_Performance', perf)}>Export CSV</button>
        </div>
      </div>

      <div className="grid cols-3 mb16">
        <div className="card kpi">
          <div className="kv">85%</div>
          <div className="kl">Team SLA compliance</div>
          <div className="kd up">▲ +2.4% vs last period</div>
        </div>
        <div className="card kpi">
          <div className="kv">78</div>
          <div className="kl">Items closed (30d)</div>
          <div className="kd up">▲ +11 vs last period</div>
        </div>
        <div className="card kpi">
          <div className="kv">2.0 d</div>
          <div className="kl">Avg turnaround</div>
          <div className="kd down">▼ +0.2 d slower</div>
        </div>
      </div>

      <div className="card mb16">
        <div className="card-head">
          <span className="h3">Weekly closures — team</span>
        </div>
        <div className="card-body">
          <LineChart 
            labels={weeks} 
            series={[
              { name: 'Closed', color: 'var(--status-closed)', values: [30, 34, 31, 39, 37, 41] },
              { name: 'New inflow', color: 'var(--status-pending)', values: [33, 35, 34, 41, 38, 40] }
            ]} 
          />
        </div>
      </div>

      <div className="card">
        <div className="card-head">
          <span className="h3">Member comparison</span>
        </div>
        <Table cols={cols} rows={perf} />
      </div>
    </div>
  );
}
