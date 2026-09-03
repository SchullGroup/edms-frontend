'use client';

import React, { useState, useRef, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useStore, userById } from '@/store/useStore';
import { useNavigation } from '@/hooks/useNavigation';
import { Icon } from '@/components/ui/Icons';
import { useUIStore } from '@/store/useUIStore';
import {
  useMarkAllNotificationsRead,
  useNotifications,
  useUnreadNotificationCount,
} from '@/apis/hooks/useNotifications';

const QUICK_ACTION: Record<string, { label: string; icon: string; go: string }> = {
  staff: { label: 'Upload document', icon: 'upload', go: '/upload' },
  supervisor: { label: 'Approvals', icon: 'approve', go: '/supervisor/approvals' },
  management: { label: 'New report', icon: 'report', go: '/management/reports' },
  client_admin: { label: 'Upload document', icon: 'upload', go: '/upload' },
  schulltech_admin: { label: 'Provision tenant', icon: 'plus', go: '/platform' },
  internal_auditor: { label: 'Audit scope', icon: 'search', go: '/auditor' },
};

export const Topbar = ({ pageTitle, toggleNav }: { pageTitle: string; toggleNav: () => void }) => {
  const router = useRouter();
  const { currentUser, prefs, setPrefs } = useStore();
  const { addToast } = useUIStore();
  const nav = useNavigation();
  const [notifOpen, setNotifOpen] = useState(false);
  const me = currentUser;
  const notifRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (notifRef.current && !notifRef.current.contains(event.target as Node)) {
        setNotifOpen(false);
      }
    };

    if (notifOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [notifOpen]);
  if (!me || !nav) return null;

  const rolePriority = [
    'schulltech_admin',
    'client_admin',
    'management',
    'internal_auditor',
    'supervisor',
    'staff',
  ];
  const primaryRole = rolePriority.find((r) => me.roles?.includes(r)) || 'staff';
  const qa = QUICK_ACTION[primaryRole];
  const dateStr = new Date().toLocaleDateString('en-GB', {
    weekday: 'long',
    day: '2-digit',
    month: 'short',
  });

  // Live from the API. This used to be derived from the seeded store, so the
  // badge never reflected real notifications.
  const { data: unreadCount = 0 } = useUnreadNotificationCount();
  const { data: notifPage } = useNotifications({ limit: 6 });
  const myNotifs = notifPage?.data ?? [];

  const toggleTheme = () => {
    setPrefs({ ...prefs, theme: prefs.theme === 'light' ? 'dark' : 'light' });
  };

  const markAllNotificationsRead = useMarkAllNotificationsRead();

  const markAllRead = () => {
    markAllNotificationsRead.mutate(undefined, {
      onSuccess: () => addToast('All notifications marked as read', 'info'),
      onError: () => addToast('Could not mark notifications as read', 'error'),
    });
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

      <div style={{ position: 'relative' }} ref={notifRef}>
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
                  className={`notif-item ${n.readAt ? 'read' : ''}`}
                  onClick={() => {
                    setNotifOpen(false);
                    router.push(n.payload?.actionUrl || '/notifications');
                  }}
                >
                  <span className="dot"></span>
                  <div>
                    <div className="msg">{n.payload?.message ?? n.payload?.title ?? ''}</div>
                    <div className="caption mt8">{new Date(n.createdAt).toLocaleDateString()}</div>
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
