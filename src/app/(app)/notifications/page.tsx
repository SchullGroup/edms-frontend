'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';

import { useUIStore } from '@/store/useUIStore';
import {
  useMarkAllNotificationsRead,
  useMarkNotificationRead,
  useNotificationPreferences,
  useNotifications,
  useUpdateNotificationPreferences,
} from '@/apis/hooks/useNotifications';
import { Icon } from '@/components/ui/Icons';
import { Spinner } from '@/components/common/Spinner';
import { ErrorMessage } from '@/components/common/ErrorMessage';
import { timeAgo } from '@/utils/helpers';
import type { Notification } from '@/types/models';

// Backend notification `type` values are dot-namespaced (task.assigned,
// sla.breach, workflow.started …); the icon set is keyed by the namespace.
const TYPE_ICON: Record<string, string> = {
  task: 'inbox',
  sla: 'alert',
  comment: 'edit',
  circular: 'speaker',
  workflow: 'flow',
  delegation: 'swap',
  report: 'report',
  admin: 'settings',
  platform: 'building',
  audit: 'finding',
  notification: 'bell',
};

function iconFor(type: string): string {
  return TYPE_ICON[type.split('.')[0]] ?? 'bell';
}

export default function NotificationCenterPage() {
  const router = useRouter();
  const { setPageTitle, addToast } = useUIStore();
  const [filter, setFilter] = useState<'all' | 'unread'>('all');

  const {
    data: page,
    isLoading,
    isError,
    refetch,
  } = useNotifications({ limit: 50, unreadOnly: filter === 'unread' });
  const markRead = useMarkNotificationRead();
  const markAllRead = useMarkAllNotificationsRead();
  const { data: prefs } = useNotificationPreferences();
  const updatePrefs = useUpdateNotificationPreferences();

  useEffect(() => {
    setPageTitle('Notification Center');
  }, [setPageTitle]);

  const list = page?.data ?? [];

  const openNotification = (n: Notification) => {
    if (!n.readAt) markRead.mutate(n.id);
    // The backend supplies the deep link as payload.actionUrl; there is no
    // separate docId/circularId on the wire.
    if (n.payload?.actionUrl) router.push(n.payload.actionUrl);
  };

  const handleMarkAllRead = () => {
    markAllRead.mutate(undefined, {
      onSuccess: () => addToast('All marked as read', 'info'),
      onError: () => addToast('Could not mark all as read', 'error'),
    });
  };

  if (isLoading) return <Spinner />;
  if (isError) return <ErrorMessage message="Could not load notifications" retry={refetch} />;

  return (
    <div>
      <div className="page-head">
        <div>
          <div className="page-title">Notification Center</div>
          <div className="page-sub">Everything the system has told you, in one place.</div>
        </div>
        <div className="actions">
          <div className="seg">
            <button className={filter === 'all' ? 'active' : ''} onClick={() => setFilter('all')}>
              All
            </button>
            <button
              className={filter === 'unread' ? 'active' : ''}
              onClick={() => setFilter('unread')}
            >
              Unread
            </button>
          </div>
          <button
            className="btn btn-secondary"
            onClick={handleMarkAllRead}
            disabled={markAllRead.isPending}
          >
            {markAllRead.isPending ? 'Marking…' : 'Mark all read'}
          </button>
        </div>
      </div>

      {prefs && (
        <div className="card mb16" style={{ padding: '14px 16px' }}>
          <div className="flex jcb aic" style={{ gap: '16px', flexWrap: 'wrap' }}>
            <div>
              <div style={{ fontWeight: 600, fontSize: '13px' }}>Delivery preferences</div>
              <div className="caption">Where and how often we contact you.</div>
            </div>
            <div className="flex g16 aic" style={{ flexWrap: 'wrap' }}>
              {(
                [
                  ['inAppEnabled', 'In-app'],
                  ['emailEnabled', 'Email'],
                  ['digestMode', 'Daily digest'],
                ] as const
              ).map(([key, label]) => (
                <label key={key} className="flex aic g8" style={{ fontSize: '13px' }}>
                  <input
                    type="checkbox"
                    checked={prefs[key]}
                    disabled={updatePrefs.isPending}
                    onChange={(e) =>
                      updatePrefs.mutate(
                        { [key]: e.target.checked },
                        { onError: () => addToast('Could not save preference', 'error') },
                      )
                    }
                  />
                  {label}
                </label>
              ))}
            </div>
          </div>
        </div>
      )}

      <div className="card">
        {list.length > 0 ? (
          list.map((n) => (
            <div
              key={n.id}
              className={`notif-item ${n.readAt ? 'read' : ''}`}
              onClick={() => openNotification(n)}
              role="button"
              tabIndex={0}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  openNotification(n);
                }
              }}
            >
              <span className="dot"></span>
              <span className="notif-ico">
                <Icon name={iconFor(n.type)} size={15} />
              </span>
              <div style={{ flex: 1 }}>
                <div className="msg">{n.payload?.message ?? n.payload?.title ?? ''}</div>
                <div className="caption" style={{ marginTop: '3px' }}>
                  {timeAgo(new Date(n.createdAt).getTime())} · {n.type.toUpperCase()}
                </div>
              </div>
              {!n.readAt && (
                <button
                  className="btn btn-ghost btn-sm"
                  onClick={(e) => {
                    e.stopPropagation();
                    markRead.mutate(n.id);
                  }}
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
            <p className="caption mb16">
              Workflow updates, SLA alerts and mentions will appear here.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
