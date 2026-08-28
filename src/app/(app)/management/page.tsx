'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useUIStore } from '@/store/useUIStore';
import { useDepartments } from '@/apis/hooks/useDepartments';
import { useCabinets } from '@/apis/hooks/useCabinets';
import { useAllDocuments } from '@/apis/hooks/useDocuments';
import { useAllTasks } from '@/apis/hooks/useTasks';
import { useAllWorkflowInstances } from '@/apis/hooks/useWorkflowInstances';
import { exportCsv } from '@/utils/exportCsv';
import { HBarChart, LineChart } from '@/components/ui/Charts';
import { Table, Column } from '@/components/ui/Table';
import { Spinner } from '@/components/common/Spinner';
import {
  buildDepartmentIndex,
  buildCabinetDepartmentIndex,
  documentDepartmentId,
  taskDepartmentId,
  departmentName,
  bucketByMonth,
  taskSlaRate,
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
  const { data: cabinetsRes, isLoading: loadingCabinets } = useCabinets();
  const { data: documents = [], isLoading: loadingDocs } = useAllDocuments();
  const { data: tasksPage, isLoading: loadingTasks } = useAllTasks();
  const { data: instances = [], isLoading: loadingInstances } = useAllWorkflowInstances();

  const departments = departmentsRes?.data ?? [];
  const cabinets = cabinetsRes?.data ?? [];
  const tasks = tasksPage?.items ?? [];

  const isLoading =
    loadingDepts || loadingCabinets || loadingDocs || loadingTasks || loadingInstances;

  const departmentIndex = useMemo(() => buildDepartmentIndex(departments), [departments]);
  const cabinetIndex = useMemo(() => buildCabinetDepartmentIndex(cabinets), [cabinets]);
  const deptOptions = useMemo(() => Array.from(departmentIndex.values()), [departmentIndex]);

  const scopedDept = st.dept === 'All' ? null : st.dept;
  const inScope = (deptId: string | null) => !scopedDept || deptId === scopedDept;

  const scopedDocuments = useMemo(
    () => documents.filter((d) => inScope(documentDepartmentId(d, cabinetIndex))),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [documents, cabinetIndex, scopedDept],
  );
  const scopedTasks = useMemo(
    () => tasks.filter((t) => inScope(taskDepartmentId(t, cabinetIndex))),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [tasks, cabinetIndex, scopedDept],
  );
  const scopedInstances = useMemo(
    () =>
      instances.filter((wi) => {
        const cabinetId = wi.document?.cabinetId;
        const deptId = cabinetId ? (cabinetIndex.get(cabinetId) ?? null) : null;
        return inScope(deptId);
      }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [instances, cabinetIndex, scopedDept],
  );

  const inflow = bucketByMonth(scopedDocuments, (d) => d.createdAt, st.range);
  const closedInstances = scopedInstances.filter((wi) => wi.closedAt);
  const closed = bucketByMonth(closedInstances, (wi) => wi.closedAt, st.range);

  const totFiles = inflow.values.reduce((a, b) => a + b, 0);
  const totClosed = closed.values.reduce((a, b) => a + b, 0);
  const slaRate = taskSlaRate(scopedTasks);

  const avgTurnaroundDays = useMemo(() => {
    if (closedInstances.length === 0) return null;
    const totalDays = closedInstances.reduce((sum, wi) => {
      const start = new Date(wi.startedAt).getTime();
      const end = new Date(wi.closedAt as string).getTime();
      return sum + (end - start) / 86400000;
    }, 0);
    return totalDays / closedInstances.length;
  }, [closedInstances]);

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

  const rows: DeptRow[] = deptOptions
    .filter((d) => !scopedDept || d.id === scopedDept)
    .map((d) => {
      const deptDocs = documents.filter((doc) => documentDepartmentId(doc, cabinetIndex) === d.id);
      const deptTasks = tasks.filter((t) => taskDepartmentId(t, cabinetIndex) === d.id);
      return {
        deptId: d.id,
        dept: d.name,
        pending: deptDocs.filter((doc) => doc.status === 'pending').length,
        progress: deptDocs.filter((doc) => doc.status === 'in_progress').length,
        closed: deptDocs.filter((doc) => doc.status === 'closed').length,
        sla: taskSlaRate(deptTasks),
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
          <div className="flex g8 wrap">
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

      <div className="grid cols-4 mb16">
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

      <div className="grid cols-2 mb16">
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
