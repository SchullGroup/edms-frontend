'use client';

import React, { use, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useUIStore } from '@/store/useUIStore';
import { usePermissions } from '@/hooks/usePermissions';
import {
  useCancelCircularSchedule,
  useCircular,
  useCircularRecipients,
  useDeleteCircular,
  usePublishCircular,
  useReviseCircular,
  useSendCircularReminders,
  useUpdateCircular,
  useWithdrawCircular,
} from '@/apis/hooks/useCirculars';
import { useDepartments } from '@/apis/hooks/useDepartments';
import { useRoles } from '@/apis/hooks/useRoles';
import { ConfBadge, UrgBadge } from '@/components/ui/Badges';
import { DateTimeField, todayStr } from '@/components/ui/DatePicker';
import { Icon } from '@/components/ui/Icons';
import { Pagination } from '@/components/ui/Pagination';
import { Table, Column } from '@/components/ui/Table';
import { ErrorMessage } from '@/components/common/ErrorMessage';
import { SkeletonPage, SkeletonTable } from '@/components/common/Skeleton';
import { CircularAttachmentList } from '@/components/circulars/CircularAttachmentList';
import { CircularForm } from '@/components/circulars/CircularForm';
import {
  CircularStatusBadge,
  circularReference,
  describeAudience,
  flattenDepartments,
} from '@/components/circulars/circularLabels';
import { fmtDate, fmtDateTime } from '@/utils/helpers';
import type { Circular, CircularRecipient, CircularRecipientFilter } from '@/types/models';

/**
 * One circular, for the people who manage it: its content and settings, the
 * lifecycle actions its status allows (publish/schedule, cancel, withdraw,
 * revise, remind, delete), and once it has gone out, the acknowledgement
 * report. Drafts are edited in place.
 */
export default function ManageCircularPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const { setPageTitle } = useUIStore();
  const { data: c, isLoading, isError, error, refetch } = useCircular(id);
  const updateCircular = useUpdateCircular();
  const [editing, setEditing] = useState(false);

  useEffect(() => {
    setPageTitle('Circular');
  }, [setPageTitle]);

  // A draft that stops being a draft (published from another tab) can't be edited.
  useEffect(() => {
    if (c && c.status !== 'draft') setEditing(false);
  }, [c]);

  if (isLoading)
    return <SkeletonPage kpis={4} columns={['Recipient', 'Department', 'Read', 'Acknowledged']} />;

  if (isError || !c) {
    const status = (error as any)?.response?.status;
    return (
      <div>
        <BackLink />
        <ErrorMessage
          message={
            status === 404
              ? "This circular doesn't exist, or it's outside the circulars you can manage."
              : 'Failed to load this circular.'
          }
          retry={status === 404 ? undefined : () => refetch()}
        />
      </div>
    );
  }

  if (editing) {
    return (
      <div>
        <div className="page-head">
          <div>
            <div className="caption mb-2">{circularReference(c)}</div>
            <div className="page-title">Edit draft</div>
          </div>
        </div>
        <CircularForm
          initial={c}
          submitLabel="Save changes"
          onCancel={() => setEditing(false)}
          onSubmit={async (values) => {
            await updateCircular.mutateAsync({ id: c.id, data: values });
            setEditing(false);
          }}
        />
      </div>
    );
  }

  return <CircularOverview circular={c} onEdit={() => setEditing(true)} router={router} />;
}

