'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { useUIStore } from '@/store/useUIStore';
import { useDepartments } from '@/apis/hooks/useDepartments';
import { useCabinets } from '@/apis/hooks/useCabinets';
import { useAllDocuments } from '@/apis/hooks/useDocuments';
import { useAllTasks } from '@/apis/hooks/useTasks';
import { useAllWorkflowInstances } from '@/apis/hooks/useWorkflowInstances';
import { HBarChart, LineChart } from '@/components/ui/Charts';
import { Spinner } from '@/components/common/Spinner';
import {
  buildDepartmentIndex,
  buildCabinetDepartmentIndex,
  documentDepartmentId,
  taskDepartmentId,
  bucketByMonth,
  taskSlaRate,
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

  const scope = dept === 'All' ? deptOptions : deptOptions.filter((d) => d.id === dept);

  const perDept = useMemo(
    () =>
      scope.map((d) => {
        const deptDocs = documents.filter(
          (doc) => documentDepartmentId(doc, cabinetIndex) === d.id,
        );
        const deptTasks = tasks.filter((t) => taskDepartmentId(t, cabinetIndex) === d.id);
        const deptInstances = instances.filter((wi) => {
          const cabinetId = wi.document?.cabinetId;
          return cabinetId ? cabinetIndex.get(cabinetId) === d.id : false;
        });
        const closedInstances = deptInstances.filter((wi) => wi.closedAt);
        return {
          dept: d,
          volume: bucketByMonth(deptDocs, (doc) => doc.createdAt, range),
          closed: bucketByMonth(closedInstances, (wi) => wi.closedAt, range),
          sla: taskSlaRate(deptTasks),
        };
      }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [scope, documents, tasks, instances, cabinetIndex, range],
  );

  const volumeItems = perDept.map((p) => ({
    label: p.dept.name,
    value: p.volume.values.reduce((a, b) => a + b, 0),
    color: 'var(--brand-primary-light)',
  }));

  const slaItems = perDept.map((p) => ({
    label: p.dept.name,
    value: p.sla,
    color: p.sla >= 85 ? 'var(--status-closed)' : 'var(--status-overdue)',
  }));

  const lineLabels = perDept[0]?.closed.labels ?? bucketByMonth([], () => undefined, range).labels;
  const lineSeries = perDept.map((p, i) => ({
    name: p.dept.name,
    color: LINE_COLORS[i % LINE_COLORS.length],
    values: p.closed.values,
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
          <div className="flex g8 wrap">
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
              <LineChart labels={lineLabels} series={lineSeries} />
            </div>
          </div>
        </>
      )}
    </div>
  );
}
