'use client';

import React, { useState, useRef, useEffect } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { helpTopicForPath } from '@/constants/helpTopics';
import { useStore } from '@/store/useStore';
import { usePermissions } from '@/hooks/usePermissions';
import { Icon } from '@/components/ui/Icons';
import { SkeletonNotifRows } from '@/components/common/Skeleton';
import { useUIStore } from '@/store/useUIStore';
import { PORTAL_BY_KEY, type PortalKey } from '@/lib/permissions';
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
export const Topbar = ({
  pageTitle,
  toggleNav,
  navExpanded,
  navToggleRef,
  inert,
}: {
  pageTitle: string;
  toggleNav: () => void;
  navExpanded: boolean;
  navToggleRef: React.RefObject<HTMLButtonElement | null>;
  inert: boolean;
}) => {
  const router = useRouter();
  const pathname = usePathname();
  const { currentUser, prefs, setPrefs } = useStore();
  const { portal, portals } = usePermissions();
  const [notifOpen, setNotifOpen] = useState(false);
  const me = currentUser;
  const notifRef = useRef<HTMLDivElement>(null);

  const { data: unreadCount = 0 } = useUnreadNotificationCount({ enabled: !!me });
  // Fetched only while open, capped to the 5 most recent unread; the badge uses the
  // count endpoint, and "View all notifications" opens the full list.
  const {
    data: notifData,
    isLoading: isLoadingNotifs,
    isError: isNotifError,
    refetch: refetchNotifs,
  } = useNotifications(
    { limit: 5, channel: 'in_app', unreadOnly: true },
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
  if (!me) return null;
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
    <header className="topbar" inert={inert}>
      <button
        ref={navToggleRef}
        className="icon-btn"
        aria-label="Toggle navigation"
        aria-controls="primary-sidebar"
        aria-expanded={navExpanded}
        title="Open or close navigation"
        onClick={toggleNav}
      >
        <Icon name="menu" />
      </button>

      <div className="top-context">
        <span className="tc-title">{pageTitle}</span>
        <span className="tc-sub">· {dateStr}</span>
      </div>

      <div style={{ flex: 1 }}></div>

      {portals.length > 1 ? (
        // Someone holding several roles picks which portal they're working in.
        <select
          className="surface-label"
          aria-label="Switch portal"
          title="Switch to another of your roles"
          value={portal}
          style={{ cursor: 'pointer' }}
          onChange={(e) => {
            const next = e.target.value as PortalKey;
            setPrefs({ ...prefs, portalChoice: { userId: me.id, portal: next } });
            router.push(PORTAL_BY_KEY[next].home);
          }}
        >
          {portals.map((key) => (
            <option key={key} value={key}>
              {PORTAL_BY_KEY[key].shortLabel}
            </option>
          ))}
        </select>
      ) : null}

      <button
        className="icon-btn"
        aria-label="Help for this page"
        title="Help for this page"
        onClick={() => router.push(`/help#${helpTopicForPath(pathname)}`)}
      >
        <Icon name="info" />
      </button>

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
          <div className="menu" style={{ width: '340px' }} aria-busy={isLoadingNotifs}>
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
            {isLoadingNotifs ? (
              // One row per unread notification the menu will show (it caps at 5).
              <SkeletonNotifRows rows={Math.min(Math.max(unreadCount, 1), 5)} />
            ) : isNotifError ? (
              <div className="empty" style={{ padding: '22px' }}>
                Couldn&apos;t load notifications.{' '}
                <button className="btn btn-ghost btn-sm" onClick={() => refetchNotifs()}>
                  Try again
                </button>
              </div>
            ) : myNotifs.length > 0 ? (
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

    </header>
  );
};
