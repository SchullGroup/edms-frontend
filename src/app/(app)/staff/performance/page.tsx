'use client';

import React, { useEffect } from 'react';
import { useStore, effStatus } from '@/store/useStore';
import { useUIStore } from '@/store/useUIStore';
import { exportCsv } from '@/utils/exportCsv';
import { LineChart, DonutChart } from '@/components/ui/Charts';
import { TaskRow } from '@/components/ui/TaskRow';
import { Icon } from '@/components/ui/Icons';

export default function MyPerformancePage() {
  const { documents, session } = useStore();
  const { setPageTitle, addToast } = useUIStore();

  useEffect(() => {
    setPageTitle('My Performance');
  }, [setPageTitle]);

  const mine = documents.filter(d => d.assignee === session || d.owner === session);
  const closed = mine.filter(d => d.status === 'Closed');
  const weeks = ['W23', 'W24', 'W25', 'W26', 'W27', 'W28'];

  const metrics = [
    { value: '86%', label: 'SLA compliance', delta: '+3.1% vs last period', dir: 'up' },
    { value: '1.8 d', label: 'Avg turnaround', delta: '-0.4 d vs last period', dir: 'up' },
    { value: String(closed.length + 9), label: 'Items closed (30d)', delta: '+5 vs last period', dir: 'up' },
    { value: '4.2%', label: 'Rework rate', delta: '+0.8% vs last period', dir: 'down' },
  ];

  return (
    <div>
      <div className="page-head">
        <div>
          <div className="page-title">My Performance</div>
          <div className="page-sub">Personal metrics with drill-down to the underlying files.</div>
        </div>
      </div>

      <div className="grid cols-4 mb16">
        {metrics.map((m, i) => (
          <div key={i} className="card kpi">
            <div className="kv">{m.value}</div>
            <div className="kl">{m.label}</div>
            <div className={`kd ${m.dir}`}>
              {m.dir === 'up' ? '▲ ' : '▼ '} {m.delta}
            </div>
          </div>
        ))}
      </div>

      <div className="grid cols-2 mb16">
        <div className="card">
          <div className="card-head">
            <span className="h3">Weekly throughput</span>
          </div>
          <div className="card-body">
            <LineChart 
              labels={weeks} 
              series={[
                { name: 'Assigned', color: 'var(--status-pending)', values: [9, 12, 8, 14, 11, 13] },
                { name: 'Completed', color: 'var(--status-closed)', values: [8, 11, 9, 12, 10, 12] }
              ]} 
            />
          </div>
        </div>

        <div className="card">
          <div className="card-head">
            <span className="h3">SLA compliance trend</span>
          </div>
          <div className="card-body">
            <div className="ring-wrap">
              <DonutChart value={86} label="This period" color="var(--status-closed)" size={130} />
              <div style={{ flex: 1 }}>
                <div className="metric-li">
                  <span>On time</span>
                  <b>31 items</b>
                </div>
                <div className="metric-li">
                  <span>Breached</span>
                  <b style={{ color: 'var(--status-overdue)' }}>5 items</b>
                </div>
                <div className="metric-li">
                  <span>At risk now</span>
                  <b style={{ color: 'var(--status-pending)' }}>{mine.filter(d => effStatus(d) === 'Overdue').length} items</b>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="card">
        <div className="card-head">
          <span className="h3">Recently closed — drill-down</span>
          <button className="btn btn-secondary btn-sm" onClick={() => exportCsv('My_Performance_Closed', closed)}>Export</button>
        </div>
        {closed.length > 0 ? (
          <div className="rowlist">
            {closed.map((d: any) => (
              <TaskRow key={d.id} doc={d} />
            ))}
          </div>
        ) : (
          <div className="empty">
            <Icon name="approve" size={32} />
            <div className="h3 mt16 mb8">Nothing closed yet</div>
            <p className="caption mb16">Items you complete will appear here.</p>
          </div>
        )}
      </div>
    </div>
  );
}
