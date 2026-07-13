'use client';

import React, { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useStore, userById } from '@/store/useStore';
import { useUIStore } from '@/store/useUIStore';
import { Icon } from '@/components/ui/Icons';
import { Table, Column } from '@/components/ui/Table';
import { Avatar } from '@/components/ui/Avatar';
import { HBarChart } from '@/components/ui/Charts';
import { effStatus } from '@/utils/helpers';

const TEAM = ['u-chika', 'u-ngozi', 'u-tunde', 'u-amara', 'u-seun'];

export default function SupervisorDashboard() {
  const router = useRouter();
  const { documents, users, cabinets } = useStore();
  const { setPageTitle, openModal, closeModal } = useUIStore();

  useEffect(() => {
    setPageTitle('Team Overview');
  }, [setPageTitle]);

  const teamDocs = documents.filter((d) => TEAM.includes(d.assignee) || d.assignee === 'u-david');
  const count = (arr: any[], st: string) => arr.filter((d) => effStatus(d) === st).length;

  const tiles = [
    { label: 'Pending', val: count(teamDocs, 'Pending'), cls: 't-pending', ico: 'clock' },
    { label: 'In Progress', val: count(teamDocs, 'In Progress'), cls: 't-progress', ico: 'pulse' },
    {
      label: 'Closed (30d)',
      val: teamDocs.filter((d) => d.status === 'Closed').length,
      cls: 't-closed',
      ico: 'check',
    },
    { label: 'Overdue / SLA', val: count(teamDocs, 'Overdue'), cls: 't-overdue', ico: 'alert' },
  ];

  const matrix = TEAM.map((uid) => {
    const u = userById(users, uid);
    const md = documents.filter((d) => d.assignee === uid);
    return {
      uid,
      name: u?.name || 'Unknown',
      dept: u?.dept || '',
      pending: count(md, 'Pending'),
      progress: count(md, 'In Progress'),
      overdue: count(md, 'Overdue'),
      closed: md.filter((d) => d.status === 'Closed').length,
      total: md.length,
    };
  });

  const byCab = cabinets
    .map((c) => ({
      label: c.name,
      value: teamDocs.filter((d) => d.cabinet === c.id && d.status !== 'Closed').length,
      color: 'var(--brand-primary-light)',
      onClick: () => router.push(`/cabinets?cab=${c.id}`),
    }))
    .filter((c) => c.value > 0);

  const handleRowClick = (r: any) => {
    // Show drawer/modal for member
    openModal({
      title: `${r.name} — open items`,
      body: (
        <div>
          <div className="flex aic g12 mb16">
            <Avatar user={{ name: r.name }} />
            <div>
              <b>{r.name}</b>
              <div className="caption">{r.dept}</div>
            </div>
          </div>
          <p>
            This is a quick summary. To see detailed tasks, navigate to the specific queue or wait
            for the full drawer port.
          </p>
        </div>
      ),
      actions: [{ label: 'Close', kind: 'btn-secondary' }],
    });
  };

  const cols: Column<any>[] = [
    {
      key: 'name',
      label: 'Member',
      render: (r) => (
        <span className="flex aic g8">
          <Avatar user={{ name: r.name }} sm />
          <span>
            <div style={{ fontWeight: 700 }}>{r.name}</div>
            <div className="caption">{r.dept}</div>
          </span>
        </span>
      ),
    },
    { key: 'pending', label: 'Pending', num: true, sortable: true },
    { key: 'progress', label: 'In Prog.', num: true, sortable: true },
    {
      key: 'overdue',
      label: 'Overdue',
      num: true,
      sortable: true,
      render: (r) => (
        <span style={r.overdue ? { color: 'var(--status-overdue)', fontWeight: 800 } : undefined}>
          {r.overdue}
        </span>
      ),
    },
    { key: 'closed', label: 'Closed', num: true, sortable: true },
  ];

  return (
    <div>
      <div className="page-head">
        <div>
          <div className="page-title">Team Overview</div>
          <div className="page-sub">
            Live status across your team and cabinets. Click through to detail.
          </div>
        </div>
        <div className="actions">
          <button className="btn btn-primary" onClick={() => router.push('/supervisor/approvals')}>
            <Icon name="approve" size={15} /> Approvals queue
          </button>
        </div>
      </div>

      <div className="grid cols-4 mb16">
        {tiles.map((t, i) => (
          <div
            key={i}
            className={`tile ${t.cls}`}
            role="button"
            tabIndex={0}
            onClick={() =>
              router.push(
                t.label.startsWith('Overdue') ? '/supervisor/bottlenecks' : '/supervisor/workload',
              )
            }
          >
            <div className="cnt">{t.val}</div>
            <div className="lbl">
              <Icon name={t.ico} size={13} /> {t.label}
            </div>
          </div>
        ))}
      </div>

      <div className="dash-body">
        <div className="card">
          <div className="card-head">
            <span className="h3">Member × status matrix</span>
            <button
              className="btn btn-secondary btn-sm"
              onClick={() => alert('Export CSV (Not implemented)')}
            >
              Export
            </button>
          </div>
          <Table cols={cols} rows={matrix} onRow={handleRowClick} />
        </div>

        <div className="card">
          <div className="card-head">
            <span className="h3">Open items by cabinet</span>
          </div>
          <div className="card-body">
            <HBarChart items={byCab} />
          </div>
        </div>
      </div>
    </div>
  );
}
