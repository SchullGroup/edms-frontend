'use client';

import React, { useState, useEffect } from 'react';
import { useUIStore } from '@/store/useUIStore';
import { LineChart } from '@/components/ui/Charts';
import { Icon } from '@/components/ui/Icons';

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

export default function TrendsForecastPage() {
  const { setPageTitle } = useUIStore();
  const [dept, setDept] = useState('All');
  const [range, setRange] = useState(7);

  useEffect(() => {
    setPageTitle('Trends & Forecast');
  }, [setPageTitle]);

  const scope = dept === 'All' ? DEPTS : [dept];

  const series = (key: string) => {
    const full = MONTHS.map((_, i) => sum(scope.map(d => ORG[d][key][i])));
    return { labels: MONTHS.slice(-range), values: full.slice(-range) };
  };

  const inflow = series('inflow');
  const closed = series('closed');

  const backlog: number[] = [];
  let b = 60;
  inflow.values.forEach((v, i) => { 
    b += v - closed.values[i]; 
    backlog.push(Math.max(0, b)); 
  });

  const lastIn = inflow.values.slice(-3);
  const slope = (lastIn[2] - lastIn[0]) / 2;
  const fIn = [Math.round(lastIn[2] + slope), Math.round(lastIn[2] + slope * 2)];

  return (
    <div>
      <div className="page-head">
        <div>
          <div className="page-title">Trends & Forecast</div>
          <div className="page-sub">Inflow vs closure, backlog and ageing, with a simple forward projection.</div>
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

      <div className="banner info">
        <span style={{ marginRight: '8px' }}><Icon name="trend" size={15} /></span>
        Forecast: inflow trending {slope >= 0 ? 'up' : 'down'} ~{Math.abs(Math.round(slope))} files/month. Projected next two months: {fIn.join(', ')}. Backlog {backlog[backlog.length - 1] > backlog[0] ? 'growing' : 'shrinking'} — currently {backlog[backlog.length - 1]} open items.
      </div>

      <div className="grid cols-2 mb16 mt16">
        <div className="card">
          <div className="card-head">
            <span className="h3">Inflow vs closure + forecast</span>
          </div>
          <div className="card-body">
            <LineChart 
              labels={[...inflow.labels, 'Aug*', 'Sep*']} 
              series={[
                { name: 'Inflow', color: 'var(--status-pending)', values: [...inflow.values, ...fIn] },
                { name: 'Closed', color: 'var(--status-closed)', values: [...closed.values, Math.round(fIn[0] * .96), Math.round(fIn[1] * .96)] }
              ]} 
            />
            <div className="caption mt8">* Forecast (linear projection of last 3 periods). Charts always label ranges; axes never truncated.</div>
          </div>
        </div>
        <div className="card">
          <div className="card-head">
            <span className="h3">Backlog & ageing trend</span>
          </div>
          <div className="card-body">
            <LineChart 
              labels={inflow.labels} 
              series={[
                { name: 'Backlog', color: 'var(--brand-accent)', values: backlog },
                { name: 'Aged > 14d', color: 'var(--status-overdue)', values: backlog.map(x => Math.round(x * .22)) }
              ]} 
            />
          </div>
        </div>
      </div>

      <div className="card">
        <div className="card-head">
          <span className="h3">What’s driving the trend</span>
        </div>
        <div className="card-body">
          <div className="metric-li"><span style={{ lineHeight: 1.5 }}>Procurement inflow up 14% quarter-on-quarter (new threshold matrix drives more approval files).</span></div>
          <div className="metric-li"><span style={{ lineHeight: 1.5 }}>Legal closure rate constrained by external counsel review — average stage time 5.8 days.</span></div>
          <div className="metric-li"><span style={{ lineHeight: 1.5 }}>IDU auto-classification adoption reduced capture time by 38% across Finance.</span></div>
        </div>
      </div>
    </div>
  );
}
