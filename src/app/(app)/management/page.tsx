'use client';

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useUIStore } from '@/store/useUIStore';
import { useStore } from '@/store/useStore';
import { HBarChart, LineChart } from '@/components/ui/Charts';
import { Table } from '@/components/ui/Table';

const DEPTS = ['Operations', 'Finance', 'Legal', 'Procurement', 'Audit & Compliance'];
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul'];

// Deterministic mock org data (per dept per month)
const ORG: Record<string, any> = {
  Operations: {
    inflow: [140, 152, 149, 163, 171, 168, 88],
    closed: [131, 149, 141, 158, 166, 162, 79],
    sla: 87,
    pending: 34,
    progress: 22,
    findings: 1,
  },
  Finance: {
    inflow: [118, 121, 130, 127, 138, 145, 71],
    closed: [112, 118, 124, 121, 130, 139, 66],
    sla: 91,
    pending: 26,
    progress: 17,
    findings: 1,
  },
  Legal: {
    inflow: [42, 45, 39, 51, 48, 53, 24],
    closed: [38, 43, 36, 46, 44, 47, 20],
    sla: 74,
    pending: 12,
    progress: 9,
    findings: 0,
  },
  Procurement: {
    inflow: [66, 71, 74, 69, 82, 88, 41],
    closed: [61, 66, 70, 63, 74, 80, 35],
    sla: 82,
    pending: 18,
    progress: 11,
    findings: 1,
  },
  'Audit & Compliance': {
    inflow: [21, 19, 24, 22, 26, 25, 12],
    closed: [19, 18, 22, 20, 24, 22, 10],
    sla: 95,
    pending: 5,
    progress: 4,
    findings: 0,
  },
};
const sum = (a: number[]) => a.reduce((x, y) => x + y, 0);

