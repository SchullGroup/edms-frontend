'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useStore, effStatus } from '@/store/useStore';
import { useUIStore } from '@/store/useUIStore';
import { Icon } from '@/components/ui/Icons';
import { TaskRow } from '@/components/ui/TaskRow';

const URG_ORDER: Record<string, number> = { 'Critical': 1, 'High': 2, 'Normal': 3, 'Low': 4 };

export default function MyTasksPage() {
  const router = useRouter();
  const { documents, session } = useStore();
  const { setPageTitle } = useUIStore();

  const [statusF, setStatusF] = useState('All');
  const [urgF, setUrgF] = useState('All');
  const [sortBy, setSortBy] = useState('urgency');

  useEffect(() => {
    setPageTitle('My Tasks');
  }, [setPageTitle]);

  let list = documents.filter(d => d.assignee === session);
  if (statusF !== 'All') list = list.filter(d => effStatus(d) === statusF);
  if (urgF !== 'All') list = list.filter(d => d.urgency === urgF);

  if (sortBy === 'urgency') {
    list.sort((a, b) => (URG_ORDER[a.urgency] - URG_ORDER[b.urgency]) || ((a.due || 9e15) - (b.due || 9e15)));
  } else if (sortBy === 'due') {
    list.sort((a, b) => (a.due || 9e15) - (b.due || 9e15));
  } else {
    list.sort((a, b) => b.created - a.created);
  }

  const CONF_LEVELS = ['Public', 'Internal', 'Confidential', 'Restricted', 'Top Secret'];
  const URG_LEVELS = ['Critical', 'High', 'Normal', 'Low'];

  return (
    <div>
      <div className="page-head">
        <div>
          <div className="page-title">My Tasks</div>
          <div className="page-sub">Everything assigned to you, filterable and sortable.</div>
        </div>
        <div className="actions">
          <select className="input" style={{ width: 'auto', height: '32px' }} value={statusF} onChange={e => setStatusF(e.target.value)} aria-label="Status">
            {['All', 'Pending', 'In Progress', 'Overdue', 'On Hold'].map(o => (
              <option key={o} value={o}>{o === 'All' ? 'Status: All' : o}</option>
            ))}
          </select>
          <select className="input" style={{ width: 'auto', height: '32px' }} value={urgF} onChange={e => setUrgF(e.target.value)} aria-label="Urgency">
            {['All', ...URG_LEVELS].map(o => (
              <option key={o} value={o}>{o === 'All' ? 'Urgency: All' : o}</option>
            ))}
          </select>
          <select className="input" style={{ width: 'auto', height: '32px' }} value={sortBy} onChange={e => setSortBy(e.target.value)} aria-label="Sort">
            <option value="urgency">Sort: Urgency then due</option>
            <option value="due">Sort: Due date</option>
            <option value="created">Sort: Newest</option>
          </select>
        </div>
      </div>

      <div className="card">
        {list.length > 0 ? (
          <div className="rowlist">
            {list.map((d: any) => (
              <TaskRow key={d.id} doc={d} />
            ))}
          </div>
        ) : (
          <div className="empty">
            <Icon name="inbox" size={32} />
            <div className="h3 mt16 mb8">No tasks in this view</div>
            <p className="caption mb16">Adjust the filters, or enjoy the quiet moment.</p>
          </div>
        )}
      </div>
    </div>
  );
}
