'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useUIStore } from '@/store/useUIStore';
import {
  useNotifications,
  useMarkNotificationRead,
  useMarkAllNotificationsRead,
  useNotificationPreferences,
  useUpdateNotificationPreferences,
} from '@/apis/hooks/useNotifications';
import {
  isUnread,
  notificationHref,
  notificationIcon,
  notificationMessage,
} from '@/apis/services/notifications.service';
import { Notification } from '@/types/models';
import { Icon } from '@/components/ui/Icons';
import { EmptyState } from '@/components/ui/EmptyState';
import { Pagination } from '@/components/ui/Pagination';
import { Spinner } from '@/components/common/Spinner';
import { ErrorMessage } from '@/components/common/ErrorMessage';
import { timeAgo } from '@/utils/helpers';

const PAGE_SIZE = 20;

export default function NotificationCenterPage() {
  const router = useRouter();
  const { setPageTitle } = useUIStore();
  const [filter, setFilter] = useState<'all' | 'unread'>('all');
  const [page, setPage] = useState(1);

  useEffect(() => {
    setPageTitle('Notification Center');
  }, [setPageTitle]);

  // `unreadOnly` is a server-side filter, so the page resets whenever it flips.
  const { data, isLoading, isError, refetch } = useNotifications({
    page,
    limit: PAGE_SIZE,
    channel: 'in_app',
    ...(filter === 'unread' ? { unreadOnly: true } : {}),
  });

  const markRead = useMarkNotificationRead();
  const markAllRead = useMarkAllNotificationsRead();
  const { data: prefs } = useNotificationPreferences();
  const updatePrefs = useUpdateNotificationPreferences();

  const list = data?.data || [];
  const pagination = data?.pagination;

  const setFilterAndReset = (next: 'all' | 'unread') => {
    setFilter(next);
    setPage(1);
  };

  const handleRowClick = (n: Notification) => {
    if (isUnread(n)) markRead.mutate(n.id);
    const href = notificationHref(n);
    if (href) router.push(href);
  };

  return (
    <div>
      <div className="page-head">
        <div>
          <div className="page-title">Notification Center</div>
          <div className="page-sub">Everything the system has told you, in one place.</div>
        </div>
        <div className="actions">
          <div className="seg">
            <button
              className={filter === 'all' ? 'active' : ''}
              onClick={() => setFilterAndReset('all')}
            >
              All
            </button>
            <button
              className={filter === 'unread' ? 'active' : ''}
              onClick={() => setFilterAndReset('unread')}
            >
              Unread
            </button>
          </div>
          <button
            className="btn btn-secondary"
            onClick={() => markAllRead.mutate()}
            disabled={markAllRead.isPending}
          >
            {markAllRead.isPending ? 'Marking…' : 'Mark all read'}
          </button>
        </div>
      </div>

      <div className="card">
        {isLoading ? (
          <Spinner text="Loading notifications…" />
        ) : isError ? (
          <ErrorMessage message="Failed to load notifications." retry={() => refetch()} />
        ) : list.length > 0 ? (
          <>
            {list.map((n) => {
              const unread = isUnread(n);
              return (
                <div
                  key={n.id}
                  className={`notif-item ${unread ? '' : 'read'}`}
                  onClick={() => handleRowClick(n)}
                  role="button"
                  tabIndex={0}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      handleRowClick(n);
                    }
                  }}
                >
                  <span className="dot"></span>
                  <span className="notif-ico">
                    <Icon name={notificationIcon(n.type)} size={15} />
                  </span>
                  <div style={{ flex: 1 }}>
                    <div className="msg">{notificationMessage(n)}</div>
                    <div className="caption" style={{ marginTop: '3px' }}>
                      {timeAgo(Date.parse(n.createdAt))} · {n.type.toUpperCase()}
                    </div>
                  </div>
                  {unread && (
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
              );
            })}
            {pagination && (
              <Pagination
                page={pagination.page}
                totalPages={pagination.totalPages}
                total={pagination.total}
                limit={pagination.limit}
                onPageChange={setPage}
              />
            )}
          </>
        ) : (
          <EmptyState
            icon="bell"
            title={filter === 'unread' ? 'No unread notifications' : 'No notifications'}
            message="Workflow updates, SLA alerts and mentions will appear here."
          />
        )}
      </div>

      <div className="card mt16">
        <div className="card-head">
          <span className="h3">
            <Icon name="settings" size={16} /> Delivery preferences
          </span>
        </div>
        <div style={{ padding: '4px 20px 16px' }}>
          {[
            {
              key: 'inAppEnabled' as const,
              label: 'In-app notifications',
              desc: 'Show alerts in the bell menu and this centre.',
            },
            {
              key: 'emailEnabled' as const,
              label: 'Email notifications',
              desc: 'Also send each alert to your registered email address.',
            },
            {
              key: 'digestMode' as const,
              label: 'Digest mode',
              desc: 'Batch emails into a periodic summary instead of one per event.',
            },
          ].map((row) => (
            <div
              key={row.key}
              className="flex jcb aic g12"
              style={{ padding: '12px 0', borderBottom: '1px solid var(--border)' }}
            >
              <div>
                <div style={{ fontSize: '12.5px', fontWeight: 600 }}>{row.label}</div>
                <div className="caption" style={{ marginTop: '3px' }}>
                  {row.desc}
                </div>
              </div>
              <label className="switch">
                <input
                  type="checkbox"
                  checked={prefs?.[row.key] ?? false}
                  disabled={!prefs || updatePrefs.isPending}
                  onChange={(e) => updatePrefs.mutate({ [row.key]: e.target.checked })}
                />
                <i></i>
              </label>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
