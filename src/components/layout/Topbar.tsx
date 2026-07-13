'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useStore, userById } from '@/store/useStore';
import { useNavigation } from '@/hooks/useNavigation';
import { Icon } from '@/components/ui/Icons';
import { useUIStore } from '@/store/useUIStore';

const QUICK_ACTION: Record<string, { label: string; icon: string; go: string }> = {
  staff: { label: 'Upload document', icon: 'upload', go: '/upload' },
  supervisor: { label: 'Approvals', icon: 'approve', go: '/supervisor/approvals' },
  management: { label: 'New report', icon: 'report', go: '/management/reports' },
  clientadmin: { label: 'Upload document', icon: 'upload', go: '/upload' },
  platform: { label: 'Provision tenant', icon: 'plus', go: '/platform' },
  auditor: { label: 'Raise finding', icon: 'plus', go: '/auditor/findings' },
};

export const Topbar = ({ pageTitle, toggleNav }: { pageTitle: string; toggleNav: () => void }) => {
  const router = useRouter();
  const { session, users, notifications, prefs, setPrefs } = useStore();
  const { addToast } = useUIStore();
  const nav = useNavigation();
  const [notifOpen, setNotifOpen] = useState(false);
  const me = session ? userById(users, session) : null;

  if (!me || !nav) return null;

  const qa = QUICK_ACTION[me.role];
  const dateStr = new Date().toLocaleDateString('en-GB', {
    weekday: 'long',
    day: '2-digit',
    month: 'short',
  });

  const unreadCount = notifications.filter((n) => n.user === me.id && !n.read).length;
  const myNotifs = notifications.filter((n) => n.user === me.id).slice(0, 6);

  const toggleTheme = () => {
    setPrefs({ ...prefs, theme: prefs.theme === 'light' ? 'dark' : 'light' });
  };

  const markAllRead = () => {
    // In a real app we'd dispatch an action, for this port we just mutate via setStore (not implemented yet).
    // For now we'll just show a toast.
    addToast('All notifications marked as read', 'info');
  };

  return (
    <header className="topbar">
      <button
        className="icon-btn"
        aria-label="Toggle navigation"
        title="Collapse / expand navigation"
        onClick={toggleNav}
      >
        <Icon name="menu" />
      </button>

      <div className="top-context">
        <span className="tc-title">{pageTitle}</span>
        <span className="tc-sub">· {dateStr}</span>
      </div>

      <div style={{ flex: 1 }}></div>

      <span className="surface-label">{nav.surface}</span>

      <button
        className="icon-btn"
        aria-label="Toggle theme"
        title={prefs.theme === 'light' ? 'Dark theme' : 'Light theme'}
        onClick={toggleTheme}
      >
        <Icon name={prefs.theme === 'light' ? 'moon' : 'sun'} />
      </button>

      <div style={{ position: 'relative' }}>
        <button
          className="icon-btn"
          aria-label="Notifications"
          onClick={() => setNotifOpen(!notifOpen)}
        >
          <Icon name="bell" />
          {unreadCount > 0 && <span className="notif-dot">{unreadCount}</span>}
        </button>

        {notifOpen && (
          <div className="menu" style={{ width: '340px' }}>
            <div className="flex jcb aic" style={{ padding: '8px 10px' }}>
              <span className="menu-head" style={{ padding: 0 }}>
                Notifications
              </span>
              <button className="btn btn-ghost btn-sm" onClick={markAllRead}>
                Mark all read
              </button>
            </div>
            {myNotifs.length > 0 ? (
              myNotifs.map((n) => (
                <div
                  key={n.id}
                  className={`notif-item ${n.read ? 'read' : ''}`}
                  onClick={() => {
                    setNotifOpen(false);
                    if (n.docId) router.push(`/doc/${n.docId}`);
                    else if (n.circularId) router.push('/circulars');
                    else router.push('/notifications');
                  }}
                >
                  <span className="dot"></span>
                  <div>
                    <div className="msg">{n.text}</div>
                    <div className="caption mt8">{new Date(n.at).toLocaleDateString()}</div>
                  </div>
                </div>
              ))
            ) : (
              <div className="empty" style={{ padding: '22px' }}>
                No notifications
              </div>
            )}
            <div className="menu-sep"></div>
            <button className="menu-item" onClick={() => router.push('/notifications')}>
              View all notifications
            </button>
          </div>
        )}
      </div>

      {qa && (
        <button className="btn btn-primary btn-pill" onClick={() => router.push(qa.go)}>
          <Icon name={qa.icon} size={14} /> {qa.label}
        </button>
      )}
    </header>
  );
};
