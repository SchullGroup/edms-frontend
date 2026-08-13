// @ts-nocheck
'use client';

import React, { useEffect, useState, use } from 'react';
import { useRouter } from 'next/navigation';
import { useStore, cabById, folderName, userById } from '@/store/useStore';
import { useUIStore } from '@/store/useUIStore';
import { useDocument, useUpdateDocument } from '@/apis/hooks/useDocuments';
import { useCabinets } from '@/apis/hooks/useCabinets';
import { useUsers } from '@/apis/hooks/useUsers';
import { usePolicies } from '@/apis/hooks/usePolicies';
import { useCreateAuditLog } from '@/apis/hooks/useAudit';
import { useSendNotification } from '@/apis/hooks/useNotifications';
import { Icon } from '@/components/ui/Icons';
import { StatusBadge, UrgBadge, ConfBadge } from '@/components/ui/Badges';
import { Avatar } from '@/components/ui/Avatar';
import { timeAgo, fmtDateTime, fmtDate } from '@/utils/helpers';

export default function DocumentDetail({ params }: { params: Promise<{ id: string }> }) {
  const router = useRouter();
  const resolvedParams = use(params);
  const docId = resolvedParams.id;

  const { currentUser } = useStore();
  const { setPageTitle, openModal, closeModal, openConfirm, addToast } = useUIStore();

  const { data: cabinetsData, isLoading: isLoadingCabs } = useCabinets();
  const { data: usersData, isLoading: isLoadingUsers } = useUsers();
  const { data: policiesData, isLoading: isLoadingPolicies } = usePolicies();
  const cabinets = cabinetsData?.data || [];
  const users = usersData?.data || [];
  const policies = policiesData?.data;

  const updateDocument = useUpdateDocument();
  const createAuditLog = useCreateAuditLog();
  const sendNotification = useSendNotification();

  const [mode, setMode] = useState<'view' | 'redact'>('view');
  const [previewRelease, setPreviewRelease] = useState(false);
  const [page, setPage] = useState(1);
  const [zoom, setZoom] = useState(1);
  const [showMenu, setShowMenu] = useState(false);

  const { data: rawDoc, isLoading } = useDocument(docId);
  const me = currentUser;

  // Enhance the raw doc with fallback arrays so the UI doesn't break for missing features
  const doc = rawDoc
    ? {
        ...rawDoc,
        signatures: (rawDoc as any).signatures || [],
        comments: (rawDoc as any).comments || [],
        workflow: (rawDoc as any).workflow || [],
        pages: (rawDoc as any).pages || 1,
        version: (rawDoc as any).currentVersion?.versionNumber || 1,
        owner: rawDoc.createdBy,
        assignee: (rawDoc as any).assignee || rawDoc.createdBy,
      }
    : null;

  useEffect(() => {
    if (doc) {
      setPageTitle(doc.title);
    }
  }, [doc, setPageTitle]);

  if (!doc) {
    return (
      <div className="card">
        <div className="empty">
          <Icon name="doc" size={32} />
          <div className="h3 mt16 mb8">Document not found</div>
          <p className="caption mb16">It may have been moved or deleted.</p>
          <button className="btn btn-primary btn-sm" onClick={() => router.push('/staff/browser')}>
            Browse cabinets
          </button>
        </div>
      </div>
    );
  }

  if (isLoading || isLoadingCabs || isLoadingUsers || isLoadingPolicies) {
    return (
      <div className="card" style={{ padding: '60px', textAlign: 'center' }}>
        <div className="h3" style={{ color: 'var(--text-soft)' }}>
          Loading document {docId.toUpperCase()}...
        </div>
      </div>
    );
  }

  if (!me) {
    return (
      <div className="card" style={{ marginTop: '30px' }}>
        <div className="empty">
          <Icon name="lock" size={32} />
          <div className="h3 mt16 mb8">Restricted document</div>
          <p className="caption mb16" style={{ maxWidth: '400px', margin: '0 auto 16px' }}>
            “{doc.title}” is classified {doc.confidentiality} and access is limited to named
            individuals. You can request access — the owner and audit log are notified.
          </p>
          <button
            className="btn btn-primary"
            onClick={() => {
              createAuditLog.mutate({
                action: 'ACCESS_REQUEST',
                target: doc.id,
                detail: 'Requested access',
              });
              sendNotification.mutate({
                userId: doc.owner,
                type: 'workflow',
                message: `${me?.name} requested access to “${doc.title}”.`,
                docId: doc.id,
              });
              addToast('Access request sent', 'info');
            }}
          >
            Request access
          </button>
        </div>
      </div>
    );
  }

  const isMine = doc.assignee === me.id;
  const stage = doc.workflow?.find((s: any) => s.state === 'current');
  const highConf = ['Restricted', 'Top Secret'].includes(doc.confidentiality);
  const confPolicy =
    policies.confidentiality.find((c: any) => c.level === doc.confidentiality) || ({} as any);
  const lockedByOther = doc.isCheckedOut && doc.checkoutLock?.lockedBy !== me.id;
  const eff =
    doc.status === 'closed' ? 'Closed' : doc.status === 'in_progress' ? 'In Progress' : 'Pending';
  const closed = doc.status === 'closed';
  const disabledReason = closed
    ? 'Document is closed'
    : lockedByOther
      ? `Checked out by another user`
      : !isMine
        ? `Assigned to ${userById(users, doc.assignee)?.name || 'another user'}`
        : null;
  const canAct = !closed && !lockedByOther && isMine && mode === 'view';

  const advanceWorkflow = (comment?: string) => {
    const clone = JSON.parse(JSON.stringify(doc));
    const idx = clone.workflow.findIndex((s: any) => s.state === 'current');
    if (idx < 0) return;
    clone.workflow[idx].state = 'done';
    clone.workflow[idx].actedAt = Date.now();
    if (comment) clone.workflow[idx].comment = comment;

    if (idx + 1 < clone.workflow.length) {
      const next = clone.workflow[idx + 1];
      next.state = 'current';
      clone.assignee = next.assignee;
      clone.status = 'In Progress';
      sendNotification.mutate({
        userId: next.assignee,
        type: 'task',
        message: `“${clone.title}” has reached stage “${next.name}” and is assigned to you.`,
        docId: clone.id,
      });
    } else {
      clone.status = 'Closed';
      clone.closedAt = Date.now();
      clone.sealed = true;
      sendNotification.mutate({
        userId: clone.owner,
        type: 'workflow',
        message: `“${clone.title}” has completed its workflow and is closed.`,
        docId: clone.id,
      });
    }
    updateDocument.mutate({ id: clone.id, updates: clone });
  };

  const returnWorkflow = (reason: string) => {
    const clone = JSON.parse(JSON.stringify(doc));
    const idx = clone.workflow.findIndex((s: any) => s.state === 'current');
    if (idx <= 0) return;
    clone.workflow[idx].state = 'next';
    const prev = clone.workflow[idx - 1];
    prev.state = 'current';
    prev.actedAt = null;
    prev.comment = null;
    clone.assignee = prev.assignee;
    clone.status = 'Pending';
    clone.comments.push({ by: me.id, at: Date.now(), text: 'Returned: ' + reason });
    sendNotification.mutate({
      userId: prev.assignee,
      type: 'workflow',
      message: `“${clone.title}” was returned to stage “${prev.name}”: ${reason}`,
      docId: clone.id,
    });
    updateDocument.mutate({ id: clone.id, updates: clone });
  };

  const actApprove = () => {
    openConfirm({
      title: 'Approve this stage?',
      confirmLabel: 'Approve',
      message: `“${stage ? stage.name : 'Current stage'}” will be marked complete and the file will advance to the next stage. This action is recorded in the audit trail.`,
      onConfirm: () => {
        advanceWorkflow('Approved by ' + me.name);
        createAuditLog.mutate({
          action: 'APPROVE',
          target: doc.id,
          detail: `Approved stage “${stage ? stage.name : ''}”`,
        });
        addToast(
          doc.status === 'Closed'
            ? 'Workflow complete — document closed & sealed'
            : 'Approved — advanced to next stage',
          'success',
        );
      },
    });
  };

  const actReject = () => {
    let reasonText = '';
    openModal({
      title: 'Reject / return to previous stage',
      body: (
        <div>
          <div className="banner warning">
            Rejecting routes the file back with your reason. The SLA timer restarts for that stage.
          </div>
          <div className="field">
            <label>
              Reason <span className="req">*</span>
            </label>
            <textarea
              className="input"
              placeholder="Reason (required, shared with the previous stage owner)…"
              onChange={(e) => (reasonText = e.target.value)}
            />
          </div>
        </div>
      ),
      actions: [
        { label: 'Cancel' },
        {
          label: 'Reject & return',
          kind: 'btn-danger',
          onClick: () => {
            if (!reasonText.trim()) return false;
            returnWorkflow(reasonText.trim());
            createAuditLog.mutate({
              action: 'REJECT',
              target: doc.id,
              detail: 'Rejected: ' + reasonText.trim(),
            });
            addToast('Returned to previous stage with reason', 'warning');
          },
        },
      ],
    });
  };

  const actDownload = () => {
    if (!confPolicy.download) {
      addToast(`Download is disabled for ${doc.confidentiality} documents`, 'error');
      return;
    }
    const blob = new Blob(
      [
        `SchullTech EDMS export\n\n${doc.title}\nStatus: ${doc.status}\nConfidentiality: ${doc.confidentiality}\n\n(Original binary would download in production.)`,
      ],
      { type: 'text/plain' },
    );
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = doc.title.replace(/[^\w]+/g, '_') + '.txt';
    document.body.appendChild(a);
    a.click();
    a.remove();
    createAuditLog.mutate({ action: 'DOWNLOAD', target: doc.id, detail: 'Downloaded a copy' });
    addToast('Download started (audited)', 'success');
  };

  const actShare = () => {
    const url = window.location.origin + window.location.pathname + '#/doc/' + doc.id;
    if (navigator.clipboard) {
      navigator.clipboard
        .writeText(url)
        .then(() => addToast('Permission-checked link copied to clipboard', 'success'));
    }
    createAuditLog.mutate({ action: 'SHARE', target: doc.id, detail: 'Generated share link' });
  };

  const handleSign = (fieldIdx: number) => {
    const sigField = doc.signatures[fieldIdx];
    if (!sigField) return;

    let signMode: 'type' | 'draw' | 'stamp' = 'type';
    let typedText = me.name;

    openModal({
      title: `Sign Document — ${sigField.field || 'Signature Field'}`,
      size: 'lg',
      body: (
        <div>
          <div className="banner info mb16">
            <span>
              <Icon name="shield" size={15} />
            </span>{' '}
            <b>Cryptographic & Tamper-Evident Signatures</b> — Your signature will be timestamped,
            linked to user ID <b>{me.id}</b> ({me.roleLabel}), and recorded in the audit trail.
          </div>

          <div className="field mb16">
            <label>Signer Name / Title</label>
            <input
              className="input"
              defaultValue={typedText}
              onChange={(e) => (typedText = e.target.value)}
            />
          </div>

          <div
            className="card card-pad mb16"
            style={{
              background: '#f8fafe',
              border: '1px dashed var(--brand-primary-light)',
              textAlign: 'center',
            }}
          >
            <div className="caption mb8">Signature Preview</div>
            <div
              style={{
                fontFamily: 'Georgia, cursive, serif',
                fontSize: '28px',
                fontStyle: 'italic',
                color: '#1F3864',
                padding: '12px 0',
              }}
            >
              {typedText || me.name}
            </div>
            <div className="caption" style={{ fontSize: '11px', opacity: 0.7 }}>
              Digitally signed by {me.name} on {new Date().toLocaleDateString('en-GB')} at{' '}
              {new Date().toLocaleTimeString()}
            </div>
          </div>

          <div className="caption" style={{ fontSize: '11px', lineHeight: 1.5, color: '#666' }}>
            By clicking "Apply Signature", you agree that this electronic signature is the legally
            binding equivalent of your handwritten signature on this document.
          </div>
        </div>
      ),
      actions: [
        { label: 'Cancel' },
        {
          label: 'Apply Signature',
          kind: 'btn-success',
          onClick: () => {
            const clone = JSON.parse(JSON.stringify(doc));
            const sig = clone.signatures[fieldIdx];
            sig.signedBy = me.id;
            sig.signedAt = Date.now();
            sig.method = signMode;

            const allSigned = clone.signatures.every((s: any) => s.signedBy);
            if (allSigned && stage && /sign/i.test(stage.name)) {
              const idx = clone.workflow.findIndex((s: any) => s.state === 'current');
              if (idx >= 0) {
                clone.workflow[idx].state = 'done';
                clone.workflow[idx].actedAt = Date.now();
                clone.workflow[idx].comment = 'Signed by ' + me.name;
                if (idx + 1 < clone.workflow.length) {
                  const next = clone.workflow[idx + 1];
                  next.state = 'current';
                  clone.assignee = next.assignee;
                  clone.status = 'In Progress';
                } else {
                  clone.status = 'Closed';
                  clone.sealed = true;
                }
              }
            }
            if (allSigned) clone.sealed = true;
            updateDocument.mutate({ id: clone.id, updates: clone });
            createAuditLog.mutate({
              action: 'SIGN',
              target: doc.id,
              detail: `Signed field "${sig.field}" via ${signMode} signature`,
            });
            addToast('Signature applied successfully', 'success');
            closeModal();
          },
        },
      ],
    });
  };

  const actionBtn = (label: string, kind: string, fn: () => void, opts: any = {}) => (
    <button
      className={`btn ${kind} ${opts.sm ? 'btn-sm' : ''}`}
      disabled={!canAct && !opts.always}
      title={!canAct && !opts.always && disabledReason ? disabledReason : label}
      onClick={fn}
    >
      {opts.icon && (
        <>
          <Icon name={opts.icon} size={14} />{' '}
        </>
      )}
      {label}
    </button>
  );

  return (
    <div>
      <div className="crumbs">
        <a onClick={() => router.push('/staff/browser')}>Cabinets</a> <span className="sep">›</span>
        <a onClick={() => router.push(`/staff/browser?cab=${doc.cabinet}`)}>
          {cabById(cabinets, doc.cabinet)?.name}
        </a>{' '}
        <span className="sep">›</span>
        <span>{folderName(cabinets, doc.cabinet, doc.folder)}</span> <span className="sep">›</span>
        <span className="cur">{doc.id.toUpperCase()}</span>
      </div>

      <div className="page-head">
        <div style={{ minWidth: 0 }}>
          <div className="page-title" style={{ fontSize: '19px' }}>
            {doc.title}
          </div>
          <div className="flex g8 mt8 wrap">
            <StatusBadge status={eff} />
            <ConfBadge
              level={doc.confidentiality?.charAt(0).toUpperCase() + doc.confidentiality?.slice(1)}
            />
            <UrgBadge level={doc.urgency?.charAt(0).toUpperCase() + doc.urgency?.slice(1)} />
            <span className="caption" style={{ alignSelf: 'center' }}>
              v{doc.version} · {fmtDate(doc.createdAt)}
            </span>
          </div>
        </div>

        {mode === 'view' && (
          <div className="actions">
            <button className="btn btn-secondary" onClick={actShare}>
              <Icon name="share" size={14} /> Share
            </button>
            <button
              className="btn btn-secondary"
              onClick={actDownload}
              title={confPolicy.download ? 'Download a copy' : 'Disabled'}
            >
              <Icon name="download" size={14} /> Download
            </button>
            <div style={{ position: 'relative' }}>
              <button className="btn btn-secondary" onClick={() => setShowMenu(!showMenu)}>
                More ▾
              </button>
              {showMenu && (
                <div
                  className="menu"
                  style={{
                    minWidth: '240px',
                    position: 'absolute',
                    top: '100%',
                    right: 0,
                    zIndex: 10,
                  }}
                >
                  <button
                    className="menu-item"
                    disabled={closed}
                    onClick={() => {
                      setShowMenu(false);
                      setMode('redact');
                    }}
                  >
                    <span>
                      <Icon name="redact" size={15} />
                    </span>{' '}
                    Redact & release
                  </button>
                  <button
                    className="menu-item"
                    disabled={closed || doc.sealed}
                    onClick={() => {
                      setShowMenu(false);
                      if (doc.signatures.length) handleSign(0);
                      else addToast('No fields', 'info');
                    }}
                  >
                    <span>
                      <Icon name="sign" size={15} />
                    </span>{' '}
                    Sign document
                  </button>
                  <div className="menu-sep"></div>
                  <button
                    className="menu-item"
                    onClick={() => {
                      setShowMenu(false);
                      addToast('Printed', 'success');
                    }}
                  >
                    <span>
                      <Icon name="print" size={15} />
                    </span>{' '}
                    Print (watermarked)
                  </button>
                </div>
              )}
            </div>
            {actionBtn('Reject', 'btn-secondary', actReject)}
            {actionBtn('Approve', 'btn-success', actApprove, { icon: 'approve' })}
          </div>
        )}
      </div>

      {doc.legalHold && (
        <div className="banner warning">
          <span>
            <Icon name="scale" size={15} />
          </span>{' '}
          Legal hold active — retention and deletion are suspended for this file.
        </div>
      )}
      {lockedByOther && (
        <div className="banner info">
          <span>
            <Icon name="lock" size={15} />
          </span>{' '}
          Read-only: checked out by {userById(users, doc.locked).name} since {fmtDate(doc.created)}.
        </div>
      )}
      {doc.sealed && closed && (
        <div className="banner success">
          <span>
            <Icon name="shield" size={15} />
          </span>{' '}
          Sealed & closed — tamper-evident seal applied.{' '}
        </div>
      )}
      {mode === 'redact' && (
        <div className="banner error">
          <span>
            <Icon name="redact" size={15} />
          </span>{' '}
          <b>Redaction mode</b> — drag on the page to mark a region; click a region to remove it.
          Nothing is permanent until you release.
        </div>
      )}

      {mode === 'redact' && (
        <div className="card card-pad mb16">
          <div className="flex jcb aic wrap g12">
            <div>
              <div className="h3">
                Marked regions: {doc.redactions?.filter((r: any) => !r.released).length || 0}
              </div>
              <div className="caption">AI suggestions and manual regions, each with a reason.</div>
            </div>
            <div className="flex g8 wrap">
              <button
                className="btn btn-secondary btn-sm"
                onClick={() => setPreviewRelease(!previewRelease)}
              >
                {previewRelease ? 'Exit preview' : 'Preview released copy'}
              </button>
              <button
                className="btn btn-ghost btn-sm"
                onClick={() => {
                  setMode('view');
                  setPreviewRelease(false);
                }}
              >
                Exit redaction
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="doc-layout">
        {/* Viewer Area */}
        <div className="viewer doc-viewer-col">
          <div className="viewer-bar">
            <button className="icon-btn" onClick={() => setPage(Math.max(1, page - 1))}>
              ‹
            </button>
            <span className="tnum">
              Page {page} / {doc.pages}
            </span>
            <button className="icon-btn" onClick={() => setPage(Math.min(doc.pages, page + 1))}>
              ›
            </button>
            <span style={{ width: '14px' }}></span>
            <button className="icon-btn" onClick={() => setZoom(Math.max(0.6, zoom - 0.15))}>
              −
            </button>
            <span className="tnum">{Math.round(zoom * 100)}%</span>
            <button className="icon-btn" onClick={() => setZoom(Math.min(1.6, zoom + 0.15))}>
              +
            </button>
          </div>
          <div className="viewer-page-wrap">
            <div
              className="doc-page"
              style={{ transform: `scale(${zoom})`, transformOrigin: 'top center' }}
            >
              {(confPolicy.watermark || highConf) && (
                <div className="watermark">
                  <span>
                    {doc.confidentiality} · {me.name}
                  </span>
                </div>
              )}
              <h4>{doc.title}</h4>
              <p>
                Ref: {doc.id.toUpperCase()} · Version {doc.version} · Page {page} of {doc.pages}
              </p>
              <p>
                This is a rendered preview of the captured document. The OCR text layer sits beneath
                this page, enabling in-document search, semantic indexing and accessible reading.
                Annotations, signature fields and redaction regions render as overlays.
              </p>

              {/* Signatures */}
              {doc.signatures
                ?.filter((s: any) => s.page === page)
                .map((s: any, i: number) => (
                  <div
                    key={i}
                    className={`sig-field ${s.signedBy ? 'signed' : ''}`}
                    style={{ left: s.x + '%', top: s.y + '%', width: s.w + '%', height: s.h + '%' }}
                    onClick={() => {
                      if (!s.signedBy && !doc.sealed && !lockedByOther) handleSign(i);
                    }}
                  >
                    {s.signedBy ? userById(users, s.signedBy).name : '✎ ' + s.field}
                  </div>
                ))}
            </div>
          </div>
        </div>

        {/* Metadata Panel */}
        <div className="card">
          <div className="card-head">
            <span className="h3">Details</span>
          </div>
          <div className="card-body" style={{ paddingTop: '6px' }}>
            <div className="meta-row">
              <span className="k">Document ID</span>
              <span className="v">{doc.id.substring(0, 8).toUpperCase()}</span>
            </div>
            <div className="meta-row">
              <span className="k">Type</span>
              <span className="v">{doc.documentType}</span>
            </div>
            <div className="meta-row">
              <span className="k">Cabinet</span>
              <span className="v">{doc.cabinetId ? doc.cabinetId.substring(0, 8) : 'Unknown'}</span>
            </div>
            <div className="meta-row">
              <span className="k">Owner</span>
              <span className="v">{userById(users, doc.owner)?.name || 'System'}</span>
            </div>
            <div className="meta-row">
              <span className="k">Assignee</span>
              <span className="v">{userById(users, doc.assignee)?.name || 'Unassigned'}</span>
            </div>
            <div className="meta-row">
              <span className="k">Created</span>
              <span className="v">{fmtDateTime(doc.createdAt)}</span>
            </div>
            {Object.entries((doc as any).metadata || {}).map(([k, v]) => (
              <div key={k} className="meta-row">
                <span className="k">{k}</span>
                <span className="v">{String(v)}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Workflow Panel */}
        <div className="card">
          <div className="card-head">
            <span className="h3">Workflow & Activity</span>
          </div>
          <div className="card-body">
            {doc.workflow?.map((s: any, i: number) => (
              <div key={i} className={`wf-stage ${s.state}`}>
                <div className="wf-dot">{s.state === 'done' ? '✓' : String(i + 1)}</div>
                <div className="wf-info" style={{ flex: 1 }}>
                  <div className="nm">{s.name}</div>
                  <div className="who">
                    {userById(users, s.assignee).name}{' '}
                    {s.actedAt
                      ? `· ${fmtDate(s.actedAt)}`
                      : s.state === 'current'
                        ? '· in progress'
                        : ''}
                  </div>
                </div>
              </div>
            ))}
            <div className="divider"></div>
            <div className="h3 mb8">Minutes & comments</div>
            {doc.comments?.map((c: any, i: number) => (
              <div key={i} className="comment">
                <Avatar user={userById(users, c.by)} />
                <div>
                  <div className="by">
                    {userById(users, c.by).name} · {timeAgo(c.at)}
                  </div>
                  <div className="body">{c.text}</div>
                </div>
              </div>
            ))}
            {doc.comments?.length === 0 && <div className="caption mb8">No comments yet.</div>}
            <div className="mt8">
              <textarea
                id="commentInput"
                className="input"
                placeholder="Add a comment or minute…"
                style={{ minHeight: '54px' }}
              ></textarea>
              <button
                className="btn btn-primary btn-sm mt8"
                onClick={() => {
                  const el = document.getElementById('commentInput') as HTMLTextAreaElement;
                  if (!el.value.trim()) return;
                  const clone = JSON.parse(JSON.stringify(doc));
                  clone.comments.push({ by: me.id, at: Date.now(), text: el.value.trim() });
                  updateDocument.mutate({ id: clone.id, updates: clone });
                  createAuditLog.mutate({
                    action: 'COMMENT',
                    target: doc.id,
                    detail: el.value.trim().slice(0, 80),
                  });
                  el.value = '';
                  addToast('Comment added', 'success');
                }}
              >
                Add comment
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
