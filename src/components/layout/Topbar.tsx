'use client';

import React, { useState, useRef, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useStore } from '@/store/useStore';
import { useNavigation } from '@/hooks/useNavigation';
import { usePermissions } from '@/hooks/usePermissions';
import { Icon } from '@/components/ui/Icons';
import { useUIStore } from '@/store/useUIStore';
import {
  useNotifications,
  useUnreadNotificationCount,
  useMarkNotificationRead,
  useMarkAllNotificationsRead,
} from '@/apis/hooks/useNotifications';
import {
  isUnread,
  notificationHref,
  notificationMessage,
} from '@/apis/services/notifications.service';

// Keyed by portal (see src/lib/permissions.ts), not by role name.
const QUICK_ACTION: Record<string, { label: string; icon: string; go: string }> = {
  staff: { label: 'Upload document', icon: 'upload', go: '/upload' },
  supervisor: { label: 'Approvals', icon: 'approve', go: '/supervisor/approvals' },
  management: { label: 'New report', icon: 'report', go: '/management/reports' },
  admin: { label: 'Upload document', icon: 'upload', go: '/upload' },
  platform: { label: 'Provision tenant', icon: 'plus', go: '/platform' },
  auditor: { label: 'Audit scope', icon: 'search', go: '/auditor' },
};

export const Topbar = ({ pageTitle, toggleNav }: { pageTitle: string; toggleNav: () => void }) => {
  const router = useRouter();
  const { currentUser, prefs, setPrefs } = useStore();
  const nav = useNavigation();
  const { portal } = usePermissions();
  const [notifOpen, setNotifOpen] = useState(false);
  const me = currentUser;
  const notifRef = useRef<HTMLDivElement>(null);

  const { data: unreadCount = 0 } = useUnreadNotificationCount({ enabled: !!me });
  // Only fetched while the menu is open — the badge alone runs off the count endpoint.
  // Capped to the 7 most recent unread; "View all notifications" is the escape
  // hatch to the full (read + unread, paginated) list rather than growing this menu.
  const { data: notifData } = useNotifications(
    { limit: 7, channel: 'in_app', unreadOnly: true },
    { enabled: notifOpen },
  );
  const markRead = useMarkNotificationRead();
  const markAllRead = useMarkAllNotificationsRead();

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

  const qa = QUICK_ACTION[portal];
  const dateStr = new Date().toLocaleDateString('en-GB', {
    weekday: 'long',
    day: '2-digit',
    month: 'short',
  });

  const myNotifs = notifData?.data || [];

  const toggleTheme = () => {
    setPrefs({ ...prefs, theme: prefs.theme === 'light' ? 'dark' : 'light' });
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
            <div className="flex justify-between items-center" style={{ padding: '8px 10px' }}>
              <span className="menu-head" style={{ padding: 0 }}>
                Notifications
              </span>
              <button
                className="btn btn-ghost btn-sm"
                onClick={() => markAllRead.mutate()}
                disabled={markAllRead.isPending}
              >
                Mark all read
              </button>
            </div>
            {myNotifs.length > 0 ? (
              myNotifs.map((n) => (
                <div
                  key={n.id}
                  className={`notif-item ${isUnread(n) ? '' : 'read'}`}
                  onClick={() => {
                    setNotifOpen(false);
                    if (isUnread(n)) markRead.mutate(n.id);
                    router.push(notificationHref(n) || '/notifications');
                  }}
                >
                  <span className="dot"></span>
                  <div>
                    <div className="msg">{notificationMessage(n)}</div>
                    <div className="caption mt-2">{new Date(n.createdAt).toLocaleDateString()}</div>
                  </div>
                </div>
              ))
            ) : (
              <div className="empty" style={{ padding: '22px' }}>
                No unread notifications
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
