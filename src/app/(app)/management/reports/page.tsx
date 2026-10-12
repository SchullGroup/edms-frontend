'use client';

import React, { useState, useEffect } from 'react';
import { useUIStore } from '@/store/useUIStore';
import { useDepartments } from '@/apis/hooks/useDepartments';
import { workflowInstancesService } from '@/apis/services/workflowInstances.service';
import { tasksService } from '@/apis/services/tasks.service';
import { Table, Column } from '@/components/ui/Table';
import { Icon } from '@/components/ui/Icons';
import { exportCsv } from '@/utils/exportCsv';
import { fmtDate } from '@/utils/helpers';

type Row = Record<string, string | number>;

interface ReportDef {
  label: string;
  description: string;
  /** Only the SLA report is filtered by date — the others are a snapshot of now. */
  usesRange: boolean;
  columns: { key: string; label: string }[];
  run: (opts: { departmentId?: string; from?: string }) => Promise<Row[]>;
}

/** Ageing register rows come 100 to a page; stop after this many pages. */
const MAX_AGEING_PAGES = 20;

/**
 * Every report reads an aggregate endpoint the dashboards already use, and is
 * built and downloaded in the browser — there is no report or scheduling API.
 */
const REPORTS: Record<string, ReportDef> = {
  status: {
    label: 'Open items by cabinet',
    description: 'Pending, in progress, on hold and overdue work per cabinet, right now.',
    usesRange: false,
    columns: [
      { key: 'department', label: 'Department' },
      { key: 'cabinet', label: 'Cabinet' },
      { key: 'pending', label: 'Pending' },
      { key: 'inProgress', label: 'In progress' },
      { key: 'onHold', label: 'On hold' },
      { key: 'overdue', label: 'Overdue' },
      { key: 'open', label: 'Open items' },
    ],
    run: async ({ departmentId }) => {
      const data = await workflowInstancesService.getOpenItemsByCabinet({ departmentId });
      return data.cabinets.map((c) => ({
        department: c.departmentName ?? '—',
        cabinet: c.cabinetName,
        pending: c.pending,
        inProgress: c.inProgress,
        onHold: c.onHold,
        overdue: c.overdue,
        open: c.openItems,
      }));
    },
  },
  ageing: {
    label: 'Ageing register',
    description:
      'Every open document in a workflow: its stage, who has it, how long, and SLA state.',
    usesRange: false,
    columns: [
      { key: 'title', label: 'Document' },
      { key: 'reference', label: 'Reference' },
      { key: 'department', label: 'Department' },
      { key: 'cabinet', label: 'Cabinet' },
      { key: 'stage', label: 'Stage' },
      { key: 'assignee', label: 'With' },
      { key: 'urgency', label: 'Urgency' },
      { key: 'ageDays', label: 'Days in stage' },
      { key: 'due', label: 'SLA due' },
      { key: 'sla', label: 'SLA status' },
    ],
    run: async ({ departmentId }) => {
      const rows: Row[] = [];
      for (let page = 1; page <= MAX_AGEING_PAGES; page++) {
        const data = await workflowInstancesService.getBottlenecksAgeing({
          departmentId,
          page,
          limit: 100,
        });
        for (const it of data.items) {
          rows.push({
            title: it.documentTitle,
            reference: it.referenceNumber ?? '',
            department: it.departmentName ?? '—',
            cabinet: it.cabinetName,
            stage: it.currentStageName,
            assignee: it.assigneeName,
            urgency: it.urgency,
            ageDays: it.ageDays,
            due: it.slaDueAt ? fmtDate(it.slaDueAt) : '—',
            sla: it.slaStatus.replace(/_/g, ' '),
          });
        }
        if (page >= (data.pagination?.totalPages ?? 1)) break;
      }
      return rows;
    },
  },
  sla: {
    label: 'SLA compliance by department',
    description: 'Completed stages that met or missed their deadline, per department.',
    usesRange: true,
    columns: [
      { key: 'department', label: 'Department' },
      { key: 'total', label: 'Completed' },
      { key: 'onTime', label: 'On time' },
      { key: 'overdue', label: 'Late' },
      { key: 'rate', label: 'SLA %' },
    ],
    run: async ({ departmentId, from }) => {
      const data = await tasksService.getStats({ groupBy: 'department', departmentId, from });
      return data.buckets.map((b) => ({
        department: b.departmentName ?? '—',
        total: b.total,
        onTime: b.onTime,
        overdue: b.overdue,
        rate: `${b.slaRate}%`,
      }));
    },
  },
  workload: {
    label: 'Workload by member',
    description: 'What each person has pending, in progress, overdue and closed.',
    usesRange: false,
    columns: [
      { key: 'member', label: 'Member' },
      { key: 'department', label: 'Department' },
      { key: 'pending', label: 'Pending' },
      { key: 'inProgress', label: 'In progress' },
      { key: 'overdue', label: 'Overdue' },
      { key: 'closed', label: 'Closed' },
      { key: 'total', label: 'Total' },
    ],
    run: async ({ departmentId }) => {
      const members = await workflowInstancesService.getTeamStatusMatrix({ departmentId });
      return members.map((m) => ({
        member: m.memberName,
        department: m.departmentName ?? '—',
        pending: m.pending,
        inProgress: m.inProgress,
        overdue: m.overdue,
        closed: m.closed,
        total: m.total,
      }));
    },
  },
};

