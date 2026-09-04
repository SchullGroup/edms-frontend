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
import { useRouteToWorkflow } from '@/hooks/useRouteToWorkflow';
import { Icon } from '@/components/ui/Icons';
import { StatusBadge, UrgBadge, ConfBadge } from '@/components/ui/Badges';
import { fmtDateTime, fmtDate } from '@/utils/helpers';
import { DocumentViewerPanel } from '@/components/documents/DocumentViewerPanel';
import { DocumentDetailsPanel } from '@/components/documents/DocumentDetailsPanel';
import { WorkflowActivityPanel } from '@/components/workflowInstances/WorkflowActivityPanel';
import type { DocumentWithUiExtras, DocumentSignatureFieldUI } from '@/components/documents/types';
import type { WorkflowStageAction } from '@/types/models';
import { Skeleton, SkeletonText } from '@/components/common/Skeleton';

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
  const { routeDocuments } = useRouteToWorkflow();

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
  const { data: instancesData, isLoading: isLoadingInstances } = useWorkflowInstances(
    { documentId: doc?.id },
    { enabled: !!doc?.id },
  );
  // A document can be routed more than once, so the list isn't a single row.
  // The live instance is the one that matters; fall back to the most recent
  // closed one so a finished document still shows its trail.
  const orderedInstances = [...(instancesData?.data || [])].sort(
    (a, b) => new Date(b.startedAt).getTime() - new Date(a.startedAt).getTime(),
  );
  const instanceSummary =
    orderedInstances.find((i) => i.status !== 'closed') || orderedInstances[0];
  const { data: workflowInstance } = useWorkflowInstance(instanceSummary?.id);
  const currentTask = workflowInstance?.tasks?.find((t) => t.status === 'pending');
  // Only offer routing once we know there is nothing running — otherwise the
  // CTA flashes on every load before the instance list resolves.
  const hasNoWorkflow = !isLoadingInstances && !instanceSummary;

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
    return <DocumentDetailSkeleton />;
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
            individuals. You can request access — the request is written to the audit log for the
            owner to action.
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
  const currentStageActorName =
    currentTask?.assignee?.name || currentTask?.assignedRole?.name || 'Unassigned';

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

  // What the assignee may do here is whatever the stage definition allows. The
  // approve/return pair is only a fallback for when the definition didn't come
  // back with the instance, so the strip is never empty for a live task.
  const allowedActions: WorkflowStageAction[] = stageDef?.actions?.length
    ? stageDef.actions
    : ['approve', 'request_changes'];

  // Every stage action the API accepts is emitted from here, gated by what the
  // stage's `actions` list actually allows — `request_changes` (send the file
  // back a stage) and `reject` (terminate the workflow) are deliberately
  // separate, where they used to be conflated behind one "Reject" button.
  const runAction = (
    actionReq: Parameters<typeof taskAction.mutate>[0]['actionReq'],
    audit: { action: string; detail: string },
    toast: { message: string; kind: 'success' | 'warning' | 'error' },
  ) => {
    if (!currentTask) return;
    taskAction.mutate(
      { id: currentTask.id, actionReq },
      {
        onSuccess: () => {
          createAuditLog.mutate({ action: audit.action, target: doc.id, detail: audit.detail });
          addToast(toast.message, toast.kind);
        },
        onError: (err: any) => {
          addToast(err?.response?.data?.message || 'Action failed', 'error');
        },
      },
    );
  };

  const stageLabel = stage ? stage.name : 'Current stage';

  const actReview = () => {
    if (!currentTask) return;
    openConfirm({
      title: 'Mark this stage reviewed?',
      confirmLabel: 'Mark reviewed',
      message: `“${stageLabel}” will be marked reviewed and the file advances to the next stage. This is recorded in the audit trail.`,
      onConfirm: () =>
        runAction(
          { action: 'review', note: 'Reviewed by ' + me.name },
          { action: 'REVIEW', detail: `Reviewed stage “${stageLabel}”` },
          { message: 'Reviewed — advanced to next stage', kind: 'success' },
        ),
    });
  };

  const actApprove = () => {
    if (!currentTask) return;
    openConfirm({
      title: 'Approve this stage?',
      confirmLabel: 'Approve',
      message: `“${stageLabel}” will be marked complete and the file will advance to the next stage. This action is recorded in the audit trail.`,
      onConfirm: () =>
        runAction(
          { action: 'approve', note: 'Approved by ' + me.name },
          { action: 'APPROVE', detail: `Approved stage “${stageLabel}”` },
          { message: 'Approved — advanced to next stage', kind: 'success' },
        ),
    });
  };

  // Sends the file back one stage with a reason. The workflow stays alive.
  const actRequestChanges = () => {
    if (!currentTask) return;
    let reasonText = '';
    openModal({
      title: 'Request changes — return to previous stage',
      body: (
        <div>
          <div className="banner warning">
            The file goes back to the previous stage with your reason. The SLA timer restarts for
            that stage and the workflow stays open.
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
          label: 'Send back',
          kind: 'btn-secondary',
          onClick: () => {
            if (!reasonText.trim()) {
              addToast('A reason is required', 'error');
              return false;
            }
            runAction(
              { action: 'request_changes', note: reasonText.trim() },
              { action: 'REQUEST_CHANGES', detail: 'Changes requested: ' + reasonText.trim() },
              { message: 'Returned to previous stage with reason', kind: 'warning' },
            );
          },
        },
      ],
    });
  };

  // The terminating action — the workflow ends here and the document closes.
  const actReject = () => {
    if (!currentTask) return;
    let reasonText = '';
    openModal({
      title: 'Reject and end this workflow',
      body: (
        <div>
          <div className="banner error">
            Rejecting <b>ends the workflow outright</b> — the remaining stages are never raised and
            the document closes. To send it back for edits instead, use “Request changes”.
          </div>
          <div className="field">
            <label>
              Reason <span className="req">*</span>
            </label>
            <textarea
              className="input"
              placeholder="Reason (required, recorded on the workflow trail)…"
              onChange={(e) => (reasonText = e.target.value)}
            />
          </div>
        </div>
      ),
      actions: [
        { label: 'Cancel' },
        {
          label: 'Reject & end workflow',
          kind: 'btn-danger',
          onClick: () => {
            if (!reasonText.trim()) {
              addToast('A reason is required', 'error');
              return false;
            }
            runAction(
              { action: 'reject', note: reasonText.trim() },
              { action: 'REJECT', detail: 'Rejected: ' + reasonText.trim() },
              { message: 'Rejected — workflow ended', kind: 'warning' },
            );
          },
        },
      ],
    });
  };

  // Hands this stage to someone else. The workflow does not advance.
  const actDelegate = () => {
    if (!currentTask) return;
    let delegateId = '';
    let note = '';
    openModal({
      title: 'Delegate this stage',
      body: (
        <div>
          <div className="banner info">
            The stage stays where it is — a replacement task is raised for whoever you pick.
          </div>
          <div className="field">
            <label>
              Delegate to <span className="req">*</span>
            </label>
            <select className="input" onChange={(e) => (delegateId = e.target.value)}>
              <option value="">Select a person…</option>
              {users
                .filter((u) => u.status === 'active' && u.id !== me.id)
                .map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.name}
                  </option>
                ))}
            </select>
          </div>
          <div className="field">
            <label>Note</label>
            <input
              className="input"
              placeholder="Optional handover note"
              onChange={(e) => (note = e.target.value)}
            />
          </div>
        </div>
      ),
      actions: [
        { label: 'Cancel' },
        {
          label: 'Delegate',
          kind: 'btn-primary',
          onClick: () => {
            if (!delegateId) {
              addToast('Pick someone to delegate to', 'error');
              return false;
            }
            const name = users.find((u) => u.id === delegateId)?.name || 'another user';
            runAction(
              { action: 'delegate', delegateId, ...(note.trim() ? { note: note.trim() } : {}) },
              { action: 'DELEGATE', detail: `Delegated “${stageLabel}” to ${name}` },
              { message: `Delegated to ${name}`, kind: 'success' },
            );
          },
        },
      ],
    });
  };

  const actClose = () => {
    if (!currentTask) return;
    openConfirm({
      title: 'Close this workflow?',
      confirmLabel: 'Close workflow',
      danger: true,
      message: `The workflow ends at “${stageLabel}” — any remaining stages are skipped and the document is finalised. This cannot be undone.`,
      onConfirm: () =>
        runAction(
          { action: 'close', note: 'Closed by ' + me.name },
          { action: 'CLOSE', detail: `Closed workflow at stage “${stageLabel}”` },
          { message: 'Workflow closed', kind: 'success' },
        ),
    });
  };

  const routeThisDocument = () => routeDocuments([{ id: doc.id, title: doc.title }]);

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

  // Rendered in this order so the destructive/secondary choices sit left of the
  // primary one, and filtered by the stage's allowed actions.
  const stageActionButtons: {
    action: WorkflowStageAction;
    label: string;
    kind: string;
    icon?: string;
    run: () => void;
  }[] = [
    { action: 'review', label: 'Mark reviewed', kind: 'btn-secondary', run: actReview },
    {
      action: 'request_changes',
      label: 'Request changes',
      kind: 'btn-secondary',
      run: actRequestChanges,
    },
    { action: 'delegate', label: 'Delegate', kind: 'btn-secondary', run: actDelegate },
    { action: 'close', label: 'Close workflow', kind: 'btn-secondary', run: actClose },
    { action: 'reject', label: 'Reject', kind: 'btn-danger', run: actReject },
    { action: 'approve', label: 'Approve', kind: 'btn-success', icon: 'approve', run: actApprove },
  ];

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
              <button className="btn btn-secondary" onClick={actCheckin} disabled={checkoutBusy}>
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
            {hasNoWorkflow && !closed && (
              <button className="btn btn-primary" onClick={routeThisDocument}>
                <Icon name="flow" size={14} /> Route to workflow
              </button>
            )}
            {stageActionButtons
              .filter((b) => allowedActions.includes(b.action))
              .map((b) => (
                <React.Fragment key={b.action}>
                  {actionBtn(b.label, b.kind, b.run, b.icon ? { icon: b.icon } : {})}
                </React.Fragment>
              ))}
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

      <div className="grid grid-cols-1 lg:grid-cols-[2fr_1fr] gap-4">
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
            onRoute={hasNoWorkflow && !closed ? routeThisDocument : undefined}
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

