'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { useQueries } from '@tanstack/react-query';
import { useUIStore } from '@/store/useUIStore';
import { useDepartments } from '@/apis/hooks/useDepartments';
import { useDocumentStats } from '@/apis/hooks/useDocuments';
import { useTaskStats } from '@/apis/hooks/useTasks';
import { workflowInstancesService } from '@/apis/services/workflowInstances.service';
import { HBarChart, LineChart } from '@/components/ui/Charts';
import { Spinner } from '@/components/common/Spinner';
import {
  buildDepartmentIndex,
  alignMonthlyBuckets,
  lastNMonths,
} from '@/apis/utils/managementAggregation';

const LINE_COLORS = [
  'var(--brand-primary-light)',
  'var(--status-closed)',
  'var(--brand-accent)',
  'var(--status-pending)',
  '#6B5CA5',
];

export default function DeptComparisonPage() {
  const { setPageTitle } = useUIStore();
  const [dept, setDept] = useState('All');
  const [range, setRange] = useState(7);

  useEffect(() => {
    setPageTitle('Department Comparison');
  }, [setPageTitle]);

  const { data: departmentsRes, isLoading: loadingDepts } = useDepartments();
  const departments = departmentsRes?.data ?? [];
  const departmentIndex = useMemo(() => buildDepartmentIndex(departments), [departments]);
  const deptOptions = useMemo(() => Array.from(departmentIndex.values()), [departmentIndex]);

  const scope = dept === 'All' ? deptOptions : deptOptions.filter((d) => d.id === dept);
  const windowStart = useMemo(() => lastNMonths(range)[0].start.toISOString(), [range]);

  // Volume (period total) and SLA are both one GROUP BY across every
  // department at once — no per-department call needed for either.
  const { data: deptDocStats, isLoading: loadingVolume } = useDocumentStats({
    groupBy: 'department',
    from: windowStart,
  });
  const { data: taskStats, isLoading: loadingSla } = useTaskStats({ groupBy: 'department' });

  const volumeByDept = useMemo(
    () => new Map((deptDocStats?.buckets ?? []).map((b) => [b.departmentId ?? 'unassigned', b.count])),
    [deptDocStats],
  );
  const slaByDept = useMemo(
    () => new Map((taskStats?.buckets ?? []).map((b) => [b.departmentId ?? 'unassigned', b.slaRate])),
    [taskStats],
  );

  // The monthly closure trend needs one time series *per department shown*,
  // which `GET /workflow-instances/stats` only gives one department at a
  // time — hence `useQueries` over the departments in scope, rather than a
  // hook call per department (hooks can't be called in a loop).
  const closedByDeptQueries = useQueries({
    queries: scope.map((d) => ({
      queryKey: ['workflowInstances', 'stats', { departmentId: d.id }],
      queryFn: () => workflowInstancesService.getStats({ departmentId: d.id }),
    })),
  });

  const isLoading =
    loadingDepts || loadingVolume || loadingSla || closedByDeptQueries.some((q) => q.isLoading);

  const volumeItems = scope.map((d) => ({
    label: d.name,
    value: volumeByDept.get(d.id) ?? 0,
    color: 'var(--brand-primary-light)',
  }));

  const slaItems = scope.map((d) => {
    const sla = Math.round(slaByDept.get(d.id) ?? 100);
    return { label: d.name, value: sla, color: sla >= 85 ? 'var(--status-closed)' : 'var(--status-overdue)' };
  });

  const lineLabels = lastNMonths(range).map((m) => m.label);
  const lineSeries = scope.map((d, i) => ({
    name: d.name,
    color: LINE_COLORS[i % LINE_COLORS.length],
    values: alignMonthlyBuckets(closedByDeptQueries[i]?.data?.buckets ?? [], range).values,
  }));

  if (isLoading) return <Spinner />;

  return (
    <div>
      <div className="page-head">
        <div>
          <div className="page-title">Department Comparison</div>
          <div className="page-sub">Volumes and SLA compliance, side by side.</div>
        </div>
        <div className="actions">
          <div className="flex gap-2 flex-wrap">
            <select
              className="input"
              style={{ width: 'auto', height: '32px' }}
              aria-label="Department filter"
              value={dept}
              onChange={(e) => setDept(e.target.value)}
            >
              <option value="All">All departments</option>
              {deptOptions.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.name}
                </option>
              ))}
            </select>
            <select
              className="input"
              style={{ width: 'auto', height: '32px' }}
              aria-label="Time range"
              value={range}
              onChange={(e) => setRange(Number(e.target.value))}
            >
              <option value={7}>Last 7 months</option>
              <option value={3}>Last 3 months</option>
              <option value={1}>This month</option>
            </select>
          </div>
        </div>
      </div>

      {deptOptions.length === 0 ? (
        <div className="card card-pad">
          <p className="muted">No departments yet.</p>
        </div>
      ) : (
        <>
          <div className="grid cols-2 mb-4">
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
              <LineChart labels={lineLabels} series={lineSeries} />
            </div>
          </div>
        </>
      )}
    </div>
  );
}