const RANGES = [
  { value: '30', label: 'Last 30 days' },
  { value: '90', label: 'Last 90 days' },
  { value: 'ytd', label: 'Year to date' },
  { value: 'all', label: 'All time' },
];

function rangeStart(range: string): string | undefined {
  const now = new Date();
  if (range === 'all') return undefined;
  if (range === 'ytd') return new Date(now.getFullYear(), 0, 1).toISOString();
  return new Date(now.getTime() - Number(range) * 86400000).toISOString();
}

export default function ReportsExportPage() {
  const { setPageTitle, addToast } = useUIStore();
  const { data: departmentsRes } = useDepartments();
  const departments = departmentsRes?.data ?? [];

  const [type, setType] = useState<keyof typeof REPORTS>('status');
  const [dept, setDept] = useState('');
  const [range, setRange] = useState('30');
  const [running, setRunning] = useState(false);
  const [result, setResult] = useState<{ type: string; title: string; rows: Row[] } | null>(null);

  useEffect(() => {
    setPageTitle('Reports & Export');
  }, [setPageTitle]);

  const def = REPORTS[type];

  const handleRun = async () => {
    setRunning(true);
    try {
      const rows = await def.run({
        departmentId: dept || undefined,
        from: def.usesRange ? rangeStart(range) : undefined,
      });
      const deptName = departments.find((d) => d.id === dept)?.name ?? 'All departments';
      const rangeLabel = def.usesRange ? `, ${RANGES.find((r) => r.value === range)?.label}` : '';
      setResult({ type, title: `${def.label} — ${deptName}${rangeLabel}`, rows });
    } catch (err: any) {
      addToast(err?.response?.data?.message || 'Failed to run the report', 'error');
    } finally {
      setRunning(false);
    }
  };

  const resultDef = result ? REPORTS[result.type] : null;
  const cols: Column<Row>[] = (resultDef?.columns ?? []).map((c) => ({
    key: c.key,
    label: c.label,
    render: (r: Row) => r[c.key],
  }));

  return (
    <div>
      <div className="page-head">
        <div>
          <div className="page-title">Reports & Export</div>
          <div className="page-sub">
            Run a status, ageing, SLA or workload report and download it.
          </div>
        </div>
      </div>

      <div className="grid cols-2 mb-4" style={{ alignItems: 'start' }}>
        <div className="card">
          <div className="card-head">
            <span className="h3">Report builder</span>
          </div>
          <div className="card-body">
            <div className="field">
              <label htmlFor="report-type">Report</label>
              <select
                id="report-type"
                className="input"
                value={type}
                onChange={(e) => setType(e.target.value as keyof typeof REPORTS)}
              >
                {Object.entries(REPORTS).map(([key, r]) => (
                  <option key={key} value={key}>
                    {r.label}
                  </option>
                ))}
              </select>
              <div className="help">{def.description}</div>
            </div>
            <div className="grid cols-2" style={{ gap: '12px' }}>
              <div className="field">
                <label htmlFor="report-dept">Department</label>
                <select
                  id="report-dept"
                  className="input"
                  value={dept}
                  onChange={(e) => setDept(e.target.value)}
                >
                  <option value="">All departments</option>
                  {departments.map((d) => (
                    <option key={d.id} value={d.id}>
                      {d.name}
                    </option>
                  ))}
                </select>
              </div>
              <div className="field">
                <label htmlFor="report-range">Completed in</label>
                <select
                  id="report-range"
                  className="input"
                  value={range}
                  disabled={!def.usesRange}
                  title={def.usesRange ? undefined : 'This report is a snapshot of now'}
                  onChange={(e) => setRange(e.target.value)}
                >
                  {RANGES.map((r) => (
                    <option key={r.value} value={r.value}>
                      {r.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>
            <div className="flex gap-2" style={{ justifyContent: 'flex-end' }}>
              <button className="btn btn-primary" onClick={handleRun} disabled={running}>
                {running ? 'Running…' : 'Run report'}
              </button>
            </div>
          </div>
        </div>

        <div className="card">
          <div className="card-head">
            <span className="h3">Scheduled reports</span>
          </div>
          <div className="card-body">
            <p className="caption" style={{ lineHeight: 1.6 }}>
              Not available yet. Scheduling and emailing reports needs a server-side report job,
              which the backend doesn&rsquo;t have. Run a report here and download it instead.
            </p>
          </div>
        </div>
      </div>

      {result && (
        <div className="card">
          <div className="card-head">
            <span className="h3">
              {result.title} · {result.rows.length} row{result.rows.length === 1 ? '' : 's'}
            </span>
            <button
              className="btn btn-secondary btn-sm"
              disabled={result.rows.length === 0}
              title="CSV — opens in Excel"
              onClick={() => exportCsv(result.title, result.rows, resultDef!.columns)}
            >
              <Icon name="download" size={13} /> Download CSV
            </button>
          </div>
          {result.rows.length ? (
            <Table cols={cols} rows={result.rows} />
          ) : (
            <p className="caption" style={{ padding: '16px' }}>
              Nothing to report for this selection.
            </p>
          )}
        </div>
      )}
    </div>
  );
}