/** Mirrors the real crumbs + header + `grid-cols-[2fr_1fr]` viewer/detail
 *  shell, so the layout doesn't reflow once the document actually loads in. */
function DocumentDetailSkeleton() {
  return (
    <div>
      <div className="crumbs">
        <Skeleton height={11} width={160} />
      </div>

      <div className="page-head">
        <div style={{ minWidth: 0, flex: 1 }}>
          <Skeleton height={19} width="40%" style={{ marginBottom: '10px' }} />
          <div className="flex g8 mt8 wrap">
            <Skeleton height={20} width={70} radius={99} />
            <Skeleton height={20} width={90} radius={99} />
            <Skeleton height={20} width={80} radius={99} />
          </div>
        </div>
        <div className="actions">
          <Skeleton height={34} width={90} radius={10} />
          <Skeleton height={34} width={110} radius={10} />
          <Skeleton height={34} width={100} radius={10} />
        </div>
      </div>

      <div className="grid grid-cols-[2fr_1fr] gap-4">
        <Skeleton height={620} radius={16} style={{ width: '100%' }} />

        <div className="flex flex-col gap-4">
          <div className="card">
            <div className="card-head">
              <Skeleton height={16} width="45%" />
            </div>
            <div className="card-body">
              <SkeletonText lines={5} />
            </div>
          </div>

          <div className="card">
            <div className="card-head">
              <Skeleton height={16} width="55%" />
            </div>
            <div className="card-body">
              {Array.from({ length: 3 }).map((_, i) => (
                <div key={i} className="wf-stage" style={{ cursor: 'default' }} aria-hidden="true">
                  <Skeleton width={24} height={24} circle />
                  <div className="wf-info" style={{ flex: 1 }}>
                    <Skeleton height={12} width="60%" style={{ marginBottom: '5px' }} />
                    <Skeleton height={10} width="35%" />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
