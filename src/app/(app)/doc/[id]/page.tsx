'use client';

import React, { useEffect, useState, use } from 'react';
import { useRouter } from 'next/navigation';
import { useStore, cabById, userById } from '@/store/useStore';
import { useUIStore } from '@/store/useUIStore';
import {
  useDocument,
  useAddDocumentComment,
  useAddDocumentSignature,
  useCheckoutDocument,
  useCheckinDocument,
} from '@/apis/hooks/useDocuments';
import { useCabinets } from '@/apis/hooks/useCabinets';
import { useCabinetFolders } from '@/apis/hooks/useFolders';
import { useUsers } from '@/apis/hooks/useUsers';
import { usePolicies } from '@/apis/hooks/usePolicies';
import { useCreateAuditLog } from '@/apis/hooks/useAudit';
import { useTaskAction } from '@/apis/hooks/useTasks';
import { useWorkflowInstances, useWorkflowInstance } from '@/apis/hooks/useWorkflowInstances';
import { Icon } from '@/components/ui/Icons';
import { StatusBadge, UrgBadge, ConfBadge } from '@/components/ui/Badges';
import { fmtDateTime, fmtDate } from '@/utils/helpers';
import { DocumentViewerPanel } from '@/components/documents/DocumentViewerPanel';
import { DocumentDetailsPanel } from '@/components/documents/DocumentDetailsPanel';
import { WorkflowActivityPanel } from '@/components/workflowInstances/WorkflowActivityPanel';
import type { DocumentWithUiExtras, DocumentSignatureFieldUI } from '@/components/documents/types';

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

  const addDocumentComment = useAddDocumentComment();
  const addDocumentSignature = useAddDocumentSignature();
  const createAuditLog = useCreateAuditLog();
  const taskAction = useTaskAction();
  const checkoutDocument = useCheckoutDocument();
  const checkinDocument = useCheckinDocument();

  const [mode, setMode] = useState<'view' | 'redact'>('view');
  const [previewRelease, setPreviewRelease] = useState(false);
  const [zoom, setZoom] = useState(1);
  const [showMenu, setShowMenu] = useState(false);

  const { data: rawDoc, isLoading } = useDocument(docId);
  const me = currentUser;

  // `comments`/`signatures`/`sealed`/`legalHold` have no backing endpoint at
  // all (confirmed live: POST /documents/{id}/comments and /signatures both
  // 404) — always empty/false in practice. See types.ts for why these stay
  // explicitly typed instead of just disappearing behind @ts-nocheck.
  const doc: DocumentWithUiExtras | null = rawDoc
    ? {
        ...rawDoc,
        signatures: (rawDoc as { signatures?: DocumentSignatureFieldUI[] }).signatures || [],
        comments: (rawDoc as { comments?: DocumentWithUiExtras['comments'] }).comments || [],
        sealed: (rawDoc as { sealed?: boolean }).sealed || false,
        legalHold: (rawDoc as { legalHold?: boolean }).legalHold || false,
      }
    : null;

  // "Who owns this right now" isn't a Document field on the real API — it only
  // exists as the assignee of whichever task is currently active in the
  // document's workflow instance. `GET /workflow-instances?documentId=` gives
  // the instance id; the single-instance GET is what actually embeds `tasks[]`
  // and the stage definitions (verified against the live backend — the list
  // response doesn't carry either).
  const { data: instancesData } = useWorkflowInstances({ documentId: doc?.id }, { enabled: !!doc?.id });
  const instanceSummary = instancesData?.data?.[0];
  const { data: workflowInstance } = useWorkflowInstance(instanceSummary?.id);
  const currentTask = workflowInstance?.tasks?.find((t) => t.status === 'pending');

  const { data: activeCabFoldersData } = useCabinetFolders(doc?.cabinetId);
  const activeCabFolders = activeCabFoldersData?.data || [];
  const folderObj = activeCabFolders.find((f) => f.id === doc?.folderId);
  const folderLabel = folderObj ? folderObj.name : '';

  useEffect(() => {
    if (doc?.title) {
      setPageTitle(doc.title);
    }
  }, [doc?.title, setPageTitle]);

  if (isLoading || isLoadingCabs || isLoadingUsers || isLoadingPolicies) {
    return (
      <div className="card" style={{ padding: '60px', textAlign: 'center' }}>
        <div className="h3" style={{ color: 'var(--text-soft)' }}>
          Loading document...
        </div>
      </div>
    );
  }

  if (!doc) {
    return (
      <div className="card">
        <div className="empty">
          <Icon name="doc" size={32} />
          <div className="h3 mt16 mb8">Document not found</div>
          <p className="caption mb16">It may have been moved or deleted.</p>
          <button className="btn btn-primary btn-sm" onClick={() => router.push('/staff/cabinets')}>
            Browse cabinets
          </button>
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
              // The document owner is notified server-side once the
              // access-request endpoint exists. The client deliberately does
              // not mint a notification for another user — see
              // docs/BACKEND_REQUESTS.md (BE-1).
              addToast('Access request recorded', 'info');
            }}
          >
            Request access
          </button>
        </div>
      </div>
    );
  }

  // "Mine" and "can act" are governed by the current task's assignee, not any
  // field on the document itself — the real Document type has no assignee.
  const isMine =
    !!currentTask &&
    (currentTask.assigneeId === me.id ||
      (!!currentTask.assignedRole?.name && me.roles?.includes(currentTask.assignedRole.name)));
  const stageDef = workflowInstance?.workflowDefinition?.definition?.stages?.find(
    (s) => s.id === workflowInstance?.currentStage,
  );
  const stage = stageDef ? { name: stageDef.name || stageDef.id } : null;
  const currentStageActorName = currentTask?.assignee?.name || currentTask?.assignedRole?.name || 'Unassigned';

  const rawFileKey = doc.currentVersion?.fileKey;
  // The API now returns a ready-to-use pre-signed URL on the current version —
  // pass it through untouched (it's already encoded; re-encoding risks breaking
  // the signature). Fall back to `fileKey` only when it's itself an absolute
  // URL, which happens with seed/fixture data.
  const signedFileUrl = doc.currentVersion?.fileUrl?.trim() || undefined;
  const fileKeyIsUrl = !!rawFileKey && /^https?:\/\//i.test(rawFileKey);
  const fileUrl = signedFileUrl ?? (fileKeyIsUrl ? encodeURI(rawFileKey as string) : undefined);
  const fileMimeType = doc.currentVersion?.mimeType || '';

  const highConf = ['restricted', 'confidential'].includes(doc.confidentiality.toLowerCase());
  // policiesService returns { confidentiality: [{ level, desc, watermark, download, print }], … }.
  // This previously looked for an array of { key: 'confidentiality.<tier>', value: {…} } —
  // a shape nothing produces — so `find` always missed and every document silently fell
  // back to "download and print allowed, no watermark", including restricted ones.
  // Fixture levels are display-cased with spaces ("Top Secret"); the backend
  // sends snake_case tiers ("top_secret"). Normalise both sides before matching.
  const normaliseTier = (v: string) => v.trim().toLowerCase().replace(/[\s-]+/g, '_');
  const confTiers: any[] = (policiesData as any)?.confidentiality ?? [];
  const confPolicyItem = confTiers.find(
    (p) => normaliseTier(String(p.level)) === normaliseTier(doc.confidentiality),
  );
  const confPolicy = {
    download: confPolicyItem?.download ?? true,
    print: confPolicyItem?.print ?? true,
    watermark: confPolicyItem?.watermark ?? false,
  };
  const lockedByOther = doc.isCheckedOut && doc.checkoutLock?.lockedBy !== me.id;
  const lockedByMe = doc.isCheckedOut && doc.checkoutLock?.lockedBy === me.id;
  const checkoutBusy = checkoutDocument.isPending || checkinDocument.isPending;
  const eff =
    doc.status === 'closed' ? 'Closed' : doc.status === 'in_progress' ? 'In Progress' : 'Pending';
  const closed = doc.status === 'closed';
  const disabledReason = closed
    ? 'Document is closed'
    : lockedByOther
      ? `Checked out by another user`
      : !currentTask
        ? 'No action is pending on this document'
        : !isMine
          ? `Assigned to ${currentStageActorName}`
          : null;
  const canAct = !closed && !lockedByOther && !!currentTask && isMine && mode === 'view';

  const actApprove = () => {
    if (!currentTask) return;
    openConfirm({
      title: 'Approve this stage?',
      confirmLabel: 'Approve',
      message: `“${stage ? stage.name : 'Current stage'}” will be marked complete and the file will advance to the next stage. This action is recorded in the audit trail.`,
      onConfirm: () => {
        taskAction.mutate(
          { id: currentTask.id, actionReq: { action: 'approve', note: 'Approved by ' + me.name } },
          {
            onSuccess: () => {
              createAuditLog.mutate({
                action: 'APPROVE',
                target: doc.id,
                detail: `Approved stage “${stage ? stage.name : ''}”`,
              });
              addToast('Approved — advanced to next stage', 'success');
            },
          },
        );
      },
    });
  };

  // "Reject" in this UI means "send it back with a reason" (SLA restarts on the
  // previous stage) — that's the real `request_changes` action, not `reject`
  // (which the API uses to terminate the workflow outright).
  const actReject = () => {
    if (!currentTask) return;
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
            taskAction.mutate(
              {
                id: currentTask.id,
                actionReq: { action: 'request_changes', note: reasonText.trim() },
              },
              {
                onSuccess: () => {
                  createAuditLog.mutate({
                    action: 'REJECT',
                    target: doc.id,
                    detail: 'Rejected: ' + reasonText.trim(),
                  });
                  addToast('Returned to previous stage with reason', 'warning');
                },
              },
            );
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

    const a = document.createElement('a');
    if (fileUrl) {
      // Real pre-signed URL — hand it straight to the browser. The `download`
      // hint is honoured for same-origin responses and ignored cross-origin
      // (S3), where the tab opens the file instead; either way it's the file.
      a.href = fileUrl;
      a.rel = 'noreferrer';
      a.target = '_blank';
      a.download = doc.title.replace(/[^\w]+/g, '_');
    } else {
      const blob = new Blob(
        [
          `SchullTech EDMS export\n\n${doc.title}\nStatus: ${doc.status}\nConfidentiality: ${doc.confidentiality}\n\n(No file is attached to this version.)`,
        ],
        { type: 'text/plain' },
      );
      a.href = URL.createObjectURL(blob);
      a.download = doc.title.replace(/[^\w]+/g, '_') + '.txt';
    }
    document.body.appendChild(a);
    a.click();
    a.remove();
    createAuditLog.mutate({ action: 'DOWNLOAD', target: doc.id, detail: 'Downloaded a copy' });
    addToast('Download started (audited)', 'success');
  };

  const actCheckout = () => {
    let returnAt = '';
    openModal({
      title: 'Check out document',
      body: (
        <div>
          <div className="banner info">
            While checked out, the file is read-only for everyone else until you check it back in.
          </div>
          <div className="field">
            <label>Expected return (optional)</label>
            <input
              type="datetime-local"
              className="input"
              onChange={(e) => (returnAt = e.target.value)}
            />
          </div>
        </div>
      ),
      actions: [
        { label: 'Cancel' },
        {
          label: 'Check out',
          kind: 'btn-primary',
          onClick: () =>
            checkoutDocument
              .mutateAsync({
                id: doc.id,
                expectedReturnAt: returnAt ? new Date(returnAt).toISOString() : undefined,
              })
              .then(() => {
                createAuditLog.mutate({
                  action: 'CHECKOUT',
                  target: doc.id,
                  detail: 'Checked out for editing',
                });
                closeModal();
              })
              .catch(() => false),
        },
      ],
    });
  };

  const actCheckin = () => {
    openConfirm({
      title: 'Check in document?',
      confirmLabel: 'Check in',
      message:
        'This releases your lock so others can edit again. Upload any new version first — check-in does not do that for you.',
      onConfirm: () =>
        checkinDocument
          .mutateAsync(doc.id)
          .then(() => {
            createAuditLog.mutate({
              action: 'CHECKIN',
              target: doc.id,
              detail: 'Checked in',
            });
          })
          .catch(() => {
            /* hook surfaces the error toast */
          }),
    });
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
    const sigField = doc.signatures[fieldIdx] || { field: 'Signature Field' };

    let signMode: 'typed' | 'drawn' | 'stamp' = 'typed';
    let typedText = me.name;
    let passwordVal = '';
    const fieldLabel = sigField.field || sigField.fieldName || 'Signature Field';

    openModal({
      title: `Sign Document — ${fieldLabel}`,
      size: 'lg',
      body: (
        <div>
          <div className="banner info mb16">
            <span>
              <Icon name="shield" size={15} />
            </span>{' '}
            <b>Cryptographic & Tamper-Evident Signatures</b> — Your signature will be timestamped,
            linked to user ID <b>{me.id}</b> ({me.roles?.[0] || 'User'}), and recorded in the audit
            trail.
          </div>

          <div className="field mb16">
            <label>Signer Name / Title</label>
            <input
              className="input"
              defaultValue={typedText}
              onChange={(e) => (typedText = e.target.value)}
            />
          </div>

          <div className="field mb16">
            <label>
              Re-enter Password to Confirm Signature <span className="req">*</span>
            </label>
            <input
              type="password"
              className="input"
              placeholder="Enter your account password…"
              onChange={(e) => (passwordVal = e.target.value)}
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
            if (!passwordVal.trim()) {
              addToast('Password re-entry is required to apply signature', 'error');
              return false;
            }
            addDocumentSignature.mutate(
              {
                id: doc.id,
                fieldName: fieldLabel,
                method: signMode,
                password: passwordVal,
              },
              {
                onSuccess: () => {
                  createAuditLog.mutate({
                    action: 'SIGN',
                    target: doc.id,
                    detail: `Signed field "${fieldLabel}" via ${signMode} signature`,
                  });
                  closeModal();
                },
              },
            );
          },
        },
      ],
    });
  };

  const actionBtn = (
    label: string,
    kind: string,
    fn: () => void,
    opts: { icon?: string; sm?: boolean; always?: boolean } = {},
  ) => (
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
        <a onClick={() => router.push('/staff/cabinets')}>Cabinets</a>{' '}
        <span className="sep">›</span>
        <a onClick={() => router.push(`/staff/cabinets?cab=${doc.cabinetId}`)}>
          {cabById(cabinets, doc.cabinetId)?.name}
        </a>{' '}
        <span className="sep">›</span>
        <span>{folderLabel}</span> <span className="sep">›</span>
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
              level={doc.confidentiality.charAt(0).toUpperCase() + doc.confidentiality.slice(1)}
            />
            <UrgBadge level={doc.urgency.charAt(0).toUpperCase() + doc.urgency.slice(1)} />
            <span className="caption" style={{ alignSelf: 'center' }}>
              v{doc.currentVersion?.versionNumber ?? 1} · {fmtDate(doc.createdAt)}
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
            {lockedByMe ? (
              <button
                className="btn btn-secondary"
                onClick={actCheckin}
                disabled={checkoutBusy}
              >
                <Icon name="lock" size={14} /> Check in
              </button>
            ) : (
              <button
                className="btn btn-secondary"
                onClick={actCheckout}
                disabled={checkoutBusy || closed || lockedByOther}
                title={
                  closed
                    ? 'Document is closed'
                    : lockedByOther
                      ? 'Checked out by another user'
                      : 'Check out for editing'
                }
              >
                <Icon name="key" size={14} /> Check out
              </button>
            )}
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
                      else addToast('No signature fields on this document', 'info');
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
          Read-only: checked out by {userById(users, doc.checkoutLock?.lockedBy)?.name} since{' '}
          {fmtDate(doc.checkoutLock?.lockedAt)}.
        </div>
      )}
      {lockedByMe && (
        <div className="banner info">
          <span>
            <Icon name="key" size={15} />
          </span>{' '}
          You have this checked out since {fmtDate(doc.checkoutLock?.lockedAt)}
          {doc.checkoutLock?.expectedReturnAt
            ? ` — due back ${fmtDate(doc.checkoutLock.expectedReturnAt)}`
            : ''}
          . Check it in when you&apos;re done so others can edit.
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
              <div className="h3">Marked regions: 0</div>
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

      <div className="flex gap-4">
        <DocumentViewerPanel
          documentTitle={doc.title}
          confidentiality={doc.confidentiality}
          fileUrl={fileUrl}
          rawFileKey={rawFileKey}
          fileMimeType={fileMimeType}
          showWatermark={confPolicy.watermark || highConf}
          watermarkText={`${doc.confidentiality} · ${me.name}`}
          zoom={zoom}
          onZoomChange={setZoom}
          signatures={doc.signatures}
          sealed={doc.sealed}
          lockedByOther={lockedByOther}
          onSignatureFieldClick={handleSign}
          getSignerName={(userId) => userById(users, userId)?.name || 'User'}
        />

        <div className="flex flex-col gap-4">
          <DocumentDetailsPanel
            documentId={doc.id}
            documentType={doc.documentType}
            cabinetId={doc.cabinetId}
            ownerName={userById(users, doc.createdBy)?.name || 'System'}
            assigneeName={currentTask ? currentStageActorName : 'Unassigned'}
            createdAtLabel={fmtDateTime(doc.createdAt)}
            metadata={doc.metadata || []}
          />

          <WorkflowActivityPanel
            workflowInstance={workflowInstance}
            currentStageActorName={currentStageActorName}
            comments={doc.comments}
            getCommentAuthor={(c) => c.creator || userById(users, c.createdBy)}
            isAddingComment={addDocumentComment.isPending}
            onAddComment={(text) => {
              addDocumentComment.mutate(
                { id: doc.id, text },
                {
                  onSuccess: () => {
                    createAuditLog.mutate({
                      action: 'COMMENT',
                      target: doc.id,
                      detail: text.slice(0, 80),
                    });
                  },
                },
              );
            }}
          />
        </div>
      </div>
    </div>
  );
}
