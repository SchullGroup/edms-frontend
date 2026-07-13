'use client';

import React, { useState, useEffect } from 'react';
import { useUIStore } from '@/store/useUIStore';
import { HBarChart, LineChart } from '@/components/ui/Charts';

const DEPTS = ['Operations', 'Finance', 'Legal', 'Procurement', 'Audit & Compliance'];
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul'];

const ORG: Record<string, any> = {
  'Operations':          { inflow: [140, 152, 149, 163, 171, 168, 88], closed: [131, 149, 141, 158, 166, 162, 79], sla: 87, pending: 34, progress: 22, findings: 1 },
  'Finance':             { inflow: [118, 121, 130, 127, 138, 145, 71], closed: [112, 118, 124, 121, 130, 139, 66], sla: 91, pending: 26, progress: 17, findings: 1 },
  'Legal':               { inflow: [42, 45, 39, 51, 48, 53, 24], closed: [38, 43, 36, 46, 44, 47, 20], sla: 74, pending: 12, progress: 9, findings: 0 },
  'Procurement':         { inflow: [66, 71, 74, 69, 82, 88, 41], closed: [61, 66, 70, 63, 74, 80, 35], sla: 82, pending: 18, progress: 11, findings: 1 },
  'Audit & Compliance':  { inflow: [21, 19, 24, 22, 26, 25, 12], closed: [19, 18, 22, 20, 24, 22, 10], sla: 95, pending: 5, progress: 4, findings: 0 },
};

const sum = (a: number[]) => a.reduce((x, y) => x + y, 0);

export default function DeptComparisonPage() {
  const { setPageTitle } = useUIStore();
  const [dept, setDept] = useState('All');
  const [range, setRange] = useState(7);

  useEffect(() => {
    setPageTitle('Department Comparison');
  }, [setPageTitle]);

  const scope = dept === 'All' ? DEPTS : [dept];

  const series = (key: string) => {
    const full = MONTHS.map((_, i) => sum(scope.map(d => ORG[d][key][i])));
    return { labels: MONTHS.slice(-range), values: full.slice(-range) };
  };

  const volumeItems = scope.map(d => ({ 
    label: d, 
    value: sum(ORG[d].inflow.slice(-range)), 
    color: 'var(--brand-primary-light)' 
  }));

  const slaItems = scope.map(d => ({ 
    label: d, 
    value: ORG[d].sla, 
    color: ORG[d].sla >= 85 ? 'var(--status-closed)' : 'var(--status-overdue)' 
  }));

  const lineSeries = scope.map((d, i) => ({ 
    name: d, 
    color: ['var(--brand-primary-light)', 'var(--status-closed)', 'var(--brand-accent)', 'var(--status-pending)', '#6B5CA5'][i % 5], 
    values: ORG[d].closed.slice(-range) 
  }));

  return (
    <div>
      <div className="page-head">
        <div>
          <div className="page-title">Department Comparison</div>
          <div className="page-sub">Volumes and SLA compliance, side by side.</div>
        </div>
        <div className="actions">
          <div className="flex g8 wrap">
            <select className="input" style={{ width: 'auto', height: '32px' }} aria-label="Department filter" value={dept} onChange={e => setDept(e.target.value)}>
              <option value="All">All departments</option>
              {DEPTS.map(d => <option key={d} value={d}>{d}</option>)}
            </select>
            <select className="input" style={{ width: 'auto', height: '32px' }} aria-label="Time range" value={range} onChange={e => setRange(Number(e.target.value))}>
              <option value={7}>Last 7 months</option>
              <option value={3}>Last 3 months</option>
              <option value={1}>This month</option>
            </select>
          </div>
        </div>
      </div>

      <div className="grid cols-2 mb16">
        <div className="card">
          <div className="card-head">
            <span className="h3">Volume by department (period)</span>
          </div>
          <div className="card-body">
            <HBarChart items={volumeItems} />
          </div>
        </div>
        <div className="card">
          <div className="card-head">
            <span className="h3">SLA by department</span>
          </div>
          <div className="card-body">
            <HBarChart items={slaItems} max={100} unit="%" />
          </div>
        </div>
      </div>

      <div className="card">
        <div className="card-head">
          <span className="h3">Monthly closure trend by department</span>
        </div>
        <div className="card-body">
          <LineChart labels={MONTHS.slice(-range)} series={lineSeries} />
        </div>
      </div>
    </div>
  );
}
