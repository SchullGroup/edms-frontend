'use client';

import React, { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useStore } from '@/store/useStore';
import { useUIStore } from '@/store/useUIStore';
import { useTasks } from '@/apis/hooks/useTasks';
import { useWorkflowInstanceStatusCounts } from '@/apis/hooks/useWorkflowInstances';
import { Icon } from '@/components/ui/Icons';
import { QuickAccessCard } from '@/components/dashboard/QuickAccessCard';
import { MyTasksCard } from '@/components/dashboard/MyTasksCard';

export default function StaffDashboard() {
  const router = useRouter();
  const { currentUser } = useStore();
  const { setPageTitle } = useUIStore();

  useEffect(() => {
    setPageTitle('Dashboard');
  }, [setPageTitle]);

  // Status tiles are file/workflow-instance counts (per the Workflow Module API
  // guide, §5.2) — a different lens from the My Tasks card below. `inProgress`
  // already includes on_hold; don't add it again.
  const { data: statusCounts } = useWorkflowInstanceStatusCounts('mine');
  // Overdue = my active tasks holding a document past its stage deadline. Same
  // query as the /staff/workflows Overdue tab, so the tile and that list agree.
  const { data: overdueTasks } = useTasks({ scope: 'mine', overdue: true, limit: 1 });

  if (!currentUser) return null;

  const counts: Record<string, number> = {
    Pending: statusCounts?.pending ?? 0,
    'In Progress': statusCounts?.inProgress ?? 0,
    Closed: statusCounts?.closed ?? 0,
    Overdue: overdueTasks?.pagination?.total ?? 0,
  };

  // Each tile opens its own list on /staff/workflows.
  const tileDefs = [
    { key: 'Pending', cls: 't-pending', icon: 'clock', status: 'pending' },
    { key: 'In Progress', cls: 't-progress', icon: 'pulse', status: 'in_progress' },
    { key: 'Closed', cls: 't-closed', icon: 'check', status: 'closed' },
    { key: 'Overdue', cls: 't-overdue', icon: 'alert', status: 'overdue' },
  ];

  const hour = new Date().getHours();
  const greet = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening';

  return (
    <div>
      <div className="page-head">
        <div>
          <div className="page-title">{`${greet}, ${currentUser.name.split(' ')[0]}`}</div>
        </div>
        <div className="actions">
          <button className="btn btn-secondary" onClick={() => router.push('/search')}>
            <Icon name="search" size={15} /> Search
          </button>
          <button className="btn btn-accent" onClick={() => router.push('/upload')}>
            <Icon name="upload" size={15} /> Upload document
          </button>
        </div>
      </div>

      <div className="grid cols-4" style={{ marginBottom: '16px' }}>
        {tileDefs.map((t) => (
          <div
            key={t.key}
            className={`tile ${t.cls}`}
            tabIndex={0}
            role="link"
            aria-label={`${t.key}: ${counts[t.key]}`}
            onClick={() => router.push(`/staff/workflows?status=${t.status}`)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') router.push(`/staff/workflows?status=${t.status}`);
            }}
          >
            <div className="cnt">{counts[t.key]}</div>
            <div className="lbl">
              <Icon name={t.icon} size={13} /> {t.key}
            </div>
          </div>
        ))}
      </div>

      <div className="grid gap-4">
        <QuickAccessCard />

        <MyTasksCard />
      </div>
    </div>
  );
}
