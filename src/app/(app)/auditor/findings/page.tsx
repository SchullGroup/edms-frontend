'use client';

import React, { useState, useEffect } from 'react';
import { useStore } from '@/store/useStore';
import { useUIStore } from '@/store/useUIStore';
import { Table, Column } from '@/components/ui/Table';

export default function AuditorFindingsPage() {
  const { findings, users, currentUser, addFinding, updateFinding, auditAction } = useStore();
  const { setPageTitle, openModal, closeModal, openConfirm, addToast } = useUIStore();

  const [statusF, setStatusF] = useState('All');

  useEffect(() => {
    setPageTitle('Findings Tracker');
  }, [setPageTitle]);

  const rows = (findings || []).filter((f: any) => statusF === 'All' || f.status === statusF);

  const handleRaiseFinding = () => {
    let title = '';
    let detail = '';
    let sev = 'High';
    let owner = users?.find((u: any) => u.status === 'Active')?.id || '';
    let control = 'Segregation of Duties';
    let due = new Date(Date.now() + 14 * 86400000).toISOString().slice(0, 10);

    openModal({
      title: 'Raise finding',
      size: 'lg',
      body: (
        <div>
          <div className="field">
            <label>Title <span className="req">*</span></label>
            <input className="input" placeholder="Short finding title" onChange={e => title = e.target.value} />
          </div>
          <div className="field">
            <label>Detail & evidence <span className="req">*</span></label>
            <textarea className="input" style={{ minHeight: '90px' }} onChange={e => detail = e.target.value}></textarea>
          </div>
          <div className="grid cols-2" style={{ gap: '12px' }}>
            <div className="field">
              <label>Severity</label>
              <select className="input" defaultValue={sev} onChange={e => sev = e.target.value}>
                <option>High</option>
                <option>Medium</option>
                <option>Low</option>
              </select>
            </div>
            <div className="field">
              <label>Control area</label>
              <select className="input" defaultValue={control} onChange={e => control = e.target.value}>
                {['Segregation of Duties', 'Access Management', 'Confidentiality Controls', 'Records Retention', 'Workflow Controls'].map(c => (
                  <option key={c}>{c}</option>
                ))}
              </select>
            </div>
            <div className="field">
              <label>Remediation owner</label>
              <select className="input" defaultValue={owner} onChange={e => owner = e.target.value}>
                {users?.filter((u: any) => u.status === 'Active').map((u: any) => (
                  <option key={u.id} value={u.id}>{u.name} — {u.role}</option>
                ))}
              </select>
            </div>
            <div className="field">
              <label>Response due</label>
              <input type="date" className="input" defaultValue={due} onChange={e => due = e.target.value} />
            </div>
          </div>
        </div>
      ),
      actions: [
        { label: 'Cancel' },
        {
          label: 'Raise finding',
          kind: 'btn-primary',
          onClick: () => {
            if (!title.trim() || !detail.trim()) {
              addToast('Title and detail are required', 'error');
              return;
            }
            const f = {
              id: 'fd-' + Date.now(),
              ref: 'FND-2026-0' + (15 + (findings?.length || 0)),
              title: title.trim(),
              severity: sev,
              status: 'Open',
              owner,
              raised: Date.now(),
              due: new Date(due + 'T17:00:00').getTime(),
              control,
              detail: detail.trim(),
              responses: [],
            };
            addFinding(f);
            auditAction('FINDING_RAISE', f.ref, 'Raised: ' + f.title);
            addToast('Finding raised and owner notified', 'success');
            closeModal();
          }
        }
      ]
    });
  };

  const detailDrawer = (f: any) => {
    let responseText = '';

    openModal({
      title: `${f.ref} — ${f.title}`,
      size: 'lg',
      body: (
        <div>
          <div className="flex g8 wrap mb16">
            <span className={`badge ${f.severity === 'High' ? 'b-urg-high' : f.severity === 'Medium' ? 'b-urg-normal' : 'b-urg-low'}`}>{f.severity}</span>
            <span className={`badge ${f.status === 'Closed' ? 'b-status-closed' : f.status === 'Open' ? 'b-status-overdue' : 'b-status-pending'}`}>{f.status}</span>
            <span className="badge b-urg-low">{f.control}</span>
          </div>

          {[
            ['Owner', users?.find((u: any) => u.id === f.owner)?.name || f.owner],
            ['Raised', new Date(f.raised).toLocaleDateString()],
            ['Response due', new Date(f.due).toLocaleDateString()],
            f.closedAt ? ['Closed', new Date(f.closedAt).toLocaleDateString()] : null
          ].filter(Boolean).map((row: any, i) => (
            <div key={i} className="meta-row">
              <span className="k">{row[0]}</span>
              <span className="v">{row[1]}</span>
            </div>
          ))}

          <div className="h3 mt16 mb8">Detail</div>
          <p style={{ fontSize: '12.5px', lineHeight: 1.6 }}>{f.detail}</p>

          <div className="h3 mt16 mb8">Responses ({f.responses?.length || 0})</div>
          {f.responses && f.responses.length > 0 ? (
            f.responses.map((r: any, i: number) => (
              <div key={i} className="comment" style={{ display: 'flex', gap: '12px', marginBottom: '12px' }}>
                <div style={{ width: '32px', height: '32px', borderRadius: '50%', background: '#eee', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 'bold' }}>
                  {users?.find((u: any) => u.id === r.by)?.name?.charAt(0) || '?'}
                </div>
                <div>
                  <div className="by" style={{ fontSize: '11px', color: '#666', marginBottom: '4px' }}>
                    {users?.find((u: any) => u.id === r.by)?.name} · {new Date(r.at).toLocaleString()}
                  </div>
                  <div className="body" style={{ fontSize: '13px' }}>{r.text}</div>
                </div>
              </div>
            ))
          ) : (
            <p className="caption">No responses yet.</p>
          )}

          <div className="mt16">
            <textarea className="input" placeholder="Add response / evidence note…" style={{ minHeight: '64px' }} onChange={e => responseText = e.target.value}></textarea>
            <div className="flex g8 mt8" style={{ justifyContent: 'flex-end' }}>
              <button className="btn btn-secondary btn-sm" onClick={() => {
                if (!responseText.trim()) return;
                const updatedResponses = [...(f.responses || []), { by: currentUser?.id, at: Date.now(), text: responseText.trim() }];
                updateFinding(f.id, {
                  responses: updatedResponses,
                  status: f.status === 'Open' ? 'In Remediation' : f.status
                });
                auditAction('FINDING_RESPONSE', f.ref, 'Response added');
                addToast('Response recorded', 'success');
                closeModal();
              }}>Add response</button>

              {f.status !== 'Closed' && (
                <button className="btn btn-success btn-sm" onClick={() => {
                  closeModal();
                  openConfirm?.({
                    title: `Close ${f.ref}?`,
                    message: 'Closing certifies that remediation evidence has been reviewed and accepted. The finding remains in the register permanently.',
                    confirmLabel: 'Close with evidence',
                    onConfirm: () => {
                      updateFinding(f.id, { status: 'Closed', closedAt: Date.now() });
                      auditAction('FINDING_CLOSE', f.ref, 'Closed: ' + f.title);
                      addToast(`${f.ref} closed`, 'success');
                    }
                  });
                }}>Close finding</button>
              )}
            </div>
          </div>
        </div>
      ),
      actions: [{ label: 'Close' }]
    });
  };

  const cols: Column<any>[] = [
    { key: 'ref', label: 'Ref', render: f => <b>{f.ref}</b> },
    { key: 'title', label: 'Finding', render: f => (
        <span>
          {f.title}
          <div className="caption">{f.control}</div>
        </span>
      ) 
    },
    { key: 'severity', label: 'Severity', render: f => (
        <span className={`badge ${f.severity === 'High' ? 'b-urg-high' : f.severity === 'Medium' ? 'b-urg-normal' : 'b-urg-low'}`}>{f.severity}</span>
      ) 
    },
    { key: 'owner', label: 'Owner', render: f => users?.find((u: any) => u.id === f.owner)?.name || f.owner },
    { key: 'due', label: 'Due', sortable: true, render: f => (
        <span style={f.status !== 'Closed' && f.due < Date.now() ? { color: 'var(--status-overdue)', fontWeight: 800 } : {}}>
          {new Date(f.due).toLocaleDateString()}
        </span>
      ) 
    },
    { key: 'status', label: 'Status', render: f => (
        <span className={`badge ${f.status === 'Closed' ? 'b-status-closed' : f.status === 'Open' ? 'b-status-overdue' : 'b-status-pending'}`}>
          {f.status}
        </span>
      ) 
    },
  ];

  return (
    <div>
      <div className="page-head">
        <div>
          <div className="page-title">Findings Tracker</div>
          <div className="page-sub">Raise findings, assign owners, track responses to closure with evidence.</div>
        </div>
        <div className="actions">
          <select className="input" style={{ width: 'auto', height: '32px' }} value={statusF} onChange={e => setStatusF(e.target.value)}>
            {['All', 'Open', 'In Remediation', 'Closed'].map(s => <option key={s}>{s}</option>)}
          </select>
          {currentUser?.role === 'Auditor' && (
            <button className="btn btn-primary" onClick={handleRaiseFinding}>
              Raise finding
            </button>
          )}
        </div>
      </div>

      <div className="card">
        <Table cols={cols} rows={rows} onRow={detailDrawer} />
      </div>
    </div>
  );
}
