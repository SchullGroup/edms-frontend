'use client';

import React, { useEffect } from 'react';
import { useStore } from '@/store/useStore';
import { useUIStore } from '@/store/useUIStore';
import { Table, Column } from '@/components/ui/Table';
import { Icon } from '@/components/ui/Icons';

export default function PlatformSysConfigPage() {
  const { featureFlags, updateFeatureFlag, auditAction } = useStore();
  const { setPageTitle, addToast, openConfirm } = useUIStore();

  useEffect(() => {
    setPageTitle('Platform System Config');
  }, [setPageTitle]);

  const services = [
    { name: 'API Gateway', status: 'ok', uptime: '99.99%', latency: '38 ms' },
    { name: 'Document Store (S3)', status: 'ok', uptime: '99.98%', latency: '61 ms' },
    { name: 'OCR / IDU Pipeline', status: 'warn', uptime: '99.72%', latency: '2.4 s', note: 'Queue depth elevated — autoscaling in progress' },
    { name: 'Search & Indexing', status: 'ok', uptime: '99.95%', latency: '110 ms' },
    { name: 'Signature Service', status: 'ok', uptime: '100%', latency: '95 ms' },
    { name: 'Notification / Email', status: 'ok', uptime: '99.97%', latency: '340 ms' },
    { name: 'AI Semantic Search', status: 'ok', uptime: '99.90%', latency: '420 ms' },
  ];

  const jobs = [
    { job: 'Retention sweep', last: '02:00 today', dur: '14 min', status: 'ok' },
    { job: 'Index rebuild (delta)', last: '03:10 today', dur: '22 min', status: 'ok' },
    { job: 'Usage metering rollup', last: '04:00 today', dur: '6 min', status: 'ok' },
    { job: 'Backup verification', last: 'Yesterday 23:30', dur: '48 min', status: 'warn' },
  ];

  const hasDegradedService = services.some(s => s.status === 'warn');

  const flagCols: Column<any>[] = [
    { key: 'name', label: 'Feature', render: f => (
        <span>
          <b>{f.name}</b>
          <div className="caption">{f.desc}</div>
        </span>
      ) 
    },
    { key: 'stage', label: 'Stage', render: f => {
        const bgClass = { GA: 'b-status-closed', Beta: 'b-status-in-progress', Preview: 'b-status-pending', Internal: 'b-urg-low' }[f.stage as string] || 'b-urg-low';
        return <span className={`badge ${bgClass}`}>{f.stage}</span>;
      } 
    },
    { key: 'rollout', label: 'Rollout', render: f => (
        <div style={{ minWidth: '190px' }}>
          <div className="flex aic g8">
            <input 
              type="range" 
              min={0} max={100} 
              value={f.rollout} 
              style={{ flex: 1, accentColor: 'var(--brand-primary-light)' }} 
              aria-label={f.name + ' rollout'} 
              onChange={(e) => {
                const val = Number(e.target.value);
                updateFeatureFlag(f.id, { rollout: val });
              }}
              onMouseUp={() => {
                auditAction('FLAG_ROLLOUT', f.id, `${f.name} → ${f.rollout}%`);
                addToast(`${f.name} rollout set to ${f.rollout}% of tenants`, 'success');
              }}
            />
            <span className="tnum" style={{ fontWeight: 700, width: '40px' }}>{f.rollout}%</span>
          </div>
        </div>
      ) 
    },
    { key: 'act', label: '', render: f => (
        <div className="flex g8">
          {f.rollout < 100 && (
            <button className="btn btn-secondary btn-sm" onClick={(e) => {
              e.stopPropagation();
              openConfirm?.({
                title: `Promote “${f.name}” to 100%?`,
                message: 'The feature becomes available to all tenants. Staged rollback remains possible.',
                confirmLabel: 'Promote to GA',
                onConfirm: () => {
                  updateFeatureFlag(f.id, { rollout: 100, stage: 'GA' });
                  auditAction('FLAG_GA', f.id, f.name + ' promoted to GA');
                  addToast(f.name + ' is now GA', 'success');
                }
              });
            }}>Promote</button>
          )}
          <button className="btn btn-secondary btn-sm" onClick={(e) => {
            e.stopPropagation();
            openConfirm?.({
              title: `Kill-switch “${f.name}”?`,
              message: 'Immediately disables the feature for all tenants. Use for incidents; the flag stage resets to Internal.',
              confirmLabel: 'Disable everywhere',
              danger: true,
              onConfirm: () => {
                updateFeatureFlag(f.id, { rollout: 0, stage: 'Internal' });
                auditAction('FLAG_KILL', f.id, f.name + ' kill-switched');
                addToast(f.name + ' disabled everywhere', 'warning');
              }
            });
          }}>Kill</button>
        </div>
      ) 
    },
  ];

  const serviceCols: Column<any>[] = [
    { key: 'name', label: 'Service', render: s => (
        <span>
          <b>{s.name}</b>
          {s.note && <div className="caption">{s.note}</div>}
        </span>
      ) 
    },
    { key: 'status', label: 'Status', render: s => (
        <span className={`health ${s.status}`}>
          <span className="hd"></span>{s.status === 'ok' ? 'Operational' : 'Degraded'}
        </span>
      ) 
    },
    { key: 'uptime', label: 'Uptime (30d)', sortable: true },
    { key: 'latency', label: 'p95 latency', sortable: true },
  ];

  const jobCols: Column<any>[] = [
    { key: 'job', label: 'Job', render: j => <b>{j.job}</b> },
    { key: 'last', label: 'Last run' },
    { key: 'dur', label: 'Duration' },
    { key: 'status', label: '', render: j => (
        <span className={`health ${j.status}`}>
          <span className="hd"></span>{j.status === 'ok' ? 'OK' : 'Check'}
        </span>
      ) 
    },
    { key: 'act', label: '', render: j => (
        <button className="btn btn-secondary btn-sm" onClick={(e) => {
          e.stopPropagation();
          auditAction('JOB_RUN', j.job, 'Manually triggered');
          addToast(`“${j.job}” queued for immediate run`, 'success');
        }}>Run now</button>
      ) 
    },
  ];

  return (
    <div>
      <div className="page-head" style={{ marginBottom: '16px' }}>
        <div>
          <div className="page-title">Platform Health & System Config</div>
          <div className="page-sub">Uptime, background jobs, queues, AI service status, and feature flags.</div>
        </div>
      </div>

      <div className={`banner ${hasDegradedService ? 'warning' : 'success'}`} style={{ marginBottom: '24px' }}>
        <span style={{ display: 'inline-flex', marginRight: '8px' }}><Icon name="pulse" size={15} /></span>
        {hasDegradedService 
          ? 'Partial degradation: OCR/IDU queue depth elevated. No customer-facing impact expected; autoscaling engaged.' 
          : 'All systems operational.'}
      </div>

      <div className="grid cols-4 mb16">
        {[
          ['99.96%', 'Platform uptime (30d)'],
          ['1.2 M', 'API calls today'],
          ['418', 'Jobs in OCR queue'],
          ['0', 'Open incidents']
        ].map(([v, l], i) => (
          <div key={i} className="card kpi">
            <div className="kv">{v}</div>
            <div className="kl">{l}</div>
          </div>
        ))}
      </div>

      <div className="grid cols-2 mb24" style={{ alignItems: 'start' }}>
        <div className="card">
          <div className="card-head">
            <span className="h3">Services</span>
          </div>
          <Table cols={serviceCols} rows={services} />
        </div>
        <div className="card">
          <div className="card-head">
            <span className="h3">Scheduled jobs</span>
          </div>
          <Table cols={jobCols} rows={jobs} />
        </div>
      </div>

      <div className="page-head" style={{ marginTop: '32px', marginBottom: '16px' }}>
        <div>
          <div className="page-title">Feature Flags & Rollouts</div>
          <div className="page-sub">Staged rollouts by percentage of tenants, with promote and kill-switch controls.</div>
        </div>
      </div>

      <div className="card">
        <Table cols={flagCols} rows={featureFlags || []} />
      </div>
    </div>
  );
}
