'use client';

import React, { useEffect, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useUIStore } from '@/store/useUIStore';
import { exportCsv } from '@/utils/exportCsv';
import { LineChart, Sparkline } from '@/components/ui/Charts';
import { Table, Column } from '@/components/ui/Table';
import { SkeletonKpis, SkeletonTable } from '@/components/common/Skeleton';
import { ErrorMessage } from '@/components/common/ErrorMessage';
import { lastDaysRange, useSlaOutcomeSummary } from '@/apis/hooks/useSla';
import { taskKeys, useTaskWorkload } from '@/apis/hooks/useTasks';
import { tasksService } from '@/apis/services/tasks.service';
import { fetchAllPages } from '@/apis/utils/fetchAllPages';
import { turnaroundDays } from '@/utils/supervisor';
import type { Task } from '@/types/models';

const DAY_MS = 86400000;
const PERIOD_DAYS = 30;
const WEEKS = 6;

interface MemberRow {
  id: string;
  name: string;
  /** On-time share of stage results in the period, 0–100; null with none. */
  sla: number | null;
  onTime: number;
  outcomes: number;
  closed: number;
  /** Average days from task raised to completed; null with none closed. */
  turnaround: number | null;
  spark: number[];
}

function average(values: number[]): number | null {
  return values.length ? values.reduce((sum, v) => sum + v, 0) / values.length : null;
}

/**
 * Team Performance: everyone the supervisor's `task:view` scope covers (their
 * department, or the tenant at global scope). On-time figures come from
 * `GET /sla/outcomes/summary` (stage results, by person); closures and
 * turnaround from the team's tasks (`GET /tasks?scope=all`), credited to
 * whoever completed them; the roster from `GET /tasks/workload`.
 */
