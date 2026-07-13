'use client';

import React, { useState, useEffect } from 'react';
import { useStore, userById } from '@/store/useStore';
import { useUIStore } from '@/store/useUIStore';
import { Icon } from '@/components/ui/Icons';
import { fmtDate } from '@/utils/helpers';

export default function CircularsPage() {
  const { circulars, session, users, markCircularAck, auditAction } = useStore();
  const { setPageTitle, addToast } = useUIStore();
  const [tab, setTab] = useState<'active' | 'archive'>('active');

  const me = session ? userById(users, session) : null;

  useEffect(() => {
    setPageTitle('Circulars');
  }, [setPageTitle]);

  const cutoff = Date.now() - 7 * 86400000; // 7 days
  const list = circulars
    .filter((c: any) =>
      tab === 'active'
        ? c.published >= cutoff || (c.requiresAck && !c.ackBy.includes(session))
        : true,
    )
    .sort((a: any, b: any) => b.published - a.published);

  const handleAck = (c: any) => {
    markCircularAck(c.id);
    auditAction('ACK_CIRCULAR', c.id, 'Acknowledged: ' + c.title);
    addToast('Acknowledgement recorded', 'success');
  };

  return (
    <div>
      <div className="page-head">
        <div>
          <div className="page-title">Circulars</div>
          <div className="page-sub">
            Organisation-wide notices. Some require your acknowledgement.
          </div>
        </div>
      </div>

      <div className="tabs">
        <button
          className={`tab ${tab === 'active' ? 'active' : ''}`}
          onClick={() => setTab('active')}
        >
          Active
        </button>
        <button
          className={`tab ${tab === 'archive' ? 'active' : ''}`}
          onClick={() => setTab('archive')}
        >
          Archive (all)
        </button>
      </div>

      {list.length > 0 ? (
        list.map((c: any) => {
          const acked = session ? c.ackBy.includes(session) : false;
          return (
            <div key={c.id} className="card card-pad mb16">
              <div className="flex jcb aic wrap g12">
                <div style={{ minWidth: 0 }}>
                  <div className="h2" style={{ marginBottom: '4px' }}>
                    {c.title}
                  </div>
                  <div className="caption">
                    Published {fmtDate(c.published)} by {userById(users, c.by).name} · Audience:{' '}
                    {c.audience}
                  </div>
                </div>
                {c.requiresAck ? (
                  acked ? (
                    <span className="badge b-status-closed">
                      <span style={{ marginRight: '4px' }}><Icon name="check" size={10} /></span> Acknowledged
                    </span>
                  ) : (
                    <button className="btn btn-accent btn-sm" onClick={() => handleAck(c)}>
                      Acknowledge
                    </button>
                  )
                ) : (
                  <span className="badge b-urg-low">FYI — no acknowledgement</span>
                )}
              </div>
              <p style={{ marginTop: '12px', lineHeight: 1.65, fontSize: '13px' }}>{c.body}</p>
            </div>
          );
        })
      ) : (
        <div className="card">
          <div className="empty">
            <Icon name="speaker" size={32} />
            <div className="h3 mt16 mb8">No circulars</div>
            <p className="caption mb16">
              Published circulars from your administrators appear here.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
