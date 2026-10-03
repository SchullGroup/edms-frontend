'use client';

import React, { useEffect, useMemo } from 'react';
import { useUIStore } from '@/store/useUIStore';
import { useTaskStats } from '@/apis/hooks/useTasks';
import { DonutChart } from '@/components/ui/Charts';
import { Spinner } from '@/components/common/Spinner';

export default function PerformanceOverviewPage() {
  const { setPageTitle } = useUIStore();

  useEffect(() => {
    setPageTitle('Performance Overview');
  }, [setPageTitle]);

  // Server-computed SLA rollup by department (`GET /tasks/stats`) — the org
  // figure is derived by summing its buckets rather than walking every task.
  const { data: stats, isLoading } = useTaskStats();
  const buckets = stats?.buckets ?? [];

  const orgSla = useMemo(() => {
    const totals = buckets.reduce(
      (acc, b) => ({ total: acc.total + b.total, onTime: acc.onTime + b.onTime }),
      { total: 0, onTime: 0 },
    );
    return totals.total === 0 ? 100 : Math.round((totals.onTime / totals.total) * 100);
  }, [buckets]);

  if (isLoading) return <Spinner />;

  return (
    <div>
      <div className="page-head">
        <div>
          <div className="page-title">Performance Overview</div>
          <div className="page-sub">Org-wide SLA performance across all tasks.</div>
        </div>
      </div>

      <div className="grid cols-3 mb-4">
        <div className="card card-pad" style={{ textAlign: 'center' }}>
          <DonutChart value={orgSla} label="Org SLA" size={120} color="var(--status-closed)" />
        </div>
      </div>

      {buckets.length > 0 ? (
        <div className="card">
          <div className="card-head">
            <span className="h3">SLA by department</span>
            <span className="caption">Server-computed · GET /tasks/stats</span>
          </div>
          <div className="tbl-wrap">
            <table className="tbl">
              <thead>
                <tr>
                  <th>Department</th>
                  <th>Completed</th>
                  <th>On time</th>
                  <th>Overdue</th>
                  <th>SLA rate</th>
                </tr>
              </thead>
              <tbody>
                {buckets.map((b, i) => (
                  <tr key={b.departmentId ?? `d-${i}`}>
                    <td>{b.departmentName || b.departmentId || 'Unassigned'}</td>
                    <td>{b.total}</td>
                    <td>{b.onTime}</td>
                    <td>{b.overdue}</td>
                    <td>{Math.round(b.slaRate)}%</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        <div className="banner info">
          Team-level breakdowns and additional performance indicators are pending backend support
          for a team/supervisor structure — not yet in Phase 1 of the PRD.
        </div>
      )}
    </div>
  );
}