export default function ManagementDashboard() {
  const router = useRouter();
  const { setPageTitle } = useUIStore();
  const { findings } = useStore();

  const [st, setSt] = useState({ dept: 'All', range: 7 });

  useEffect(() => {
    setPageTitle('Organization Overview');
  }, [setPageTitle]);

  const depts = st.dept === 'All' ? DEPTS : [st.dept];

  const inflowVals = MONTHS.slice(-st.range).map((_, i) =>
    sum(depts.map((d) => ORG[d].inflow[ORG[d].inflow.length - st.range + i])),
  );
  const closedVals = MONTHS.slice(-st.range).map((_, i) =>
    sum(depts.map((d) => ORG[d].closed[ORG[d].closed.length - st.range + i])),
  );

  const totFiles = sum(inflowVals);
  const totClosed = sum(closedVals);
  const slaAvg = Math.round(depts.reduce((a, d) => a + ORG[d].sla, 0) / depts.length);
  const openFindings = findings.filter((f) => f.status !== 'Closed').length;

  const kpis = [
    {
      v: totFiles.toLocaleString(),
      l: 'Total files (period)',
      d: '+6.2%',
      dir: 'up',
      to: '/management/trends',
    },
    { v: totClosed.toLocaleString(), l: 'Closed', d: '+7.8%', dir: 'up', to: '/management/trends' },
    { v: '2.1 d', l: 'Avg turnaround', d: '-0.3 d', dir: 'up', to: '/management/perfoverview' },
    {
      v: slaAvg + '%',
      l: 'SLA compliance',
      d: slaAvg >= 85 ? '+1.9%' : '-2.1%',
      dir: slaAvg >= 85 ? 'up' : 'down',
      to: '/management/depts',
    },
    {
      v: String(openFindings),
      l: 'Open findings',
      d: openFindings > 2 ? '+1' : '-1',
      dir: openFindings > 2 ? 'down' : 'up',
      to: '/management/compliance',
    },
  ];

  const rows = depts.map((d) => ({
    dept: d,
    pending: ORG[d].pending,
    progress: ORG[d].progress,
    closed: sum(ORG[d].closed.slice(-st.range)),
    sla: ORG[d].sla,
    findings: ORG[d].findings,
  }));

  const cols = [
    { key: 'dept', label: 'Department', render: (r: any) => <b>{r.dept}</b> },
    { key: 'pending', label: 'Pending', num: true, sortable: true },
    { key: 'progress', label: 'In Progress', num: true, sortable: true },
    { key: 'closed', label: 'Closed', num: true, sortable: true },
    {
      key: 'sla',
      label: 'SLA %',
      num: true,
      sortable: true,
      render: (r: any) => (
        <span
          style={{
            fontWeight: 800,
            color: r.sla >= 85 ? 'var(--status-closed)' : 'var(--status-overdue)',
          }}
        >
          {r.sla}%
        </span>
      ),
    },
    { key: 'findings', label: 'Findings', num: true },
  ];

  return (
    <div>
      <div className="page-head">
        <div>
          <div className="page-title">Organization Overview</div>
          <div className="page-sub">
            Org-wide throughput, SLA posture and findings — click any widget to drill down.
          </div>
        </div>
        <div className="actions">
          <div className="flex g8 wrap">
            <select
              className="input"
              style={{ width: 'auto', height: '32px' }}
              aria-label="Department filter"
              value={st.dept}
              onChange={(e) => setSt({ ...st, dept: e.target.value })}
            >
              <option value="All">All departments</option>
              {DEPTS.map((d) => (
                <option key={d} value={d}>
                  {d}
                </option>
              ))}
            </select>
            <select
              className="input"
              style={{ width: 'auto', height: '32px' }}
              aria-label="Time range"
              value={st.range}
              onChange={(e) => setSt({ ...st, range: parseInt(e.target.value, 10) })}
            >
              <option value={7}>Last 7 months</option>
              <option value={3}>Last 3 months</option>
              <option value={1}>This month</option>
            </select>
          </div>
          <button className="btn btn-secondary" onClick={() => router.push('/management/reports')}>
            Reports & export
          </button>
        </div>
      </div>

      <div className="grid cols-5 mb16">
        {kpis.map((k, i) => (
          <div
            key={i}
            className="card kpi"
            role="button"
            tabIndex={0}
            style={{ cursor: 'pointer' }}
            title="Drill down"
            onClick={() => router.push(k.to)}
          >
            <div className="kv">{k.v}</div>
            <div className="kl">{k.l}</div>
            <div className={`kd ${k.dir}`}>
              {k.dir === 'up' ? '▲ ' : '▼ '}
              {k.d}
            </div>
          </div>
        ))}
      </div>

      <div className="grid cols-2 mb16">
        <div className="card">
          <div className="card-head">
            <span className="h3">Inflow vs closure</span>
            <span className="caption">{st.dept === 'All' ? 'All departments' : st.dept}</span>
          </div>
          <div className="card-body">
            <LineChart
              labels={MONTHS.slice(-st.range)}
              series={[
                { name: 'Inflow', color: 'var(--status-pending)', values: inflowVals },
                { name: 'Closed', color: 'var(--status-closed)', values: closedVals },
              ]}
            />
          </div>
        </div>

        <div className="card">
          <div className="card-head">
            <span className="h3">SLA compliance by department</span>
            <span className="caption">Target ≥ 85%</span>
          </div>
          <div className="card-body">
            <HBarChart
              items={depts.map((d) => ({
                label: d,
                value: ORG[d].sla,
                color:
                  ORG[d].sla >= 85
                    ? 'var(--status-closed)'
                    : ORG[d].sla >= 80
                      ? 'var(--status-pending)'
                      : 'var(--status-overdue)',
                onClick: () => router.push('/management/depts'),
              }))}
            />
          </div>
        </div>
      </div>

      <div className="card">
        <div className="card-head">
          <span className="h3">Department drill-down</span>
          <button
            className="btn btn-secondary btn-sm"
            onClick={() => alert('Export to CSV not implemented')}
          >
            Export
          </button>
        </div>
        <Table cols={cols as any} rows={rows} onRow={() => router.push('/management/depts')} />
      </div>
    </div>
  );
}
