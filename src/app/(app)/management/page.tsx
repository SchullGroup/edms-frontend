'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useUIStore } from '@/store/useUIStore';
import { useDepartments } from '@/apis/hooks/useDepartments';
import { useDocumentStats } from '@/apis/hooks/useDocuments';
import { useTaskStats } from '@/apis/hooks/useTasks';
import {
  useOpenItemsByCabinet,
  useWorkflowInstanceStats,
} from '@/apis/hooks/useWorkflowInstances';
import { exportCsv } from '@/utils/exportCsv';
import { HBarChart, LineChart } from '@/components/ui/Charts';
import { Table, Column } from '@/components/ui/Table';
import { Spinner } from '@/components/common/Spinner';
import {
  buildDepartmentIndex,
  departmentName,
  alignMonthlyBuckets,
  lastNMonths,
} from '@/apis/utils/managementAggregation';

interface DeptRow {
  deptId: string;
  dept: string;
  pending: number;
  progress: number;
  closed: number;
  sla: number;
}

export default function ManagementDashboard() {
  const router = useRouter();
  const { setPageTitle } = useUIStore();

  const [st, setSt] = useState({ dept: 'All', range: 7 });

  useEffect(() => {
    setPageTitle('Organization Overview');
  }, [setPageTitle]);

  const { data: departmentsRes, isLoading: loadingDepts } = useDepartments();
  const departments = departmentsRes?.data ?? [];
  const departmentIndex = useMemo(() => buildDepartmentIndex(departments), [departments]);
  const deptOptions = useMemo(() => Array.from(departmentIndex.values()), [departmentIndex]);

  const scopedDept = st.dept === 'All' ? undefined : st.dept;
  const windowStart = useMemo(() => lastNMonths(st.range)[0].start.toISOString(), [st.range]);

  // Everything below is one GROUP BY each — no walking the full document/task/
  // instance list client-side (see DRIFT-07).
  const { data: docStats, isLoading: loadingDocMonth } = useDocumentStats({
    groupBy: 'month',
    departmentId: scopedDept,
    from: windowStart,
  });
  const { data: wfStats, isLoading: loadingWf } = useWorkflowInstanceStats({
    departmentId: scopedDept,
  });
  const { data: deptDocStats, isLoading: loadingDeptDocs } = useDocumentStats({
    groupBy: 'department',
  });
  const { data: taskStats, isLoading: loadingTaskStats } = useTaskStats({ groupBy: 'department' });
  const { data: openItems, isLoading: loadingOpenItems } = useOpenItemsByCabinet();

  const isLoading =
    loadingDepts || loadingDocMonth || loadingWf || loadingDeptDocs || loadingTaskStats ||
    loadingOpenItems;

  const inflow = useMemo(
    () => alignMonthlyBuckets(docStats?.buckets ?? [], st.range),
    [docStats, st.range],
  );
  const closed = useMemo(
    () => alignMonthlyBuckets(wfStats?.buckets ?? [], st.range),
    [wfStats, st.range],
  );

  const totFiles = inflow.values.reduce((a, b) => a + b, 0);
  const totClosed = closed.values.reduce((a, b) => a + b, 0);

  // Pending/in-progress counts per department, rolled up from the per-cabinet
  // open-items read model (it already carries `departmentId`/`departmentName`).
  const openByDept = useMemo(() => {
    const map = new Map<string, { pending: number; progress: number }>();
    for (const c of openItems?.cabinets ?? []) {
      const key = c.departmentId ?? 'unassigned';
      const cur = map.get(key) ?? { pending: 0, progress: 0 };
      cur.pending += c.pending;
      cur.progress += c.inProgress;
      map.set(key, cur);
    }
    return map;
  }, [openItems]);

  const totalDocsByDept = useMemo(
    () => new Map((deptDocStats?.buckets ?? []).map((b) => [b.departmentId ?? 'unassigned', b.count])),
    [deptDocStats],
  );

  const slaByDept = useMemo(
    () => new Map((taskStats?.buckets ?? []).map((b) => [b.departmentId ?? 'unassigned', b.slaRate])),
    [taskStats],
  );

  const slaTotals = (taskStats?.buckets ?? []).reduce(
    (acc, b) => ({ total: acc.total + b.total, onTime: acc.onTime + b.onTime }),
    { total: 0, onTime: 0 },
  );
  const orgSlaRate = slaTotals.total === 0 ? 100 : Math.round((slaTotals.onTime / slaTotals.total) * 100);
  const slaRate = scopedDept
    ? Math.round(slaByDept.get(scopedDept) ?? 100)
    : orgSlaRate;

  const avgTurnaroundDays = wfStats?.avgTurnaroundDays ?? null;

  const kpis = [
    { v: totFiles.toLocaleString(), l: 'Total files (period)', to: '/management/trends' },
    { v: totClosed.toLocaleString(), l: 'Closed (period)', to: '/management/trends' },
    {
      v: avgTurnaroundDays !== null ? `${avgTurnaroundDays.toFixed(1)} d` : '—',
      l: 'Avg turnaround',
      to: '/management/performance',
    },
    { v: `${slaRate}%`, l: 'SLA compliance', to: '/management/departments' },
  ];

  // Iterate the real department list (not the stats buckets) so a department
  // with zero documents this period still gets a row.
  const rows: DeptRow[] = deptOptions
    .filter((d) => !scopedDept || d.id === scopedDept)
    .map((d) => {
      const totalDocs = totalDocsByDept.get(d.id) ?? 0;
      const open = openByDept.get(d.id) ?? { pending: 0, progress: 0 };
      return {
        deptId: d.id,
        dept: d.name,
        pending: open.pending,
        progress: open.progress,
        // Approximate: total documents minus what's still open. Nothing in the
        // backend's aggregate endpoints cross-tabs department x status, so this
        // trades a small margin of error (e.g. archived docs) for not walking
        // every document to get an exact count.
        closed: Math.max(0, totalDocs - open.pending - open.progress),
        sla: Math.round(slaByDept.get(d.id) ?? 100),
      };
    });

  const cols: Column<DeptRow>[] = [
    { key: 'dept', label: 'Department', render: (r) => <b>{r.dept}</b> },
    { key: 'pending', label: 'Pending', num: true, sortable: true },
    { key: 'progress', label: 'In Progress', num: true, sortable: true },
    { key: 'closed', label: 'Closed', num: true, sortable: true },
    {
      key: 'sla',
      label: 'SLA %',
      num: true,
      sortable: true,
      render: (r) => (
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
  ];

  if (isLoading) return <Spinner />;

  return (
    <div>
      <div className="page-head">
        <div>
          <div className="page-title">Organization Overview</div>
          <div className="page-sub">
            Org-wide throughput and SLA posture — click any widget to drill down.
          </div>
        </div>
        <div className="actions">
          <div className="flex gap-2 flex-wrap">
            <select
              className="input"
              style={{ width: 'auto', height: '32px' }}
              aria-label="Department filter"
              value={st.dept}
              onChange={(e) => setSt({ ...st, dept: e.target.value })}
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

      <div className="grid cols-4 mb-4">
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
          </div>
        ))}
      </div>

      <div className="grid cols-2 mb-4">
        <div className="card">
          <div className="card-head">
            <span className="h3">Inflow vs closure</span>
            <span className="caption">
              {st.dept === 'All' ? 'All departments' : departmentName(st.dept, departmentIndex)}
            </span>
          </div>
          <div className="card-body">
            <LineChart
              labels={inflow.labels}
              series={[
                { name: 'Inflow', color: 'var(--status-pending)', values: inflow.values },
                { name: 'Closed', color: 'var(--status-closed)', values: closed.values },
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
            {rows.length > 0 ? (
              <HBarChart
                items={rows.map((r) => ({
                  label: r.dept,
                  value: r.sla,
                  color:
                    r.sla >= 85
                      ? 'var(--status-closed)'
                      : r.sla >= 80
                        ? 'var(--status-pending)'
                        : 'var(--status-overdue)',
                  onClick: () => router.push('/management/departments'),
                }))}
                max={100}
                unit="%"
              />
            ) : (
              <p className="muted">No departments yet.</p>
            )}
          </div>
        </div>
      </div>

      <div className="card">
        <div className="card-head">
          <span className="h3">Department drill-down</span>
          <button
            className="btn btn-secondary btn-sm"
            onClick={() => exportCsv('Organization_Overview_Departments', rows)}
          >
            Export
          </button>
        </div>
        <Table cols={cols} rows={rows} onRow={() => router.push('/management/departments')} />
      </div>
    </div>
  );
}
