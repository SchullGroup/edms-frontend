'use client';

import React, { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useUIStore } from '@/store/useUIStore';
import { useControlExceptionReport } from '@/apis/hooks/useControlExceptions';
import { useDepartments } from '@/apis/hooks/useDepartments';
import { departmentOptions } from '@/apis/utils/managementAggregation';
import { HBarChart } from '@/components/ui/Charts';
import { Icon } from '@/components/ui/Icons';
import { DateField } from '@/components/ui/DatePicker';
import { ErrorMessage } from '@/components/common/ErrorMessage';
import { SkeletonPage } from '@/components/common/Skeleton';
import {
  CATEGORIES,
  CATEGORY_LABEL,
  SEVERITIES,
  SEVERITY_LABEL,
  STATUSES,
  STATUS_LABEL,
  dayEnd,
  dayStart,
} from '@/components/controlExceptions/controlExceptionLabels';
import { exportCsv } from '@/utils/exportCsv';

/** Counts by status, category, severity and department: what the unit gives the permanent secretary. */
export default function ControlExceptionReportPage() {
  const router = useRouter();
  const { setPageTitle } = useUIStore();
  const [departmentId, setDepartmentId] = useState('');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');

  const { data: deptData } = useDepartments();
  const departments = useMemo(() => departmentOptions(deptData?.data ?? []), [deptData]);
  const {
    data: report,
    isLoading,
    isError,
    refetch,
  } = useControlExceptionReport({
    departmentId: departmentId || undefined,
    from: dayStart(from),
    to: dayEnd(to),
  });

  useEffect(() => {
    setPageTitle('Control exceptions report');
  }, [setPageTitle]);

  const byStatus = report?.byStatus ?? {};
  const awaiting = (byStatus.reported ?? 0) + (byStatus.acknowledged ?? 0);
  const openList = (status: string) => router.push(`/control-exceptions?status=${status}`);

  const sections = report
    ? [
        {
          title: 'By category',
          rows: CATEGORIES.map((c) => ({
            label: CATEGORY_LABEL[c],
            value: report.byCategory[c] ?? 0,
          })),
        },
        {
          title: 'By severity',
          rows: SEVERITIES.map((s) => ({
            label: SEVERITY_LABEL[s],
            value: report.bySeverity[s] ?? 0,
          })),
        },
        {
          title: 'By department',
          rows: report.byDepartment
            .map((d) => ({ label: d.departmentName ?? 'No department', value: d.count }))
            .sort((a, b) => b.value - a.value),
        },
      ]
    : [];

  const download = () => {
    if (!report) return;
    const rows = [
      ...STATUSES.map((s) => ({ group: 'Status', item: STATUS_LABEL[s], count: byStatus[s] ?? 0 })),
      ...sections.flatMap((sec) =>
        sec.rows.map((r) => ({
          group: sec.title.replace('By ', ''),
          item: r.label,
          count: r.value,
        })),
      ),
    ];
    exportCsv('control-exceptions-report.csv', rows, [
      { key: 'group', label: 'Grouping' },
      { key: 'item', label: 'Value' },
      { key: 'count', label: 'Exceptions' },
    ]);
  };

  return (
    <div>
      <div className="page-head">
        <div>
          <div className="caption mb-1">
            <Link href="/control-exceptions">Control exceptions</Link>
          </div>
          <div className="page-title">Control exceptions report</div>
          <div className="page-sub">Counts by status, category, severity and department.</div>
        </div>
        <div className="actions">
          <button className="btn btn-secondary" onClick={download} disabled={!report?.total}>
            <Icon name="download" size={15} /> Export CSV
          </button>
        </div>
      </div>

      <div className="flex gap-2 flex-wrap items-center mb-4">
        <select
          className="input"
          style={{ width: 'auto', maxWidth: 240, height: 32 }}
          aria-label="Department"
          value={departmentId}
          onChange={(e) => setDepartmentId(e.target.value)}
        >
          <option value="">All departments</option>
          {departments.map((d) => (
            <option key={d.id} value={d.id}>
              {d.label}
            </option>
          ))}
        </select>
        <DateField
          compact
          aria-label="Raised from"
          placeholder="Raised from"
          value={from}
          onChange={setFrom}
        />
        <DateField
          compact
          aria-label="Raised to"
          placeholder="Raised to"
          value={to}
          min={from || undefined}
          onChange={setTo}
        />
      </div>

      {isLoading ? (
        <SkeletonPage columns={['Grouping', 'Count']} rows={6} />
      ) : isError || !report ? (
        <ErrorMessage message="Failed to load the report." retry={() => refetch()} />
      ) : (
        <>
          <div className="grid cols-4 mb-4">
            <div className="tile t-progress">
              <div className="cnt">{report.total}</div>
              <div className="lbl">
                <Icon name="finding" size={13} /> Total raised
              </div>
            </div>
            <div
              className="tile t-pending"
              role="button"
              tabIndex={0}
              onClick={() => openList('open')}
            >
              <div className="cnt">{byStatus.open ?? 0}</div>
              <div className="lbl">
                <Icon name="edit" size={13} /> Open, not yet reported
              </div>
            </div>
            <div className="tile t-overdue">
              <div className="cnt">{awaiting}</div>
              <div className="lbl">
                <Icon name="clock" size={13} /> With the permanent secretary
              </div>
            </div>
            <div
              className="tile t-closed"
              role="button"
              tabIndex={0}
              onClick={() => openList('resolved')}
            >
              <div className="cnt">{byStatus.resolved ?? 0}</div>
              <div className="lbl">
                <Icon name="check" size={13} /> Resolved
              </div>
            </div>
          </div>

          <div className="grid cols-3">
            {sections.map((sec) => (
              <div key={sec.title} className="card">
                <div className="card-head">
                  <span className="h3">{sec.title}</span>
                </div>
                <div className="card-body">
                  {sec.rows.some((r) => r.value > 0) ? (
                    <HBarChart items={sec.rows} />
                  ) : (
                    <div className="caption">Nothing raised in this period.</div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