function CircularOverview({
  circular: c,
  onEdit,
  router,
}: {
  circular: Circular;
  onEdit: () => void;
  router: ReturnType<typeof useRouter>;
}) {
  const { hasPermission } = usePermissions();
  const canRoles = hasPermission('role', 'view');
  const { data: departmentsData } = useDepartments();
  const { data: roles = [] } = useRoles({ enabled: canRoles });

  const audienceText = useMemo(() => {
    const depts = new Map(
      flattenDepartments(departmentsData?.data ?? []).map((d) => [d.id, d.name]),
    );
    const roleNames = new Map(roles.map((r) => [r.id, r.name.replace(/_/g, ' ')]));
    return describeAudience(c.audience, {
      department: (id) => depts.get(id),
      role: (id) => roleNames.get(id),
    });
  }, [c.audience, departmentsData, roles]);

  const hasGoneOut = !['draft', 'scheduled'].includes(c.status);

  return (
    <div>
      <BackLink />

      {c.status === 'withdrawn' && (
        <div
          className="card card-pad mb-4"
          role="note"
          style={{ boxShadow: 'inset 3px 0 0 var(--status-overdue)' }}
        >
          <b>Withdrawn</b>
          {c.withdrawnAt ? ` ${fmtDateTime(c.withdrawnAt)}` : ''}
          {c.withdrawer?.name ? ` by ${c.withdrawer.name}` : ''}. Recipients were told and it has
          left their inbox.
          {c.withdrawalReason && <div className="caption mt-2">Reason: {c.withdrawalReason}</div>}
        </div>
      )}
      {c.supersededBy && (
        <div className="card card-pad mb-4" role="note">
          {c.status === 'superseded' ? 'Replaced by ' : 'A revision is in progress: '}
          <Link href={`/circulars/manage/${c.supersededBy.id}`}>
            version {c.supersededBy.versionNumber}
          </Link>
          {c.supersededBy.status && c.supersededBy.status !== 'published'
            ? ` (${c.supersededBy.status})`
            : ''}
          .
        </div>
      )}
      {c.supersedes && (
        <div className="card card-pad mb-4" role="note">
          This is a revision of{' '}
          <Link href={`/circulars/manage/${c.supersedes.id}`}>
            version {c.supersedes.versionNumber}
          </Link>
          . Publishing it replaces that version, and every recipient acknowledges this text afresh.
        </div>
      )}

      <div className="page-head">
        <div style={{ minWidth: 0 }}>
          <div className="caption mb-2">
            {circularReference(c)}
            {c.category ? ` · ${c.category}` : ''}
          </div>
          <div className="page-title">{c.title}</div>
          <div className="page-sub flex gap-2 items-center flex-wrap">
            <CircularStatusBadge status={c.status} />
            {c.status === 'scheduled' && c.publishAt && (
              <span>Goes out {fmtDateTime(c.publishAt)}</span>
            )}
            {c.publishedAt && <span>Published {fmtDateTime(c.publishedAt)}</span>}
            {c.publisher?.name && <span>by {c.publisher.name}</span>}
          </div>
        </div>
        <CircularActions circular={c} onEdit={onEdit} router={router} />
      </div>

      {c.stats && <StatsRow circular={c} />}

      <div
        className="grid mb-4"
        style={{ gridTemplateColumns: 'minmax(0, 2fr) minmax(0, 1fr)', alignItems: 'start' }}
      >
        <div>
          <div className="card card-pad mb-4">
            <div style={{ whiteSpace: 'pre-wrap', lineHeight: 1.7, fontSize: 14 }}>{c.body}</div>
          </div>
          <CircularAttachmentList attachments={c.attachments} />
        </div>

        <div className="card">
          <div className="card-head">
            <span className="h3">Details</span>
          </div>
          <div className="card-body" style={{ paddingTop: 6 }}>
            <Detail label="Audience" value={audienceText} />
            <Detail label="Confidentiality" value={<ConfBadge level={c.confidentiality} />} />
            <Detail label="Urgency" value={<UrgBadge level={c.urgency} />} />
            <Detail
              label="Acknowledgement"
              value={
                c.requiresAcknowledgement
                  ? c.acknowledgementDueAt
                    ? `Required by ${fmtDateTime(c.acknowledgementDueAt)}`
                    : 'Required, no deadline'
                  : 'Not required (FYI)'
              }
            />
            {c.requiresAcknowledgement && (
              <Detail
                label="Reminders"
                value={
                  c.reminderIntervalHours === null || c.maxReminders === 0
                    ? 'Off'
                    : `Every ${c.reminderIntervalHours}h, at most ${c.maxReminders}`
                }
              />
            )}
            <Detail label="Expires" value={c.expiresAt ? fmtDateTime(c.expiresAt) : 'Never'} />
            <Detail label="Author" value={c.creator?.name ?? '—'} />
            <Detail label="Department" value={c.department?.name ?? '—'} />
            <Detail label="Created" value={fmtDate(c.createdAt)} />
          </div>
        </div>
      </div>

      {hasGoneOut && c.stats && c.stats.byDepartment.length > 1 && (
        <DepartmentBreakdown circular={c} />
      )}
      {hasGoneOut && <RecipientsReport circular={c} />}
    </div>
  );
}

