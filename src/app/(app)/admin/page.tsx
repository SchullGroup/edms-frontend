'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useUIStore } from '@/store/useUIStore';
// import { useStore } from '@/store/useStore';
import { useUsers } from '@/apis/hooks/useUsers';
import { useCabinets } from '@/apis/hooks/useCabinets';
import { useWorkflows } from '@/apis/hooks/useWorkflows';
import { Icon } from '@/components/ui/Icons';

export default function AdminDashboard() {
  const router = useRouter();
  const { setPageTitle } = useUIStore();
  const { data: usersData } = useUsers();
  const { data: cabinetsData } = useCabinets();
  const { data: workflowsData } = useWorkflows({
    status: 'published',
  });

  const users = usersData?.pagination?.total || 0;
  const cabinets = cabinetsData?.data || [];
  const publishedWorkflows = workflowsData?.pagination?.total || 0;

  useEffect(() => {
    setPageTitle('Admin Home');
  }, [setPageTitle]);

  // not integrated with backend yet, so hardcoding for now
  const setup = [
    { label: 'Cabinets & metadata schemas', done: true, to: '/admin/cabinets' },
    { label: 'Users invited & roles assigned', done: true, to: '/admin/users' },
    { label: 'Workflows published', done: true, to: '/admin/workflows' },
    { label: 'Confidentiality & retention policies', done: true, to: '/admin/policies' },
    { label: 'SSO enrolment (2 users outstanding)', done: false, to: '/admin/users' },
    { label: 'Branding & email templates', done: false, to: '/admin/branding' },
  ];
  const pct = Math.round((setup.filter((s) => s.done).length / setup.length) * 100);

  // not integrated with backend yet, so hardcoding for now
  const pendingTasks = [
    {
      t: 'Approve workflow change request from D. Adeyemi (Invoice Approval v5 draft)',
      to: '/admin/workflows',
    },
    { t: 'Review 3 stale accounts flagged by audit (FND-2026-011)', to: '/admin/users' },
    { t: 'Publish Q3 records retention update to Policies', to: '/admin/policies' },
  ];

  return (
    <div>
      <div className="page-head">
        <div>
          <div className="page-title">Admin Home</div>
          <div className="page-sub">Tenant setup health and pending configuration tasks.</div>
        </div>
      </div>

      <div className="grid cols-4 mb16">
        <div className="card kpi">
          <div className="kv">{users}</div>
          <div className="kl">Users</div>
          <div className="kd up">▲ +2 this month</div>
        </div>
        <div className="card kpi">
          <div className="kv">{cabinets.length}</div>
          <div className="kl">Cabinets</div>
        </div>
        <div className="card kpi">
          <div className="kv">{publishedWorkflows}</div>
          <div className="kl">Published workflows</div>
        </div>
        <div className="card kpi">
          <div className="kv">812 GB</div>
          <div className="kl">Storage used of 1 TB</div>
          <div className="mt8">
            <div className="pbar warn">
              <i style={{ width: '79%' }}></i>
            </div>
          </div>
        </div>
      </div>

      <div className="grid cols-2" style={{ alignItems: 'start' }}>
        <div className="card">
          <div className="card-head">
            <span className="h3">Setup health</span>
            <b
              className="tnum"
              style={{ color: pct === 100 ? 'var(--status-closed)' : 'var(--status-pending)' }}
            >
              {pct}%
            </b>
          </div>
          <div className="card-body">
            <div className={`pbar ${pct === 100 ? 'ok' : 'warn'}`} style={{ marginBottom: '14px' }}>
              <i style={{ width: pct + '%' }}></i>
            </div>
            {setup.map((s, i) => (
              <div
                key={i}
                className="metric-li"
                style={{ cursor: 'pointer' }}
                onClick={() => router.push(s.to)}
              >
                <span className="flex aic g8">
                  <span
                    style={{ color: s.done ? 'var(--status-closed)' : 'var(--status-pending)' }}
                  >
                    <Icon name={s.done ? 'check' : 'clock'} size={14} />
                  </span>
                  {s.label}
                </span>
                <span className="caption">{s.done ? 'Done' : 'Pending →'}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="card">
          <div className="card-head">
            <span className="h3">Pending configuration tasks</span>
          </div>
          <div className="card-body" style={{ paddingTop: '6px' }}>
            {pendingTasks.map((p, i) => (
              <div
                key={i}
                className="metric-li"
                style={{ cursor: 'pointer' }}
                onClick={() => router.push(p.to)}
              >
                <span style={{ lineHeight: 1.5 }}>{p.t}</span>
                <span className="caption">Open →</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
