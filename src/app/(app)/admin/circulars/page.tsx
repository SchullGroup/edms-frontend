'use client';

import React, { useEffect, useState } from 'react';
import { useStore } from '@/store/useStore';
import { useUIStore } from '@/store/useUIStore';
import { Table, Column } from '@/components/ui/Table';
import { Icon } from '@/components/ui/Icons';
import { useCirculars, useCreateCircular, useUpdateCircular } from '@/apis/hooks/useCirculars';
import { Spinner } from '@/components/common/Spinner';
import { ErrorMessage } from '@/components/common/ErrorMessage';
import { useUsers } from '@/apis/hooks/useUsers';

export default function CircularsAdminPage() {
  const { auditAction, currentUser } = useStore();
  const { setPageTitle, openModal, closeModal, addToast } = useUIStore();

  const { data: circularsData, isLoading, isError, refetch } = useCirculars();
  const { data: usersData } = useUsers();

  const createCircular = useCreateCircular();
  const updateCircular = useUpdateCircular();

  const circulars = circularsData?.data || [];
  const users = usersData?.data || [];

  useEffect(() => {
    setPageTitle('Circulars Admin');
  }, [setPageTitle]);

  if (isLoading) return <Spinner text="Loading circulars..." />;
  if (isError) return <ErrorMessage message="Failed to load circulars." retry={refetch} />;

  const handleCompose = (existing?: any) => {
    let title = existing?.title || '';
    let bodyText = existing?.body || '';
    let audience = existing?.audience || 'All Staff';
    let requiresAck = existing ? existing.requiresAck : true;

    openModal({
      title: existing ? 'Edit circular' : 'Compose circular',
      size: 'lg',
      body: (
        <div>
          <div className="field">
            <label>
              Title <span className="req">*</span>
            </label>
            <input
              className="input"
              defaultValue={title}
              placeholder="Circular title"
              onChange={(e) => (title = e.target.value)}
            />
          </div>
          <div className="field">
            <label>
              Body <span className="req">*</span>
            </label>
            <textarea
              className="input"
              style={{ minHeight: '120px' }}
              defaultValue={bodyText}
              placeholder="Write the circular…"
              onChange={(e) => (bodyText = e.target.value)}
            ></textarea>
          </div>
          <div className="grid cols-2" style={{ gap: '12px' }}>
            <div className="field">
              <label>Audience</label>
              <select
                className="input"
                defaultValue={audience}
                onChange={(e) => (audience = e.target.value)}
              >
                {[
                  'All Staff',
                  'Operations',
                  'Finance',
                  'Procurement, Finance',
                  'Supervisors only',
                ].map((a) => (
                  <option key={a} value={a}>
                    {a}
                  </option>
                ))}
              </select>
            </div>
            <div className="field">
              <label>Acknowledgement</label>
              <label className="check">
                <input
                  type="checkbox"
                  defaultChecked={requiresAck}
                  onChange={(e) => (requiresAck = e.target.checked)}
                />{' '}
                Require read acknowledgement
              </label>
            </div>
          </div>
        </div>
      ),
      actions: [
        { label: 'Cancel' },
        {
          label: existing ? 'Save changes' : 'Publish',
          kind: 'btn-primary',
          onClick: () => {
            if (!title.trim() || !bodyText.trim()) {
              addToast('Title and body are required', 'error');
              return;
            }
            if (existing) {
              updateCircular.mutate(
                { id: existing.id, updates: { title, body: bodyText, audience, requiresAck } },
                {
                  onSuccess: () => {
                    auditAction('CIRCULAR_EDIT', existing.id, 'Edited ' + title);
                    closeModal();
                  },
                },
              );
            } else {
              const c = {
                title: title.trim(),
                body: bodyText.trim(),
                published: Date.now(),
                by: currentUser?.id,
                requiresAck,
                ackBy: [],
                audience,
              };
              createCircular.mutate(c, {
                onSuccess: (newCirc) => {
                  auditAction('PUBLISH_CIRCULAR', newCirc.id, 'Published ' + newCirc.title);
                  closeModal();
                },
              });
            }
          },
        },
      ],
    });
  };

  const handleTrack = (c: any) => {
    const pending = users.filter((u: any) => !c.ackBy?.includes(u.id)).map((u: any) => u.name);
    openModal({
      title: 'Acknowledgement tracking — ' + c.title,
      body: (
        <div>
          <div className="h3 mb8">Outstanding ({pending.length})</div>
          {pending.length ? (
            pending.map((nm: string) => (
              <div key={nm} className="metric-li">
                <span>{nm}</span>
                <span className="caption">Not acknowledged</span>
              </div>
            ))
          ) : (
            <p className="muted">Everyone has acknowledged.</p>
          )}
          {pending.length > 0 && (
            <button
              className="btn btn-secondary btn-sm mt16"
              onClick={() => addToast(`Reminders sent to ${pending.length} user(s)`, 'success')}
            >
              Send reminders
            </button>
          )}
        </div>
      ),
      actions: [{ label: 'Close', kind: 'btn-primary' }],
    });
  };

  const totalUsers = users?.length || 1;

  const cols: Column<any>[] = [
    {
      key: 'title',
      label: 'Circular',
      render: (c) => (
        <span>
          <b>{c.title}</b>
          <div className="caption">Audience: {c.audience}</div>
        </span>
      ),
    },
    {
      key: 'published',
      label: 'Published',
      sortable: true,
      render: (c) => new Date(c.published).toLocaleDateString(),
    },
    {
      key: 'ack',
      label: 'Acknowledgement',
      render: (c) =>
        c.requiresAck ? (
          <div style={{ minWidth: '130px' }}>
            <div className="caption mb8">
              {c.ackBy?.length || 0} of {totalUsers} acknowledged
            </div>
            <div className={`pbar ${(c.ackBy?.length || 0) / totalUsers > 0.7 ? 'ok' : 'warn'}`}>
              <i
                style={{ width: Math.round(((c.ackBy?.length || 0) / totalUsers) * 100) + '%' }}
              ></i>
            </div>
          </div>
        ) : (
          <span className="badge b-urg-low">FYI only</span>
        ),
    },
    {
      key: 'act',
      label: '',
      render: (c) => (
        <div className="flex g8">
          <button
            className="btn btn-secondary btn-sm"
            onClick={(e) => {
              e.stopPropagation();
              handleCompose(c);
            }}
          >
            Edit
          </button>
          <button
            className="btn btn-secondary btn-sm"
            onClick={(e) => {
              e.stopPropagation();
              handleTrack(c);
            }}
          >
            Track
          </button>
        </div>
      ),
    },
  ];

  return (
    <div>
      <div className="page-head">
        <div>
          <div className="page-title">Circulars Admin</div>
          <div className="page-sub">Compose, publish and track acknowledgement of circulars.</div>
        </div>
        <div className="actions">
          <button className="btn btn-primary" onClick={() => handleCompose()}>
            <span style={{ display: 'inline-flex', alignItems: 'center', marginRight: '6px' }}>
              <Icon name="plus" size={15} />
            </span>
            Compose circular
          </button>
        </div>
      </div>
      <div className="card">
        <Table cols={cols} rows={circulars || []} />
      </div>
    </div>
  );
}