function Detail({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="metric-li" style={{ alignItems: 'flex-start' }}>
      <span className="muted">{label}</span>
      <span style={{ textAlign: 'right' }}>{value}</span>
    </div>
  );
}

function CircularActions({
  circular: c,
  onEdit,
  router,
}: {
  circular: Circular;
  onEdit: () => void;
  router: ReturnType<typeof useRouter>;
}) {
  const { openModal, openConfirm } = useUIStore();
  const { hasPermission } = usePermissions();
  const canCreate = hasPermission('circular', 'create');
  const canPublish = hasPermission('circular', 'publish');
  const canWithdraw = hasPermission('circular', 'withdraw');

  const publish = usePublishCircular();
  const cancelSchedule = useCancelCircularSchedule();
  const withdraw = useWithdrawCircular();
  const revise = useReviseCircular();
  const remove = useDeleteCircular();
  const remind = useSendCircularReminders();

  const handlePublish = () => {
    const choice = { mode: 'now' as 'now' | 'later', at: '' };
    openModal({
      title: `Publish “${c.title}”`,
      body: <PublishOptions onChange={(mode, at) => Object.assign(choice, { mode, at })} />,
      actions: [
        { label: 'Cancel' },
        {
          label: 'Publish',
          kind: 'btn-primary',
          onClick: () => {
            if (choice.mode === 'later') {
              if (!choice.at || new Date(choice.at) <= new Date()) {
                useUIStore.getState().addToast('Pick a time in the future to schedule it', 'error');
                return false;
              }
            }
            return publish
              .mutateAsync({
                id: c.id,
                publishAt: choice.mode === 'later' ? new Date(choice.at).toISOString() : undefined,
              })
              .then(() => undefined)
              .catch(() => false);
          },
        },
      ],
    });
  };

  const handleWithdraw = () => {
    let reason = '';
    openModal({
      title: 'Withdraw circular',
      body: (
        <div>
          <p className="mb-4" style={{ fontSize: 13, lineHeight: 1.6 }}>
            Recipients are told it has been withdrawn and it leaves their inbox. Reminders stop.
            This can&apos;t be undone — to change the text instead, start a revision.
          </p>
          <div className="field">
            <label htmlFor="withdraw-reason">
              Reason <span className="req">*</span>
            </label>
            <textarea
              id="withdraw-reason"
              className="input"
              maxLength={1000}
              style={{ minHeight: 90 }}
              onChange={(e) => (reason = e.target.value)}
            />
          </div>
        </div>
      ),
      actions: [
        { label: 'Cancel' },
        {
          label: 'Withdraw',
          kind: 'btn-danger',
          onClick: () => {
            if (!reason.trim()) {
              useUIStore.getState().addToast('A reason is required', 'error');
              return false;
            }
            return withdraw
              .mutateAsync({ id: c.id, reason: reason.trim() })
              .then(() => undefined)
              .catch(() => false);
          },
        },
      ],
    });
  };

  const btn = (
    label: string,
    onClick: () => void,
    opts: { kind?: string; busy?: boolean } = {},
  ) => (
    <button
      key={label}
      className={`btn ${opts.kind ?? 'btn-secondary'}`}
      disabled={opts.busy}
      onClick={onClick}
    >
      {opts.busy && <span className="btn-spinner" aria-hidden="true" />}
      {label}
    </button>
  );

  const actions: React.ReactNode[] = [];

  if (c.status === 'draft') {
    if (canCreate) {
      actions.push(
        btn('Delete', () =>
          openConfirm({
            title: 'Delete draft',
            message: `Delete “${c.title}”? This can't be undone.`,
            confirmLabel: 'Delete',
            danger: true,
            onConfirm: () =>
              remove
                .mutateAsync(c.id)
                .then(() => router.push('/circulars/manage'))
                .catch(() => false),
          }),
        ),
      );
      actions.push(btn('Edit', onEdit));
    }
    if (canPublish) actions.push(btn('Publish…', handlePublish, { kind: 'btn-primary' }));
  }

  if (c.status === 'scheduled' && canPublish) {
    actions.push(
      btn('Cancel schedule', () => cancelSchedule.mutate(c.id), { busy: cancelSchedule.isPending }),
    );
    actions.push(
      btn('Publish now', () => publish.mutate({ id: c.id }), {
        kind: 'btn-primary',
        busy: publish.isPending,
      }),
    );
  }

  if (
    c.status === 'published' &&
    c.requiresAcknowledgement &&
    canPublish &&
    (c.stats?.outstanding ?? 0) > 0
  ) {
    actions.push(
      btn(`Remind ${c.stats?.outstanding} outstanding`, () => remind.mutate(c.id), {
        busy: remind.isPending,
      }),
    );
  }

  if ((c.status === 'published' || c.status === 'expired') && !c.supersededBy && canCreate) {
    actions.push(
      btn(
        'Revise',
        () =>
          revise
            .mutateAsync(c.id)
            .then((draft) => router.push(`/circulars/manage/${draft.id}`))
            .catch(() => undefined),
        { busy: revise.isPending },
      ),
    );
  }

  if ((c.status === 'published' || c.status === 'expired') && canWithdraw) {
    actions.push(btn('Withdraw…', handleWithdraw, { kind: 'btn-danger' }));
  }

  if (!actions.length) return null;
  return <div className="actions">{actions}</div>;
}

