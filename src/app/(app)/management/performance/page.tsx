'use client';

import React, { useEffect } from 'react';
import { useUIStore } from '@/store/useUIStore';
import { useAllTasks } from '@/apis/hooks/useTasks';
import { DonutChart } from '@/components/ui/Charts';
import { Spinner } from '@/components/common/Spinner';
import { taskSlaRate } from '@/apis/utils/managementAggregation';

export default function PerformanceOverviewPage() {
  const { setPageTitle } = useUIStore();

  useEffect(() => {
    setPageTitle('Performance Overview');
  }, [setPageTitle]);

  const { data: tasksPage, isLoading } = useAllTasks();
  const orgSla = taskSlaRate(tasksPage?.items ?? []);

  if (isLoading) return <Spinner />;

  return (
    <div>
      <div className="page-head">
        <div>
          <div className="page-title">Performance Overview</div>
          <div className="page-sub">Org-wide SLA performance across all tasks.</div>
        </div>
      </div>

      <div className="grid cols-3 mb16">
        <div className="card card-pad" style={{ textAlign: 'center' }}>
          <DonutChart value={orgSla} label="Org SLA" size={120} color="var(--status-closed)" />
        </div>
      </div>

      <div className="banner info">
        Team-level breakdowns and additional performance indicators are pending backend support for
        a team/supervisor structure — not yet in Phase 1 of the PRD.
      </div>
    </div>
  );
}
