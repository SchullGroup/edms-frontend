'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { useUIStore } from '@/store/useUIStore';
import { useDepartments } from '@/apis/hooks/useDepartments';
import { useDocumentStats } from '@/apis/hooks/useDocuments';
import { useWorkflowInstanceStats } from '@/apis/hooks/useWorkflowInstances';
import { LineChart } from '@/components/ui/Charts';
import { Icon } from '@/components/ui/Icons';
import { Spinner } from '@/components/common/Spinner';
import { buildDepartmentIndex, alignMonthlyBuckets, lastNMonths } from '@/apis/utils/managementAggregation';

export default function TrendsForecastPage() {
  const { setPageTitle } = useUIStore();
  const [dept, setDept] = useState('All');
  const [range, setRange] = useState(7);

  useEffect(() => {
    setPageTitle('Trends & Forecast');
  }, [setPageTitle]);

  const { data: departmentsRes, isLoading: loadingDepts } = useDepartments();
  const departments = departmentsRes?.data ?? [];
  const departmentIndex = useMemo(() => buildDepartmentIndex(departments), [departments]);
  const deptOptions = useMemo(() => Array.from(departmentIndex.values()), [departmentIndex]);

  const scopedDept = dept === 'All' ? undefined : dept;
  // `GET /documents/stats` takes an optional `from` bound; `GET
  // /workflow-instances/stats` doesn't, so its buckets are aligned to the
  // same window client-side by `alignMonthlyBuckets` instead.
  const windowStart = useMemo(() => lastNMonths(range)[0].start.toISOString(), [range]);

  const { data: docStats, isLoading: loadingDocs } = useDocumentStats({
    groupBy: 'month',
    departmentId: scopedDept,
    from: windowStart,
  });
  const { data: wfStats, isLoading: loadingInstances } = useWorkflowInstanceStats({
    departmentId: scopedDept,
  });

  const isLoading = loadingDepts || loadingDocs || loadingInstances;

  const inflow = useMemo(
    () => alignMonthlyBuckets(docStats?.buckets ?? [], range),
    [docStats, range],
  );
  const closed = useMemo(
    () => alignMonthlyBuckets(wfStats?.buckets ?? [], range),
    [wfStats, range],
  );

  const backlog: number[] = [];
  let running = 0;
  inflow.values.forEach((v, i) => {
    running += v - closed.values[i];
    backlog.push(Math.max(0, running));
  });

  const lastIn = inflow.values.slice(-3);
  const slope =
    lastIn.length >= 2 ? (lastIn[lastIn.length - 1] - lastIn[0]) / (lastIn.length - 1) : 0;
  const lastVal = lastIn[lastIn.length - 1] ?? 0;
  const forecastIn = [
    Math.max(0, Math.round(lastVal + slope)),
    Math.max(0, Math.round(lastVal + slope * 2)),
  ];
  const lastClosed = closed.values[closed.values.length - 1] ?? 0;

  if (isLoading) return <Spinner />;

  return (
    <div>
      <div className="page-head">
        <div>
          <div className="page-title">Trends & Forecast</div>
          <div className="page-sub">
            Inflow vs closure, backlog and ageing, with a simple forward projection.
          </div>
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

      <div className="banner info">
        <span style={{ marginRight: '8px' }}>
          <Icon name="trend" size={15} />
        </span>
        Forecast: inflow trending {slope >= 0 ? 'up' : 'down'} ~{Math.abs(Math.round(slope))}{' '}
        files/month. Projected next two months: {forecastIn.join(', ')}. Backlog{' '}
        {backlog[backlog.length - 1] > (backlog[0] ?? 0) ? 'growing' : 'shrinking'} — currently{' '}
        {backlog[backlog.length - 1] ?? 0} open items.
      </div>

      <div className="grid cols-2 mb-4 mt-4">
        <div className="card">
          <div className="card-head">
            <span className="h3">Inflow vs closure + forecast</span>
          </div>
          <div className="card-body">
            <LineChart
              labels={[...inflow.labels, 'Next', 'Next+1']}
              series={[
                {
                  name: 'Inflow',
                  color: 'var(--status-pending)',
                  values: [...inflow.values, ...forecastIn],
                },
                {
                  name: 'Closed',
                  color: 'var(--status-closed)',
                  values: [
                    ...closed.values,
                    Math.round(
                      forecastIn[0] * (lastClosed && lastVal ? lastClosed / lastVal : 0.9),
                    ),
                    Math.round(
                      forecastIn[1] * (lastClosed && lastVal ? lastClosed / lastVal : 0.9),
                    ),
                  ],
                },
              ]}
            />
            <div className="caption mt-2">
              * Forecast (linear projection of last 3 periods). Charts always label ranges; axes
              never truncated.
            </div>
          </div>
        </div>
        <div className="card">
          <div className="card-head">
            <span className="h3">Backlog trend</span>
          </div>
          <div className="card-body">
            <LineChart
              labels={inflow.labels}
              series={[{ name: 'Backlog', color: 'var(--brand-accent)', values: backlog }]}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
