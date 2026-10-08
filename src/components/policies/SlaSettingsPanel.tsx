'use client';

import React, { useEffect, useState } from 'react';
import {
  useCreateSlaHoliday,
  useDeleteSlaHoliday,
  useSlaConfiguration,
  useSlaHolidays,
  useUpdateSlaConfiguration,
} from '@/apis/hooks/useSla';
import { usePermissions } from '@/hooks/usePermissions';
import { useUIStore } from '@/store/useUIStore';
import { UrgBadge } from '@/components/ui/Badges';
import { DateField } from '@/components/ui/DatePicker';
import { Icon } from '@/components/ui/Icons';
import { SkeletonText } from '@/components/common/Skeleton';
import { ErrorMessage } from '@/components/common/ErrorMessage';
import { fmtDate } from '@/utils/helpers';
import type { SlaBreachAction, SlaConfiguration, SlaConfigurationUpdate } from '@/types/models';

type Draft = Omit<SlaConfiguration, 'id'>;

// ISO weekdays, as the backend stores them.
const WEEKDAYS = [
  { value: 1, label: 'Mon' },
  { value: 2, label: 'Tue' },
  { value: 3, label: 'Wed' },
  { value: 4, label: 'Thu' },
  { value: 5, label: 'Fri' },
  { value: 6, label: 'Sat' },
  { value: 7, label: 'Sun' },
];

const BREACH_ACTIONS: { value: SlaBreachAction; label: string }[] = [
  { value: 'flag', label: 'Record the breach only' },
  { value: 'notify_supervisor', label: "Notify the department's supervisors" },
  { value: 'escalate', label: 'Notify supervisors and escalate the task' },
];

const MULTIPLIERS = [
  { key: 'criticalUrgencyMultiplier', level: 'critical' },
  { key: 'highUrgencyMultiplier', level: 'high' },
  { key: 'normalUrgencyMultiplier', level: 'normal' },
  { key: 'lowUrgencyMultiplier', level: 'low' },
] as const;

/** Every IANA zone the browser knows, or just the current one if it can't list them. */
function timeZones(current: string): string[] {
  const list: string[] =
    typeof Intl !== 'undefined' && 'supportedValuesOf' in Intl
      ? (Intl as unknown as { supportedValuesOf: (k: string) => string[] }).supportedValuesOf(
          'timeZone',
        )
      : [];
  return list.includes(current) ? list : [current, ...list];
}

/** Only the fields that differ from what's saved — the API takes a partial update. */
function changes(saved: SlaConfiguration, draft: Draft): SlaConfigurationUpdate {
  const out: Record<string, unknown> = {};
  for (const key of Object.keys(draft) as (keyof Draft)[]) {
    if (JSON.stringify(draft[key]) !== JSON.stringify(saved[key])) out[key] = draft[key];
  }
  return out as SlaConfigurationUpdate;
}

/**
 * The tenant's SLA policy (`/sla/configuration`, `/sla/holidays`): how stage
 * deadlines are counted, when the warning goes out, what a breach does, and the
 * urgency multipliers. Reading needs `workflow:view`, saving `workflow:edit`.
 */
