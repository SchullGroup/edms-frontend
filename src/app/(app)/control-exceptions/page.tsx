'use client';

import React, { Suspense, useEffect, useMemo, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useUIStore } from '@/store/useUIStore';
import { usePermissions } from '@/hooks/usePermissions';
import { useControlExceptions } from '@/apis/hooks/useControlExceptions';
import { useDepartments } from '@/apis/hooks/useDepartments';
import { departmentOptions } from '@/apis/utils/managementAggregation';
import { Table, Column } from '@/components/ui/Table';
import { Pagination } from '@/components/ui/Pagination';
import { Icon } from '@/components/ui/Icons';
import { DateField } from '@/components/ui/DatePicker';
import { ErrorMessage } from '@/components/common/ErrorMessage';
import { SkeletonTable } from '@/components/common/Skeleton';
import {
  CATEGORIES,
  CATEGORY_LABEL,
  ControlExceptionStatusBadge,
  SEVERITIES,
  SEVERITY_LABEL,
  STATUSES,
  STATUS_LABEL,
  SeverityBadge,
  dayEnd,
  dayStart,
} from '@/components/controlExceptions/controlExceptionLabels';
import { fmtDate } from '@/utils/helpers';
import type {
  ControlException,
  ControlExceptionCategory,
  ControlExceptionSeverity,
  ControlExceptionStatus,
} from '@/types/models';

const PAGE_SIZE = 20;
const COLUMNS = ['Exception', 'Severity', 'Status', 'Department', 'Raised'];

export default function ControlExceptionsPage() {
  // useSearchParams needs a Suspense boundary above it.
  return (
    <Suspense fallback={<SkeletonTable columns={COLUMNS} rows={8} />}>
      <ControlExceptionsList />
    </Suspense>
  );
}

/**
 * The control exceptions register: the internal control unit raises and reports them,
 * the permanent secretary (management) acknowledges and resolves them.
 */
function ControlExceptionsList() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { setPageTitle } = useUIStore();
  const { hasPermission } = usePermissions();
  const canCreate = hasPermission('control_exception', 'create');

  // `?status=` comes from the report's tiles.
  const initialStatus = STATUSES.find((s) => s === searchParams.get('status')) ?? '';
  const [status, setStatus] = useState<ControlExceptionStatus | ''>(initialStatus);
  const [category, setCategory] = useState<ControlExceptionCategory | ''>('');
  const [severity, setSeverity] = useState<ControlExceptionSeverity | ''>('');
  const [departmentId, setDepartmentId] = useState('');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [page, setPage] = useState(1);

  const { data: deptData } = useDepartments();
  const departments = useMemo(() => departmentOptions(deptData?.data ?? []), [deptData]);

  const { data, isLoading, isError, refetch } = useControlExceptions({
    status: status || undefined,
    category: category || undefined,
    severity: severity || undefined,
    departmentId: departmentId || undefined,
    from: dayStart(from),
    to: dayEnd(to),
    page,
    limit: PAGE_SIZE,
  });
  const rows = data?.data ?? [];
  const filtered = !!(status || category || severity || departmentId || from || to);

  useEffect(() => {
    setPageTitle('Control exceptions');
  }, [setPageTitle]);

  // Every filter change starts again from the first page.
  const filter =
    <T,>(set: (v: T) => void) =>
    (v: T) => {
      set(v);
      setPage(1);
    };

  const cols: Column<ControlException>[] = [
    {
      key: 'title',
      label: 'Exception',
      render: (c) => (
        <span>
          <b>{c.title}</b>
          <div className="caption">{CATEGORY_LABEL[c.category] ?? c.category}</div>
        </span>
      ),
    },
    { key: 'severity', label: 'Severity', render: (c) => <SeverityBadge severity={c.severity} /> },
    {
      key: 'status',
      label: 'Status',
      render: (c) => <ControlExceptionStatusBadge status={c.status} />,
    },
    {
      key: 'department',
      label: 'Department',
      render: (c) => <span className="caption">{c.department?.name ?? '—'}</span>,
    },
    {
      key: 'raisedAt',
      label: 'Raised',
      render: (c) => (
        <span className="caption">
          {fmtDate(c.raisedAt)}
          {c.raiser ? ` · ${c.raiser.name}` : ''}
        </span>
      ),
    },
  ];

  const selectStyle = { width: 'auto', height: 32 };

  return (
    <div>
      <div className="page-head">
        <div>
          <div className="page-title">Control exceptions</div>
          <div className="page-sub">
            Issues the internal control unit found in a transaction or department, and what the
            permanent secretary did about them.
          </div>
        </div>
        <div className="actions">
          <button
            className="btn btn-secondary"
            onClick={() => router.push('/control-exceptions/report')}
          >
            <Icon name="report" size={15} /> Report
          </button>
          {canCreate && (
            <button
              className="btn btn-primary"
              onClick={() => router.push('/control-exceptions/new')}
            >
              <Icon name="plus" size={15} /> Raise exception
            </button>
          )}
        </div>
      </div>

      <div className="flex gap-2 flex-wrap items-center mb-4">
        <select
          className="input"
          style={selectStyle}
          aria-label="Status"
          value={status}
          onChange={(e) => filter(setStatus)(e.target.value as ControlExceptionStatus | '')}
        >
          <option value="">All statuses</option>
          {STATUSES.map((s) => (
            <option key={s} value={s}>
              {STATUS_LABEL[s]}
            </option>
          ))}
        </select>
        <select
          className="input"
          style={selectStyle}
          aria-label="Category"
          value={category}
          onChange={(e) => filter(setCategory)(e.target.value as ControlExceptionCategory | '')}
        >
          <option value="">All categories</option>
          {CATEGORIES.map((c) => (
            <option key={c} value={c}>
              {CATEGORY_LABEL[c]}
            </option>
          ))}
        </select>
        <select
          className="input"
          style={selectStyle}
          aria-label="Severity"
          value={severity}
          onChange={(e) => filter(setSeverity)(e.target.value as ControlExceptionSeverity | '')}
        >
          <option value="">All severities</option>
          {SEVERITIES.map((s) => (
            <option key={s} value={s}>
              {SEVERITY_LABEL[s]}
            </option>
          ))}
        </select>
        <select
          className="input"
          style={{ ...selectStyle, maxWidth: 240 }}
          aria-label="Department"
          value={departmentId}
          onChange={(e) => filter(setDepartmentId)(e.target.value)}
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
          onChange={filter(setFrom)}
        />
        <DateField
          compact
          aria-label="Raised to"
          placeholder="Raised to"
          value={to}
          min={from || undefined}
          onChange={filter(setTo)}
        />
      </div>

      {isLoading ? (
        <SkeletonTable columns={COLUMNS} rows={8} />
      ) : isError ? (
        <ErrorMessage message="Failed to load control exceptions." retry={() => refetch()} />
      ) : (
        <>
          <div className="card">
            <Table
              cols={cols}
              rows={rows}
              onRow={(c) => router.push(`/control-exceptions/${c.id}`)}
              emptyMsg={
                filtered ? 'No exceptions match these filters.' : 'No control exceptions yet.'
              }
            />
          </div>
          {data?.pagination && (
            <Pagination
              page={data.pagination.page}
              totalPages={data.pagination.totalPages}
              total={data.pagination.total}
              limit={data.pagination.limit}
              onPageChange={setPage}
            />
          )}
        </>
      )}
    </div>
  );
}
