'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { useUIStore } from '@/store/useUIStore';
import { useDepartments } from '@/apis/hooks/useDepartments';
import { useCabinets } from '@/apis/hooks/useCabinets';
import { useAllDocuments } from '@/apis/hooks/useDocuments';
import { useAllWorkflowInstances } from '@/apis/hooks/useWorkflowInstances';
import { LineChart } from '@/components/ui/Charts';
import { Icon } from '@/components/ui/Icons';
import { Spinner } from '@/components/common/Spinner';
import {
  buildDepartmentIndex,
  buildCabinetDepartmentIndex,
  documentDepartmentId,
  bucketByMonth,
} from '@/apis/utils/managementAggregation';

export default function TrendsForecastPage() {
  const { setPageTitle } = useUIStore();
  const [dept, setDept] = useState('All');
  const [range, setRange] = useState(7);

  useEffect(() => {
    setPageTitle('Trends & Forecast');
  }, [setPageTitle]);

  const { data: departmentsRes, isLoading: loadingDepts } = useDepartments();
  const { data: cabinetsRes, isLoading: loadingCabinets } = useCabinets();
  const { data: documents = [], isLoading: loadingDocs } = useAllDocuments();
  const { data: instances = [], isLoading: loadingInstances } = useAllWorkflowInstances();

  const departments = departmentsRes?.data ?? [];
  const cabinets = cabinetsRes?.data ?? [];

  const isLoading = loadingDepts || loadingCabinets || loadingDocs || loadingInstances;

  const departmentIndex = useMemo(() => buildDepartmentIndex(departments), [departments]);
  const cabinetIndex = useMemo(() => buildCabinetDepartmentIndex(cabinets), [cabinets]);
  const deptOptions = useMemo(() => Array.from(departmentIndex.values()), [departmentIndex]);

  const scopedDept = dept === 'All' ? null : dept;

  const scopedDocuments = useMemo(
    () =>
      documents.filter((d) => !scopedDept || documentDepartmentId(d, cabinetIndex) === scopedDept),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [documents, cabinetIndex, scopedDept],
  );
  const scopedInstances = useMemo(
    () =>
      instances.filter((wi) => {
        if (!scopedDept) return true;
        const cabinetId = wi.document?.cabinetId;
        return cabinetId ? cabinetIndex.get(cabinetId) === scopedDept : false;
      }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [instances, cabinetIndex, scopedDept],
  );

  const inflow = bucketByMonth(scopedDocuments, (d) => d.createdAt, range);
  const closed = bucketByMonth(
    scopedInstances.filter((wi) => wi.closedAt),
    (wi) => wi.closedAt,
    range,
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

      <div className="banner info">
        <span style={{ marginRight: '8px' }}>
          <Icon name="trend" size={15} />
        </span>
        Forecast: inflow trending {slope >= 0 ? 'up' : 'down'} ~{Math.abs(Math.round(slope))}{' '}
        files/month. Projected next two months: {forecastIn.join(', ')}. Backlog{' '}
        {backlog[backlog.length - 1] > (backlog[0] ?? 0) ? 'growing' : 'shrinking'} — currently{' '}
        {backlog[backlog.length - 1] ?? 0} open items.
      </div>

      <div className="grid cols-2 mb16 mt16">
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
            <div className="caption mt8">
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