export function SlaSettingsPanel() {
  const { can } = usePermissions();
  const canEdit = can('workflow', 'edit');
  const { data: saved, isLoading, isError, refetch } = useSlaConfiguration();
  const update = useUpdateSlaConfiguration();
  const [draft, setDraft] = useState<Draft | null>(null);

  // Resync whenever the saved policy changes (first load, or a save landing).
  useEffect(() => {
    if (!saved) return;
    const { id: _id, ...rest } = saved;
    setDraft(rest);
  }, [saved]);

  if (isLoading || (saved && !draft)) {
    return (
      <div className="card card-pad">
        <SkeletonText lines={6} />
      </div>
    );
  }
  if (isError || !saved || !draft) {
    return <ErrorMessage message="Failed to load SLA settings." retry={refetch} />;
  }

  const set = (patch: Partial<Draft>) => setDraft({ ...draft, ...patch });
  const pending = changes(saved, draft);
  const dirty = Object.keys(pending).length > 0;
  const hoursInvalid = draft.businessHoursEnabled && draft.workStart >= draft.workEnd;
  const noDays = draft.businessHoursEnabled && draft.workingDays.length === 0;
  const badMultiplier = MULTIPLIERS.some((m) => !(draft[m.key] > 0));
  const badWarning = !(draft.warningHours >= 0 && draft.warningHours <= 720);
  const invalid = hoursInvalid || noDays || badMultiplier || badWarning;

  const toggleDay = (day: number) =>
    set({
      workingDays: draft.workingDays.includes(day)
        ? draft.workingDays.filter((d) => d !== day)
        : [...draft.workingDays, day].sort((a, b) => a - b),
    });

  return (
    <div className="grid" style={{ gap: '16px' }}>
      <div className="banner info">
        A stage&rsquo;s deadline is its SLA hours (set per stage in the Workflow Designer) times the
        document&rsquo;s urgency multiplier. Changes here apply to deadlines set from now on; stages
        already under way keep theirs.
      </div>

      <div className="card">
        <div className="card-head">
          <span className="h3">How deadlines are counted</span>
        </div>
        <div className="card-body grid" style={{ gap: '14px' }}>
          <div className="field" style={{ marginBottom: 0, maxWidth: 320 }}>
            <label htmlFor="sla-tz">Time zone</label>
            <select
              id="sla-tz"
              className="input"
              value={draft.timezone}
              disabled={!canEdit}
              onChange={(e) => set({ timezone: e.target.value })}
            >
              {timeZones(draft.timezone).map((tz) => (
                <option key={tz} value={tz}>
                  {tz}
                </option>
              ))}
            </select>
          </div>

          <label className="check">
            <input
              type="checkbox"
              checked={draft.businessHoursEnabled}
              disabled={!canEdit}
              onChange={(e) => set({ businessHoursEnabled: e.target.checked })}
            />
            Count working hours only
          </label>
          <div className="help" style={{ marginTop: '-8px' }}>
            Off: a 24-hour SLA is 24 hours on the clock, nights and weekends included.
          </div>

          {draft.businessHoursEnabled && (
            <div className="grid" style={{ gap: '12px', paddingLeft: '23px' }}>
              <div>
                <div className="caption mb-2">Working days</div>
                <div className="flex gap-2" style={{ flexWrap: 'wrap' }}>
                  {WEEKDAYS.map((d) => {
                    const on = draft.workingDays.includes(d.value);
                    return (
                      <button
                        key={d.value}
                        type="button"
                        className={`btn btn-sm ${on ? 'btn-primary' : 'btn-secondary'}`}
                        aria-pressed={on}
                        disabled={!canEdit}
                        onClick={() => toggleDay(d.value)}
                      >
                        {d.label}
                      </button>
                    );
                  })}
                </div>
                {noDays && (
                  <div className="err" style={{ display: 'block' }}>
                    Pick at least one working day.
                  </div>
                )}
              </div>
              <div className="flex gap-4 items-end" style={{ flexWrap: 'wrap' }}>
                <div className="field" style={{ marginBottom: 0 }}>
                  <label htmlFor="sla-start">Day starts</label>
                  <input
                    id="sla-start"
                    className="input"
                    type="time"
                    value={draft.workStart}
                    disabled={!canEdit}
                    onChange={(e) => set({ workStart: e.target.value })}
                  />
                </div>
                <div className="field" style={{ marginBottom: 0 }}>
                  <label htmlFor="sla-end">Day ends</label>
                  <input
                    id="sla-end"
                    className="input"
                    type="time"
                    value={draft.workEnd}
                    disabled={!canEdit}
                    onChange={(e) => set({ workEnd: e.target.value })}
                  />
                </div>
              </div>
              {hoursInvalid && (
                <div className="err" style={{ display: 'block' }}>
                  The day has to end after it starts.
                </div>
              )}
              <label className="check">
                <input
                  type="checkbox"
                  checked={draft.excludeHolidays}
                  disabled={!canEdit}
                  onChange={(e) => set({ excludeHolidays: e.target.checked })}
                />
                Skip the holidays listed below
              </label>
            </div>
          )}
        </div>
      </div>

      <div className="card">
        <div className="card-head">
          <span className="h3">Warnings and breaches</span>
        </div>
        <div className="card-body flex gap-4 items-start" style={{ flexWrap: 'wrap' }}>
          <div className="field" style={{ marginBottom: 0, width: 220 }}>
            <label htmlFor="sla-warn">Warn this many hours before</label>
            <input
              id="sla-warn"
              className="input"
              type="number"
              min={0}
              max={720}
              step={0.5}
              value={Number.isFinite(draft.warningHours) ? draft.warningHours : ''}
              disabled={!canEdit}
              onChange={(e) => set({ warningHours: e.target.valueAsNumber })}
            />
            <div className="help">The assignee is notified. 0 turns warnings off.</div>
            {badWarning && (
              <div className="err" style={{ display: 'block' }}>
                Enter 0 to 720 hours.
              </div>
            )}
          </div>
          <div className="field" style={{ marginBottom: 0, width: 320 }}>
            <label htmlFor="sla-breach">When a deadline passes</label>
            <select
              id="sla-breach"
              className="input"
              value={draft.breachAction}
              disabled={!canEdit}
              onChange={(e) => set({ breachAction: e.target.value as SlaBreachAction })}
            >
              {BREACH_ACTIONS.map((a) => (
                <option key={a.value} value={a.value}>
                  {a.label}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      <div className="card">
        <div className="card-head">
          <span className="h3">Urgency multipliers</span>
        </div>
        <div className="card-body">
          <div className="help mb-4">
            Below 1 shortens the deadline, above 1 lengthens it. The example is a 24-hour stage.
          </div>
          <div className="grid cols-4" style={{ gap: '12px' }}>
            {MULTIPLIERS.map((m) => {
              const value = draft[m.key];
              const ok = value > 0;
              return (
                <div key={m.key} className="field" style={{ marginBottom: 0 }}>
                  <label htmlFor={`sla-${m.level}`}>
                    <UrgBadge level={m.level} />
                  </label>
                  <input
                    id={`sla-${m.level}`}
                    className="input"
                    type="number"
                    min={0.05}
                    step={0.05}
                    value={Number.isFinite(value) ? value : ''}
                    disabled={!canEdit}
                    onChange={(e) => set({ [m.key]: e.target.valueAsNumber } as Partial<Draft>)}
                  />
                  <div className={ok ? 'help' : 'err'} style={{ display: 'block' }}>
                    {ok ? `24 h stage → ${+(24 * value).toFixed(1)} h` : 'Must be more than 0'}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {canEdit && (
        <div className="flex gap-2" style={{ justifyContent: 'flex-end' }}>
          <button
            className="btn btn-secondary"
            disabled={!dirty || update.isPending}
            onClick={() => {
              const { id: _id, ...rest } = saved;
              setDraft(rest);
            }}
          >
            Discard
          </button>
          <button
            className="btn btn-primary"
            disabled={!dirty || invalid || update.isPending}
            onClick={() => update.mutate(pending)}
          >
            {update.isPending ? 'Saving…' : 'Save SLA settings'}
          </button>
        </div>
      )}

      <SlaHolidaysCard
        canEdit={canEdit}
        counted={draft.businessHoursEnabled && draft.excludeHolidays}
      />
    </div>
  );
}

function SlaHolidaysCard({ canEdit, counted }: { canEdit: boolean; counted: boolean }) {
  const { openConfirm } = useUIStore();
  const { data: holidays, isLoading, isError, refetch } = useSlaHolidays();
  const create = useCreateSlaHoliday();
  const remove = useDeleteSlaHoliday();
  const [date, setDate] = useState('');
  const [name, setName] = useState('');

  const sorted = (holidays ?? []).slice().sort((a, b) => a.date.localeCompare(b.date));

  return (
    <div className="card">
      <div className="card-head">
        <span className="h3">Holidays</span>
      </div>
      <div className="card-body">
        <div className="help mb-4">
          {counted
            ? 'No working hours are counted on these days.'
            : 'Only used when deadlines count working hours and skip holidays (above).'}
        </div>
        {canEdit && (
          <div className="flex gap-2 items-end mb-4" style={{ flexWrap: 'wrap' }}>
            <div className="field" style={{ marginBottom: 0 }}>
              <label>Date</label>
              <DateField value={date} onChange={setDate} style={{ width: '170px' }} />
            </div>
            <div className="field" style={{ marginBottom: 0, flex: 1, minWidth: 200 }}>
              <label htmlFor="sla-holiday-name">Name</label>
              <input
                id="sla-holiday-name"
                className="input"
                placeholder="e.g. Independence Day"
                maxLength={120}
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
            </div>
            <button
              className="btn btn-secondary"
              disabled={!date || !name.trim() || create.isPending}
              onClick={() =>
                create.mutate(
                  { date, name: name.trim() },
                  {
                    onSuccess: () => {
                      setDate('');
                      setName('');
                    },
                  },
                )
              }
            >
              <Icon name="plus" size={14} /> Add holiday
            </button>
          </div>
        )}
        {isLoading ? (
          <SkeletonText lines={3} />
        ) : isError ? (
          <ErrorMessage message="Failed to load holidays." retry={refetch} />
        ) : sorted.length ? (
          <div className="rowlist">
            {sorted.map((h) => (
              <div key={h.id} className="meta-row">
                <span className="k">{fmtDate(`${h.date.slice(0, 10)}T00:00:00`)}</span>
                <span className="v flex items-center gap-2">
                  {h.name}
                  {canEdit && (
                    <button
                      className="btn btn-ghost btn-sm"
                      aria-label={`Remove ${h.name}`}
                      onClick={() =>
                        openConfirm({
                          title: `Remove “${h.name}”?`,
                          message:
                            'Deadlines set from now on will count working hours on this day.',
                          confirmLabel: 'Remove',
                          danger: true,
                          onConfirm: () => remove.mutateAsync(h.id),
                        })
                      }
                    >
                      <Icon name="x" size={12} />
                    </button>
                  )}
                </span>
              </div>
            ))}
          </div>
        ) : (
          <p className="caption">No holidays yet.</p>
        )}
      </div>
    </div>
  );
}