/** Publish now, or schedule for later. Reports its choice up through `onChange`. */
function PublishOptions({ onChange }: { onChange: (mode: 'now' | 'later', at: string) => void }) {
  const [mode, setMode] = useState<'now' | 'later'>('now');
  const [at, setAt] = useState('');

  const update = (m: 'now' | 'later', a: string) => {
    setMode(m);
    setAt(a);
    onChange(m, a);
  };

  return (
    <div>
      <label className="check mb-2">
        <input
          type="radio"
          name="publish-mode"
          checked={mode === 'now'}
          onChange={() => update('now', at)}
        />
        Publish now — recipients are fixed and notified straight away
      </label>
      <label className="check mb-2">
        <input
          type="radio"
          name="publish-mode"
          checked={mode === 'later'}
          onChange={() => update('later', at)}
        />
        Schedule for later
      </label>
      {mode === 'later' && (
        <div className="field" style={{ marginTop: 10 }}>
          <DateTimeField
            value={at}
            onChange={(v) => update('later', v)}
            min={todayStr()}
            aria-label="Publish at"
          />
          <div className="help">Recipients are worked out when it goes out, not now.</div>
        </div>
      )}
    </div>
  );
}

function StatsRow({ circular: c }: { circular: Circular }) {
  const s = c.stats!;
  const kpis: [string, React.ReactNode][] = [
    ['Recipients', s.recipients],
    ['Read', `${s.read}`],
    ...(c.requiresAcknowledgement
      ? ([
          [
            'Acknowledged',
            `${s.acknowledged}${s.acknowledgementRate !== null ? ` · ${s.acknowledgementRate}%` : ''}`,
          ],
          ['Outstanding', s.outstanding],
        ] as [string, React.ReactNode][])
      : ([['Delivered', s.delivered]] as [string, React.ReactNode][])),
  ];

  return (
    <div className={`grid cols-${kpis.length} mb-4`}>
      {kpis.map(([label, value]) => (
        <div key={label} className="card kpi">
          <div className="kv">{value}</div>
          <div className="kl">{label}</div>
        </div>
      ))}
    </div>
  );
}

function DepartmentBreakdown({ circular: c }: { circular: Circular }) {
  const rows = (c.stats?.byDepartment ?? []).map((d) => ({
    ...d,
    key: d.departmentId ?? 'none',
  }));
  type Row = (typeof rows)[number];
  const cols: Column<Row>[] = [
    {
      key: 'departmentName',
      label: 'Department',
      render: (d) => d.departmentName ?? 'No department',
    },
    { key: 'recipients', label: 'Recipients', num: true },
    { key: 'read', label: 'Read', num: true },
    ...(c.requiresAcknowledgement
      ? [
          {
            key: 'acknowledged' as const,
            label: 'Acknowledged',
            render: (d: Row) => {
              const pct = d.recipients ? Math.round((d.acknowledged / d.recipients) * 100) : 0;
              return (
                <div style={{ minWidth: 140 }}>
                  <div className="caption mb-2">
                    {d.acknowledged} of {d.recipients} · {pct}%
                  </div>
                  <div className={`pbar ${pct >= 70 ? 'ok' : 'warn'}`}>
                    <i style={{ width: `${pct}%` }} />
                  </div>
                </div>
              );
            },
          },
        ]
      : []),
  ];

  return (
    <div className="card mb-4">
      <div className="card-head">
        <span className="h3">By department</span>
      </div>
      <Table cols={cols} rows={rows} />
    </div>
  );
}

