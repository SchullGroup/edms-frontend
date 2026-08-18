'use client';

import React, { useEffect } from 'react';
import { useStore } from '@/store/useStore';
import { useUIStore } from '@/store/useUIStore';
import { useDocuments } from '@/apis/hooks/useDocuments';
import { useTasks } from '@/apis/hooks/useTasks';
import { exportCsv } from '@/utils/exportCsv';
import { effStatus } from '@/utils/helpers';
import { LineChart, DonutChart } from '@/components/ui/Charts';
import { TaskRow } from '@/components/ui/TaskRow';
import { Icon } from '@/components/ui/Icons';
import { Spinner } from '@/components/common/Spinner';

export default function MyPerformancePage() {
  const { currentUser } = useStore();
  const { setPageTitle, addToast } = useUIStore();

  useEffect(() => {
    setPageTitle('My Performance');
  }, [setPageTitle]);

  const { data: documentsData, isLoading: docsLoading } = useDocuments({ assignee: currentUser?.id });
  const { data: tasksData, isLoading: tasksLoading } = useTasks({ scope: 'mine' });

  if (!currentUser) return null;

  const documents = documentsData?.data || [];
  const tasks = tasksData?.data || [];
  
  const mine = documents;
  const closed = mine.filter((d: any) => d.status === 'closed');
  
  // Dynamic SLA calculations
  const closedTasks = tasks.filter((t: any) => t.status === 'completed');
  let onTime = 0;
  let breached = 0;
  
  closedTasks.forEach((t: any) => {
    if (t.dueAt && t.completedAt && new Date(t.completedAt) > new Date(t.dueAt)) {
      breached++;
    } else {
      onTime++;
    }
  });
  
  const totalSla = onTime + breached;
  const slaCompliance = totalSla === 0 ? 100 : Math.round((onTime / totalSla) * 100);
  
  // Dynamic throughput calculation (last 6 weeks)
  const getWeekLabel = (d: Date) => {
    const oneJan = new Date(d.getFullYear(), 0, 1);
    const numberOfDays = Math.floor((d.getTime() - oneJan.getTime()) / (24 * 60 * 60 * 1000));
    return `W${Math.ceil((d.getDay() + 1 + numberOfDays) / 7)}`;
  };

  const weekLabels: string[] = [];
  const assignedVals: number[] = [0, 0, 0, 0, 0, 0];
  const completedVals: number[] = [0, 0, 0, 0, 0, 0];
  
  const now = new Date();
  for (let i = 5; i >= 0; i--) {
    const d = new Date(now);
    d.setDate(d.getDate() - (i * 7));
    weekLabels.push(getWeekLabel(d));
  }

  tasks.forEach((t: any) => {
    if (t.createdAt) {
      const wk = getWeekLabel(new Date(t.createdAt));
      const idx = weekLabels.indexOf(wk);
      if (idx !== -1) assignedVals[idx]++;
    }
    if (t.status === 'completed' && t.completedAt) {
      const wk = getWeekLabel(new Date(t.completedAt));
      const idx = weekLabels.indexOf(wk);
      if (idx !== -1) completedVals[idx]++;
    }
  });

  const metrics = [
    { value: `${slaCompliance}%`, label: 'SLA compliance', delta: 'vs last period', dir: 'up' },
    { value: '1.8 d', label: 'Avg turnaround', delta: '-0.4 d vs last period', dir: 'up' },
    {
      value: String(closed.length),
      label: 'Items closed',
      delta: 'Lifetime',
      dir: 'up',
    },
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

      {docsLoading || tasksLoading ? (
        <div style={{ padding: '32px' }}>
          <Spinner text="Loading performance data..." />
        </div>
      ) : (
        <>
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
                  labels={weekLabels}
                  series={[
                    {
                      name: 'Assigned',
                      color: 'var(--status-pending)',
                      values: assignedVals,
                    },
                    {
                      name: 'Completed',
                      color: 'var(--status-closed)',
                      values: completedVals,
                    },
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
                  <DonutChart
                    value={slaCompliance}
                    label="This period"
                    color="var(--status-closed)"
                    size={130}
                  />
                  <div style={{ flex: 1 }}>
                    <div className="metric-li">
                      <span>On time</span>
                      <b>{onTime} items</b>
                    </div>
                    <div className="metric-li">
                      <span>Breached</span>
                      <b style={{ color: 'var(--status-overdue)' }}>{breached} items</b>
                    </div>
                    <div className="metric-li">
                      <span>At risk now</span>
                      <b style={{ color: 'var(--status-pending)' }}>
                        {tasks.filter((t: any) => t.status !== 'completed' && effStatus(t) === 'Overdue').length} items
                      </b>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="card">
            <div className="card-head">
              <span className="h3">Recently closed — drill-down</span>
              <button
                className="btn btn-secondary btn-sm"
                onClick={() => exportCsv('My_Performance_Closed', closed)}
              >
                Export
              </button>
            </div>
            {closed.length > 0 ? (
              <div className="rowlist">
                {closed.map((d: any) => (
                  <TaskRow key={d.id} item={d} />
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
        </>
      )}
    </div>
  );
}
