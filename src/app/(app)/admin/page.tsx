'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useUIStore } from '@/store/useUIStore';
// import { useStore } from '@/store/useStore';
import { useUsers } from '@/apis/hooks/useUsers';
import { useCabinets } from '@/apis/hooks/useCabinets';
import { useWorkflows } from '@/apis/hooks/useWorkflows';
import { useDepartments } from '@/apis/hooks/useDepartments';
import { useAccessRequestsInbox } from '@/apis/hooks/useDocuments';
import { Icon } from '@/components/ui/Icons';
import { QuickAccessCard } from '@/components/dashboard/QuickAccessCard';

export default function AdminDashboard() {
  const router = useRouter();
  const { setPageTitle } = useUIStore();
  const { data: usersData } = useUsers();
  const { data: cabinetsData } = useCabinets();
  const { data: workflowsData } = useWorkflows({
    status: 'published',
  });

  const { data: draftsData } = useWorkflows({ status: 'draft' });
  const { data: departmentsData } = useDepartments();
  const { data: accessRequestsData } = useAccessRequestsInbox({ status: 'pending', limit: 1 });

  const users = usersData?.pagination?.total || 0;
  const cabinets = cabinetsData?.data || [];
  const publishedWorkflows = workflowsData?.pagination?.total || 0;
  const draftWorkflows = draftsData?.pagination?.total || 0;
  const departments = departmentsData?.data?.length ?? 0;
  const pendingAccessRequests = accessRequestsData?.pagination?.total || 0;
  // Documents can only be filed into a folder, so a cabinet without one can't be used.
  const cabinetsWithoutFolders = cabinets.filter((c: any) => !(c._count?.folders > 0)).length;
  const loaded = !!usersData && !!cabinetsData && !!workflowsData && !!departmentsData;

  useEffect(() => {
    setPageTitle('Admin Home');
  }, [setPageTitle]);

  // The tenant setup chain from docs/03 (Phases 2–6), each step checked
  // against live data.
  const setup = [
    { label: 'Departments set up', done: departments > 0, to: '/admin/departments' },
    { label: 'Cabinets created', done: cabinets.length > 0, to: '/admin/cabinets' },
    {
      label:
        cabinetsWithoutFolders > 0
          ? `Folders in every cabinet (${cabinetsWithoutFolders} without one)`
          : 'Folders in every cabinet',
      done: cabinets.length > 0 && cabinetsWithoutFolders === 0,
      to: '/staff/cabinets',
    },
    { label: 'Users added and given roles', done: users > 1, to: '/admin/users' },
    { label: 'A workflow published', done: publishedWorkflows > 0, to: '/admin/workflows' },
  ];
  const pct = Math.round((setup.filter((s) => s.done).length / setup.length) * 100);

  const pendingTasks = [
    pendingAccessRequests > 0 && {
      t: `${pendingAccessRequests} document access request${pendingAccessRequests === 1 ? '' : 's'} waiting for a decision`,
      to: '/admin/access-requests',
    },
    draftWorkflows > 0 && {
      t: `${draftWorkflows} workflow draft${draftWorkflows === 1 ? '' : 's'} not yet published`,
      to: '/admin/workflows',
    },
    cabinetsWithoutFolders > 0 && {
      t: `${cabinetsWithoutFolders} cabinet${cabinetsWithoutFolders === 1 ? ' has' : 's have'} no folders, so nothing can be filed there`,
      to: '/staff/cabinets',
    },
  ].filter(Boolean) as { t: string; to: string }[];

  return (
    <div>
      <div className="page-head">
        <div>
          <div className="page-title">Admin Home</div>
          <div className="page-sub">Tenant setup health and pending configuration tasks.</div>
        </div>
      </div>

      <div className="grid cols-4 mb-4">
        <div className="card kpi">
          <div className="kv">{users}</div>
          <div className="kl">Users</div>
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
          <div className="kv">{departments}</div>
          <div className="kl">Departments</div>
        </div>
      </div>

      <div className="grid cols-2" style={{ alignItems: 'start' }}>
        <div className="card">
          <div className="card-head">
            <span className="h3">Setup health</span>
            <b
              className="tabular-nums"
              style={{ color: pct === 100 ? 'var(--status-closed)' : 'var(--status-pending)' }}
            >
              {loaded ? `${pct}%` : '—'}
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
                <span className="flex items-center gap-2">
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
            {pendingTasks.length === 0 && (
              <p className="caption" style={{ padding: '10px 0' }}>
                Nothing waiting on you.
              </p>
            )}
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
      <div className="mt-4">
        <QuickAccessCard showActions={false} />
      </div>
    </div>
  );
}