const RECIPIENT_FILTERS: [CircularRecipientFilter, string][] = [
  ['all', 'All'],
  ['unread', 'Unread'],
  ['read', 'Read'],
  ['outstanding', 'Outstanding'],
  ['acknowledged', 'Acknowledged'],
];

function RecipientsReport({ circular: c }: { circular: Circular }) {
  const [status, setStatus] = useState<CircularRecipientFilter>('all');
  const [search, setSearch] = useState('');
  const [query, setQuery] = useState('');
  const [page, setPage] = useState(1);

  useEffect(() => {
    const t = window.setTimeout(() => {
      setQuery(search.trim());
      setPage(1);
    }, 300);
    return () => window.clearTimeout(t);
  }, [search]);

  const { data, isLoading, isError, refetch } = useCircularRecipients(c.id, {
    status,
    search: query || undefined,
    page,
    limit: 25,
  });

  // Acknowledgement filters 422 on a circular that doesn't ask for it.
  const filters = RECIPIENT_FILTERS.filter(
    ([f]) => c.requiresAcknowledgement || (f !== 'outstanding' && f !== 'acknowledged'),
  );

  const cols: Column<CircularRecipient>[] = [
    {
      key: 'user',
      label: 'Recipient',
      render: (r) => (
        <span>
          <b>{r.user.name}</b>
          <div className="caption">
            {r.user.email}
            {r.user.status !== 'active' ? ` · ${r.user.status}` : ''}
          </div>
        </span>
      ),
    },
    { key: 'department', label: 'Department', render: (r) => r.department?.name ?? '—' },
    {
      key: 'readAt',
      label: 'Read',
      render: (r) => (r.readAt ? fmtDateTime(r.readAt) : <span className="muted">Not yet</span>),
    },
    ...(c.requiresAcknowledgement
      ? [
          {
            key: 'acknowledgedAt' as const,
            label: 'Acknowledged',
            render: (r: CircularRecipient) =>
              r.acknowledgedAt ? (
                fmtDateTime(r.acknowledgedAt)
              ) : (
                <span className="badge b-status-pending">Outstanding</span>
              ),
          },
          {
            key: 'reminderCount' as const,
            label: 'Reminders',
            render: (r: CircularRecipient) =>
              r.reminderCount > 0 ? (
                <span className="caption">
                  {r.reminderCount}
                  {r.lastRemindedAt ? ` · last ${fmtDate(r.lastRemindedAt)}` : ''}
                </span>
              ) : (
                '—'
              ),
          },
        ]
      : []),
  ];

  return (
    <div className="card">
      <div className="card-head flex-wrap">
        <span className="h3">Recipients</span>
        <div className="flex gap-2 flex-wrap items-center">
          <div className="seg" role="group" aria-label="Filter recipients">
            {filters.map(([value, label]) => (
              <button
                key={value}
                className={status === value ? 'active' : ''}
                aria-pressed={status === value}
                onClick={() => {
                  setStatus(value);
                  setPage(1);
                }}
              >
                {label}
              </button>
            ))}
          </div>
          <input
            className="input"
            style={{ width: 200, height: 32 }}
            placeholder="Name or email…"
            aria-label="Search recipients"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
      </div>
      {isLoading ? (
        <SkeletonTable columns={cols.map((col) => col.label)} rows={6} />
      ) : isError ? (
        <div style={{ padding: 24 }}>
          <ErrorMessage message="Failed to load recipients." retry={() => refetch()} />
        </div>
      ) : (
        <>
          <Table cols={cols} rows={data?.data ?? []} emptyMsg="No recipients match." />
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

function BackLink() {
  return (
    <Link
      href="/circulars/manage"
      className="caption flex items-center gap-1 mb-4"
      style={{ width: 'fit-content' }}
    >
      <span style={{ display: 'inline-flex', transform: 'rotate(180deg)' }}>
        <Icon name="chevR" size={12} />
      </span>
      All circulars
    </Link>
  );
}
