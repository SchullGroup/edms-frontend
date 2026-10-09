'use client';

import React, { useEffect } from 'react';
import { useStore } from '@/store/useStore';
import { useUIStore } from '@/store/useUIStore';
import { Table, Column } from '@/components/ui/Table';

// Feature flags have no backend yet (doc 05 backlog #34), so this reads and writes the
// SEED `featureFlags` in the store.
export default function PlatformFlagsPage() {
  const { featureFlags, updateFeatureFlag, auditAction } = useStore();
  const { setPageTitle, addToast, openConfirm } = useUIStore();

  useEffect(() => {
    setPageTitle('Feature Flags');
  }, [setPageTitle]);

  const flagCols: Column<any>[] = [
    {
      key: 'name',
      label: 'Feature',
      render: (f) => (
        <span>
          <b>{f.name}</b>
          <div className="caption">{f.desc}</div>
        </span>
      ),
    },
    {
      key: 'stage',
      label: 'Stage',
      render: (f) => {
        const bgClass =
          {
            GA: 'b-status-closed',
            Beta: 'b-status-in-progress',
            Preview: 'b-status-pending',
            Internal: 'b-urg-low',
          }[f.stage as string] || 'b-urg-low';
        return <span className={`badge ${bgClass}`}>{f.stage}</span>;
      },
    },
    {
      key: 'rollout',
      label: 'Rollout',
      render: (f) => (
        <div style={{ minWidth: '190px' }}>
          <div className="flex items-center gap-2">
            <input
              type="range"
              min={0}
              max={100}
              value={f.rollout}
              style={{ flex: 1, accentColor: 'var(--brand-primary-light)' }}
              aria-label={f.name + ' rollout'}
              onChange={(e) => updateFeatureFlag(f.id, { rollout: Number(e.target.value) })}
              onMouseUp={() => {
                auditAction('FLAG_ROLLOUT', f.id, `${f.name} → ${f.rollout}%`);
                addToast(`${f.name} rollout set to ${f.rollout}% of tenants`, 'success');
              }}
            />
            <span className="tabular-nums" style={{ fontWeight: 700, width: '40px' }}>
              {f.rollout}%
            </span>
          </div>
        </div>
      ),
    },
    {
      key: 'act',
      label: '',
      render: (f) => (
        <div className="flex gap-2">
          {f.rollout < 100 && (
            <button
              className="btn btn-secondary btn-sm"
              onClick={(e) => {
                e.stopPropagation();
                openConfirm?.({
                  title: `Promote “${f.name}” to 100%?`,
                  message:
                    'The feature becomes available to all tenants. Staged rollback remains possible.',
                  confirmLabel: 'Promote to GA',
                  onConfirm: () => {
                    updateFeatureFlag(f.id, { rollout: 100, stage: 'GA' });
                    auditAction('FLAG_GA', f.id, f.name + ' promoted to GA');
                    addToast(f.name + ' is now GA', 'success');
                  },
                });
              }}
            >
              Promote
            </button>
          )}
          <button
            className="btn btn-secondary btn-sm"
            onClick={(e) => {
              e.stopPropagation();
              openConfirm?.({
                title: `Kill-switch “${f.name}”?`,
                message:
                  'Immediately disables the feature for all tenants. Use for incidents; the flag stage resets to Internal.',
                confirmLabel: 'Disable everywhere',
                danger: true,
                onConfirm: () => {
                  updateFeatureFlag(f.id, { rollout: 0, stage: 'Internal' });
                  auditAction('FLAG_KILL', f.id, f.name + ' kill-switched');
                  addToast(f.name + ' disabled everywhere', 'warning');
                },
              });
            }}
          >
            Kill
          </button>
        </div>
      ),
    },
  ];

  return (
    <div>
      <div className="page-head" style={{ marginBottom: '16px' }}>
        <div>
          <div className="page-title">Feature Flags &amp; Rollouts</div>
          <div className="page-sub">
            Staged rollouts by percentage of tenants, with promote and kill-switch controls.
          </div>
        </div>
      </div>

      <div className="card">
        <Table cols={flagCols} rows={featureFlags || []} />
      </div>
    </div>
  );
}