export default function TeamPerformancePage() {
  const { setPageTitle } = useUIStore();

  useEffect(() => {
    setPageTitle('Team Performance');
  }, [setPageTitle]);

  const period = lastDaysRange(PERIOD_DAYS);
  const previous = useMemo(() => {
    const to = new Date(Date.parse(period.from) - DAY_MS);
    const from = new Date(to.getTime() - (PERIOD_DAYS - 1) * DAY_MS);
    return { from: from.toISOString().slice(0, 10), to: to.toISOString().slice(0, 10) };
  }, [period.from]);

  const outcomesQuery = useSlaOutcomeSummary({ ...period, groupBy: 'user' });
  const previousOutcomesQuery = useSlaOutcomeSummary(previous);
  const workloadQuery = useTaskWorkload();
  // Every task in scope, walked page by page: there is no per-person closures
  // endpoint. Small teams make this a request or two.
  const tasksQuery = useQuery({
    queryKey: [...taskKeys.all, 'team-performance'],
    queryFn: () => fetchAllPages<Task, { scope: 'all' }>(tasksService.getAll, { scope: 'all' }),
  });

  const now = Date.now();
  const periodStart = now - PERIOD_DAYS * DAY_MS;
  const previousStart = periodStart - PERIOD_DAYS * DAY_MS;

  // Six 7-day buckets ending today, oldest first, labelled by their first day.
  const weekStarts = Array.from({ length: WEEKS }, (_, i) => now - (WEEKS - i) * 7 * DAY_MS);
  const weekLabels = weekStarts.map((t) =>
    new Date(t).toLocaleDateString('en-GB', { day: '2-digit', month: 'short' }),
  );
  const weekOf = (iso: string | null | undefined) => {
    if (!iso) return -1;
    const t = Date.parse(iso);
    return weekStarts.findIndex((start) => t >= start && t < start + 7 * DAY_MS);
  };

  const tasks = tasksQuery.data ?? [];
  const completed = tasks.filter((t) => t.status === 'completed' && t.completedAt);
  const inPeriod = (t: Task, from: number, to: number) => {
    const at = Date.parse(t.completedAt as string);
    return at >= from && at < to;
  };
  const closedNow = completed.filter((t) => inPeriod(t, periodStart, now + DAY_MS));
  const closedBefore = completed.filter((t) => inPeriod(t, previousStart, periodStart));

  const turnaroundNow = average(
    closedNow.map(turnaroundDays).filter((d): d is number => d !== null),
  );
  const turnaroundBefore = average(
    closedBefore.map(turnaroundDays).filter((d): d is number => d !== null),
  );

  const closedPerWeek = weekStarts.map(() => 0);
  const raisedPerWeek = weekStarts.map(() => 0);
  for (const t of completed) {
    const w = weekOf(t.completedAt);
    if (w >= 0) closedPerWeek[w]++;
  }
  for (const t of tasks) {
    const w = weekOf(t.createdAt);
    if (w >= 0) raisedPerWeek[w]++;
  }

  const outcomes = outcomesQuery.data;
  const outcomesBefore = previousOutcomesQuery.data;
  const slaNow = outcomes && outcomes.total > 0 ? outcomes.onTimeRate * 100 : null;
  const slaBefore =
    outcomesBefore && outcomesBefore.total > 0 ? outcomesBefore.onTimeRate * 100 : null;

  // Everyone on the roster, plus anyone with results or closures who isn't
  // (a member who moved department, say).
  const names = new Map<string, string>();
  for (const m of workloadQuery.data?.members ?? []) names.set(m.memberId, m.memberName);
  for (const g of outcomes?.groups ?? []) {
    if (g.key && !names.has(g.key)) names.set(g.key, g.label);
  }
  for (const t of closedNow) {
    if (t.completedBy && !names.has(t.completedBy)) names.set(t.completedBy, 'Unknown user');
  }

  const rows: MemberRow[] = [...names].map(([id, name]) => {
    const group = outcomes?.groups.find((g) => g.key === id);
    const mine = closedNow.filter((t) => t.completedBy === id);
    const spark = weekStarts.map(() => 0);
    for (const t of completed) {
      if (t.completedBy !== id) continue;
      const w = weekOf(t.completedAt);
      if (w >= 0) spark[w]++;
    }
    return {
      id,
      name,
      sla: group && group.total > 0 ? Math.round(group.onTimeRate * 100) : null,
      onTime: group?.onTime ?? 0,
      outcomes: group?.total ?? 0,
      closed: mine.length,
      turnaround: average(mine.map(turnaroundDays).filter((d): d is number => d !== null)),
      spark,
    };
  });
  rows.sort((a, b) => b.closed - a.closed || a.name.localeCompare(b.name));

  const slaColor = (sla: number) =>
    sla >= 85 ? 'var(--status-closed)' : sla >= 80 ? 'var(--status-pending)' : 'var(--status-overdue)';

  const cols: Column<MemberRow>[] = [
    { key: 'name', label: 'Member', sortable: true, render: (r) => <b>{r.name}</b> },
    {
      key: 'sla',
      label: 'SLA % (30d)',
      sortable: true,
      render: (r) =>
        r.sla === null ? (
          <span className="caption">No results</span>
        ) : (
          <span title={`${r.onTime} of ${r.outcomes} stages on time`}>
            <span style={{ color: slaColor(r.sla), fontWeight: 800 }}>{r.sla}%</span>
            <span className="caption">
              {' '}
              · {r.onTime}/{r.outcomes}
            </span>
          </span>
        ),
    },
    { key: 'closed', label: 'Closed (30d)', sortable: true },
    {
      key: 'turnaround',
      label: 'Avg turnaround',
      sortable: true,
      render: (r) => (r.turnaround === null ? '—' : `${r.turnaround.toFixed(1)} d`),
    },
    {
      key: 'spark',
      label: '6-week trend',
      render: (r) => <Sparkline values={r.spark} color="var(--brand-primary-light)" />,
    },
  ];

  const loading =
    outcomesQuery.isLoading || tasksQuery.isLoading || workloadQuery.isLoading;
  const failed = outcomesQuery.isError || tasksQuery.isError;

  const delta = (
    current: number | null,
    before: number | null,
    unit: string,
    lowerIsBetter = false,
  ) => {
    if (current === null || before === null) {
      return { text: 'No earlier period to compare', dir: '' };
    }
    const diff = current - before;
    if (Math.abs(diff) < 0.05) return { text: 'Same as the 30 days before', dir: '' };
    const better = lowerIsBetter ? diff < 0 : diff > 0;
    const sign = diff > 0 ? '+' : '−';
    return {
      text: `${diff > 0 ? '▲' : '▼'} ${sign}${Math.abs(diff).toFixed(unit === '' ? 0 : 1)}${unit} vs the 30 days before`,
      dir: better ? 'up' : 'down',
    };
  };

  const slaDelta = delta(slaNow, slaBefore, ' pts');
  const closedDelta = delta(closedNow.length, closedBefore.length, '');
  const turnaroundDelta = delta(turnaroundNow, turnaroundBefore, ' d', true);

  const handleExport = () =>
    exportCsv(
      'Team_Performance',
      rows.map((r) => ({
        member: r.name,
        sla_percent_30d: r.sla ?? '',
        stages_on_time: r.onTime,
        stages_total: r.outcomes,
        closed_30d: r.closed,
        avg_turnaround_days: r.turnaround === null ? '' : r.turnaround.toFixed(1),
      })),
    );

  return (
    <div>
      <div className="page-head">
        <div>
          <div className="page-title">Team Performance</div>
          <div className="page-sub">
            How the people you oversee are doing over the last 30 days.
          </div>
        </div>
        <div className="actions">
          <button className="btn btn-secondary" onClick={handleExport} disabled={!rows.length}>
            Export CSV
          </button>
        </div>
      </div>

      {failed ? (
        <div className="card">
          <div style={{ padding: 24 }}>
            <ErrorMessage
              message="Failed to load team performance."
              retry={() => {
                outcomesQuery.refetch();
                previousOutcomesQuery.refetch();
                tasksQuery.refetch();
                workloadQuery.refetch();
              }}
            />
          </div>
        </div>
      ) : loading ? (
        <>
          <SkeletonKpis count={3} />
          <div className="card">
            <SkeletonTable
              columns={['Member', 'SLA % (30d)', 'Closed (30d)', 'Avg turnaround', '6-week trend']}
              rows={4}
            />
          </div>
        </>
      ) : (
        <>
          <div className="grid cols-3 mb-4">
            <div className="card kpi">
              <div className="kv" style={slaNow === null ? undefined : { color: slaColor(slaNow) }}>
                {slaNow === null ? '—' : `${Math.round(slaNow)}%`}
              </div>
              <div className="kl">Team SLA compliance (30d)</div>
              <div className={`kd ${slaDelta.dir}`}>
                {outcomes && outcomes.total > 0
                  ? `${outcomes.onTime} of ${outcomes.total} stages on time · ${slaDelta.text}`
                  : 'No completed stages in the last 30 days'}
              </div>
            </div>
            <div className="card kpi">
              <div className="kv">{closedNow.length}</div>
              <div className="kl">Items closed (30d)</div>
              <div className={`kd ${closedDelta.dir}`}>{closedDelta.text}</div>
            </div>
            <div className="card kpi">
              <div className="kv">
                {turnaroundNow === null ? '—' : `${turnaroundNow.toFixed(1)} d`}
              </div>
              <div className="kl">Avg turnaround (30d)</div>
              <div className={`kd ${turnaroundDelta.dir}`}>{turnaroundDelta.text}</div>
            </div>
          </div>

          <div className="card mb-4">
            <div className="card-head">
              <span className="h3">Weekly closures — team</span>
            </div>
            <div className="card-body">
              <LineChart
                labels={weekLabels}
                series={[
                  { name: 'Closed', color: 'var(--status-closed)', values: closedPerWeek },
                  { name: 'New inflow', color: 'var(--status-pending)', values: raisedPerWeek },
                ]}
              />
            </div>
          </div>

          <div className="card">
            <div className="card-head">
              <span className="h3">Member comparison</span>
            </div>
            <Table
              cols={cols}
              rows={rows}
              emptyMsg="Nobody in your team has tasks or results yet."
            />
          </div>
        </>
      )}
    </div>
  );
}
