'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useStore } from '@/store/useStore';
import { useUIStore } from '@/store/useUIStore';
import { Icon } from '@/components/ui/Icons';
import { timeAgo } from '@/utils/helpers';

export default function NotificationCenterPage() {
  const router = useRouter();
  const { notifications, session } = useStore();
  const { setPageTitle, addToast } = useUIStore();
  const [filter, setFilter] = useState<'all' | 'unread'>('all');

  useEffect(() => {
    setPageTitle('Notification Center');
  }, [setPageTitle]);

  const typeIcon: Record<string, string> = { 
    task: 'inbox', sla: 'alert', comment: 'edit', circular: 'speaker', 
    workflow: 'flow', report: 'report', admin: 'settings', platform: 'building', audit: 'finding' 
  };

  const markRead = (n: any) => {
    const newNotifs = useStore.getState().notifications.map(notif => {
      if (notif.id === n.id) return { ...notif, read: true };
      return notif;
    });
    useStore.setState({ notifications: newNotifs });
  };

  const handleRowClick = (n: any) => {
    markRead(n);
    if (n.docId) router.push(`/doc/${n.docId}`);
    else if (n.circularId) router.push('/circulars');
  };

  const markAllRead = () => {
    const newNotifs = useStore.getState().notifications.map(notif => {
      if (notif.user === session) return { ...notif, read: true };
      return notif;
    });
    useStore.setState({ notifications: newNotifs });
    addToast('All marked as read', 'info');
  };

  const list = notifications.filter((n: any) => n.user === session && (filter === 'all' || !n.read));

  return (
    <div>
      <div className="page-head">
        <div>
          <div className="page-title">Notification Center</div>
          <div className="page-sub">Everything the system has told you, in one place.</div>
        </div>
        <div className="actions">
          <div className="seg">
            <button className={filter === 'all' ? 'active' : ''} onClick={() => setFilter('all')}>All</button>
            <button className={filter === 'unread' ? 'active' : ''} onClick={() => setFilter('unread')}>Unread</button>
          </div>
          <button className="btn btn-secondary" onClick={markAllRead}>Mark all read</button>
        </div>
      </div>

      <div className="card">
        {list.length > 0 ? (
          list.map((n: any) => (
            <div 
              key={n.id} 
              className={`notif-item ${n.read ? 'read' : ''}`} 
              onClick={() => handleRowClick(n)}
              role="button"
              tabIndex={0}
            >
              <span className="dot"></span>
              <span className="notif-ico"><Icon name={typeIcon[n.type] || 'bell'} size={15} /></span>
              <div style={{ flex: 1 }}>
                <div className="msg">{n.text}</div>
                <div className="caption" style={{ marginTop: '3px' }}>
                  {timeAgo(n.at)} · {n.type.toUpperCase()}
                </div>
              </div>
              {!n.read && (
                <button 
                  className="btn btn-ghost btn-sm" 
                  onClick={(e) => { e.stopPropagation(); markRead(n); }}
                >
                  Mark read
                </button>
              )}
            </div>
          ))
        ) : (
          <div className="empty">
            <Icon name="bell" size={32} />
            <div className="h3 mt16 mb8">
              {filter === 'unread' ? 'No unread notifications' : 'No notifications'}
            </div>
            <p className="caption mb16">Workflow updates, SLA alerts and mentions will appear here.</p>
          </div>
        )}
      </div>
    </div>
  );
}
