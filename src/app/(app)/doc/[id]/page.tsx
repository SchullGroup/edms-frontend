'use client';

import React, { useEffect, useState, use } from 'react';
import { useRouter } from 'next/navigation';
import { useStore, cabById, userById } from '@/store/useStore';
import { useUIStore } from '@/store/useUIStore';
import {
  useDocument,
  useCheckoutDocument,
  useCheckinDocument,
  useArchiveDocument,
} from '@/apis/hooks/useDocuments';
import { usePermissions } from '@/hooks/usePermissions';
import { cabinetAllows, useMyCabinetAccess } from '@/components/cabinets/cabinetAccess';
import { useRequestAccessPrompt } from '@/hooks/useRequestAccessPrompt';
import { useConfidentialityPolicy } from '@/hooks/useConfidentialityPolicy';
import { useCabinets } from '@/apis/hooks/useCabinets';
import { useCabinetFolders } from '@/apis/hooks/useFolders';
import { useUsers } from '@/apis/hooks/useUsers';
import { useCreateAuditLog } from '@/apis/hooks/useAudit';
import { useWorkflowInstances } from '@/apis/hooks/useWorkflowInstances';
import { useRouteToWorkflow } from '@/hooks/useRouteToWorkflow';
import { Icon } from '@/components/ui/Icons';
import { StatusBadge, UrgBadge, ConfBadge } from '@/components/ui/Badges';
import { fmtDateTime, fmtDate } from '@/utils/helpers';
import { documentFile } from '@/utils/documentFile';
import { DocumentViewerPanel } from '@/components/documents/DocumentViewerPanel';
import { DocumentDetailsPanel } from '@/components/documents/DocumentDetailsPanel';
import { DocumentVersionsPanel } from '@/components/documents/DocumentVersionsPanel';
import type { DocumentWithUiExtras, DocumentSignatureFieldUI } from '@/components/documents/types';
import type { WorkflowInstanceStatus } from '@/types/models';
import { Skeleton, SkeletonText } from '@/components/common/Skeleton';
import { DateTimeField, todayStr } from '@/components/ui/DatePicker';
import { folderPathLabel } from '@/utils/folders';

const WORKFLOW_STATUS_LABEL: Record<WorkflowInstanceStatus, string> = {
  pending: 'Pending',
  in_progress: 'In Progress',
  on_hold: 'On Hold',
  closed: 'Closed',
};

/**
 * The document page — view-only. File, details, versions, custody
 * (check-out/check-in) and archive. Nothing here moves a workflow: reviewing,
 * approving, sending back and uploading revisions all happen on the workflow
 * page (`/workflow-instances/[id]`), linked from the "Workflows" card.
 */
export default function DocumentDetail({ params }: { params: Promise<{ id: string }> }) {
  const router = useRouter();
  const docId = use(params).id;

  const { currentUser: me } = useStore();
  const { setPageTitle, openModal, closeModal, openConfirm, addToast } = useUIStore();

  const { data: cabinetsData, isLoading: isLoadingCabs } = useCabinets();
  const { data: usersData, isLoading: isLoadingUsers } = useUsers();
  const { policyFor, isLoading: isLoadingPolicies } = useConfidentialityPolicy();
  const cabinets = cabinetsData?.data || [];
  const users = usersData?.data || [];

  const { can, scopeFor } = usePermissions();
  const archiveDocument = useArchiveDocument();
  const createAuditLog = useCreateAuditLog();
  const checkoutDocument = useCheckoutDocument();
  const checkinDocument = useCheckinDocument();
  const { routeDocuments, canRoute: hasRoutePermission } = useRouteToWorkflow();
  const { promptRequestAccess, isRequesting } = useRequestAccessPrompt();

  const [zoom, setZoom] = useState(1);

  const { data: rawDoc, isLoading, error: docError } = useDocument(docId);
  // Saving metadata (`PUT /documents/:id/metadata`) needs the metadata permission
  // AND `edit` on the document's cabinet — the same two checks the API makes.
  const myCabinetLevel = useMyCabinetAccess(rawDoc?.cabinetId);
  // A document outside the caller's confidentiality clearance 403s (code
  // `FORBIDDEN`) rather than 404ing — its own state below, not "not found".
  const accessDenied = (docError as any)?.response?.status === 403;

  // `comments`/`signatures`/`sealed`/`legalHold` are not `Document` fields on
  // the real API, and stay empty/false shims for the viewer's overlay props.
  const doc: DocumentWithUiExtras | null = rawDoc
    ? {
        ...rawDoc,
        signatures: (rawDoc as { signatures?: DocumentSignatureFieldUI[] }).signatures || [],
        comments: (rawDoc as { comments?: DocumentWithUiExtras['comments'] }).comments || [],
        sealed: (rawDoc as { sealed?: boolean }).sealed || false,
        legalHold: (rawDoc as { legalHold?: boolean }).legalHold || false,
      }
    : null;

  // Every workflow this document has been routed into, newest first. A
  // document can be routed more than once, so this is a list.
  const { data: instancesData, isLoading: isLoadingInstances } = useWorkflowInstances(
    { documentId: doc?.id },
    { enabled: !!doc?.id },
  );
  const workflows = [...(instancesData?.data || [])].sort(
    (a, b) => new Date(b.startedAt).getTime() - new Date(a.startedAt).getTime(),
  );
  const activeWorkflow = workflows.find((w) => w.status !== 'closed');
  // Only offer routing once we know nothing is running — otherwise the CTA
  // flashes on every load before the instance list resolves.
  const canRoute = !isLoadingInstances && !activeWorkflow;

  const { data: activeCabFoldersData } = useCabinetFolders(doc?.cabinetId);
  const folderLabel = doc?.folderId
    ? folderPathLabel(activeCabFoldersData?.data || [], doc.folderId)
    : '';

  useEffect(() => {
    if (doc?.title) setPageTitle(doc.title);
  }, [doc?.title, setPageTitle]);

  if (isLoading || isLoadingCabs || isLoadingUsers || isLoadingPolicies) {
    return <DocumentDetailSkeleton />;
  }

  if (accessDenied || (doc && !me)) {
    return (
      <div className="card" style={{ marginTop: '30px' }}>
        <div className="empty">
          <Icon name="lock" size={32} />
          <div className="h3 mt-4 mb-2">You don&apos;t have access to this document</div>
          <p className="caption mb-4" style={{ maxWidth: '400px', margin: '0 auto 16px' }}>
            Its confidentiality level is above what your role is cleared for. Request access below,
            or ask the document owner directly.
          </p>
          <button
            className="btn btn-primary"
            disabled={isRequesting}
            onClick={() => promptRequestAccess(docId, doc?.title)}
          >
            Request access
          </button>
        </div>
      </div>
    );
  }

  if (!doc || !me) {
    return (
      <div className="card">
        <div className="empty">
          <Icon name="doc" size={32} />
          <div className="h3 mt-4 mb-2">Document not found</div>
          <p className="caption mb-4">It may have been moved or deleted.</p>
          <button className="btn btn-primary btn-sm" onClick={() => router.push('/staff/cabinets')}>
            Browse cabinets
          </button>
        </div>
      </div>
    );
  }

  const { rawFileKey, fileUrl, fileMimeType } = documentFile(doc);
  const confPolicy = policyFor(doc.confidentiality);

  const lockedByOther = doc.isCheckedOut && doc.checkoutLock?.lockedBy !== me.id;
  const lockedByMe = doc.isCheckedOut && doc.checkoutLock?.lockedBy === me.id;
  const checkoutBusy = checkoutDocument.isPending || checkinDocument.isPending;
  const lockDueAt = doc.checkoutLock?.expectedReturnAt;
  const lockOverdue = !!lockDueAt && new Date(lockDueAt).getTime() <= Date.now();
  // Mirrors the backend's `canReleaseLock`: `document_lock:delete` at global
  // scope releases any lock, at department scope only locks on a document whose
  // cabinet belongs to the releaser's department. Offered only once the lock is
  // overdue — before that, the holder is still within the time they asked for.
  const lockReleaseScope = scopeFor('document_lock', 'delete');
  const myDepartmentId = userById(users, me.id)?.departmentId ?? null;
  const cabinetDepartmentId = cabById(cabinets, doc.cabinetId)?.departmentId ?? null;
  const canForceCheckin =
    lockedByOther &&
    lockOverdue &&
    (lockReleaseScope === 'global' ||
      (lockReleaseScope === 'department' &&
        !!myDepartmentId &&
        myDepartmentId === cabinetDepartmentId));
  const eff =
    doc.status === 'closed' ? 'Closed' : doc.status === 'in_progress' ? 'In Progress' : 'Pending';
  const closed = doc.status === 'closed';
  const lockHolderName =
    doc.checkoutLock?.locker?.name ||
    userById(users, doc.checkoutLock?.lockedBy)?.name ||
    'another user';

  const routeThisDocument = () => routeDocuments([{ id: doc.id, title: doc.title }]);

  const actDownload = () => {
    if (!confPolicy.download) {
      addToast(`Download is disabled for ${doc.confidentiality} documents`, 'error');
      return;
    }
    const a = document.createElement('a');
    if (fileUrl) {
      // Real pre-signed URL — the `download` hint is honoured same-origin and
      // ignored cross-origin (S3), where the tab opens the file instead.
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
            <DateTimeField
              aria-label="Expected return"
              min={todayStr()}
              onChange={(v) => (returnAt = v)}
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
            createAuditLog.mutate({ action: 'CHECKIN', target: doc.id, detail: 'Checked in' });
          })
          .catch(() => {
            /* hook surfaces the error toast */
          }),
    });
  };

  const actForceCheckin = () => {
    openConfirm({
      title: 'Force check in?',
      confirmLabel: 'Force check in',
      danger: true,
      message: `${lockHolderName} was due to return this on ${lockDueAt ? fmtDateTime(lockDueAt) : 'an earlier date'}. Forcing a check-in releases their lock — any changes they haven't uploaded as a new version will not be in the file.`,
      onConfirm: () =>
        checkinDocument
          .mutateAsync(doc.id)
          .then(() => {
            createAuditLog.mutate({
              action: 'CHECKIN',
              target: doc.id,
              detail: `Force checked in (overdue lock held by ${lockHolderName})`,
            });
          })
          .catch(() => {
            /* hook surfaces the error toast */
          }),
    });
  };

  const actArchive = () =>
    openConfirm({
      title: `Archive "${doc.title}"?`,
      message:
        'The document is hidden from normal listings and search. It can be restored by an administrator.',
      confirmLabel: 'Archive',
      danger: true,
      onConfirm: () =>
        archiveDocument
          .mutateAsync(doc.id)
          .then(() => {
            createAuditLog.mutate({ action: 'ARCHIVE', target: doc.id, detail: doc.title });
            router.push('/staff/cabinets');
          })
          .catch(() => false),
    });

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
          <div className="flex gap-2 mt-2 flex-wrap">
            <StatusBadge status={eff} />
            <ConfBadge level={doc.confidentiality} />
            <UrgBadge level={doc.urgency} />
            <span className="caption" style={{ alignSelf: 'center' }}>
              v{doc.currentVersion?.versionNumber ?? 1} · {fmtDate(doc.createdAt)}
            </span>
          </div>
        </div>
      </div>

      {/* Toolbar */}
      <div className="flex items-center gap-2 flex-wrap mb-4">
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
            disabled={checkoutBusy || !can('document', 'edit')}
            title={
              !can('document', 'edit') ? "You don't have permission to edit documents" : undefined
            }
          >
            <Icon name="lock" size={14} /> Check in
          </button>
        ) : canForceCheckin ? (
          <button
            className="btn btn-danger"
            onClick={actForceCheckin}
            disabled={checkoutBusy}
            title="Release this overdue checkout"
          >
            <Icon name="lock" size={14} /> Force check in
          </button>
        ) : (
          <button
            className="btn btn-secondary"
            onClick={actCheckout}
            disabled={checkoutBusy || closed || lockedByOther || !can('document', 'edit')}
            title={
              closed
                ? 'Document is closed'
                : lockedByOther
                  ? 'Checked out by another user'
                  : !can('document', 'edit')
                    ? "You don't have permission to edit documents"
                    : 'Check out for editing'
            }
          >
            <Icon name="key" size={14} /> Check out
          </button>
        )}
        {activeWorkflow && (
          <button
            className="btn btn-primary"
            onClick={() => router.push(`/workflow-instances/${activeWorkflow.id}`)}
          >
            <Icon name="flow" size={14} /> Open workflow
          </button>
        )}
        {canRoute && hasRoutePermission && !closed && (
          <button className="btn btn-primary" onClick={routeThisDocument}>
            <Icon name="flow" size={14} /> Route to workflow
          </button>
        )}
        {can('document', 'delete') && (
          <button
            className="btn btn-secondary"
            disabled={doc.legalHold || archiveDocument.isPending}
            onClick={actArchive}
          >
            <Icon name="redact" size={14} /> Archive
          </button>
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
          Read-only: checked out by {lockHolderName} since {fmtDate(doc.checkoutLock?.lockedAt)}
          {lockOverdue && lockDueAt ? ` — overdue since ${fmtDateTime(lockDueAt)}` : ''}.
        </div>
      )}
      {lockedByMe && (
        <div className="banner info">
          <span>
            <Icon name="key" size={15} />
          </span>{' '}
          You have this checked out since {fmtDate(doc.checkoutLock?.lockedAt)}
          {lockDueAt ? ` — due back ${fmtDate(lockDueAt)}` : ''}. Check it in when you&apos;re
          done so others can edit.
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-[2fr_1fr] gap-4">
        <DocumentViewerPanel
          documentTitle={doc.title}
          confidentiality={doc.confidentiality}
          fileUrl={fileUrl}
          rawFileKey={rawFileKey}
          fileMimeType={fileMimeType}
          showWatermark={confPolicy.watermark}
          watermarkText={`${doc.confidentiality} · ${me.name}`}
          zoom={zoom}
          onZoomChange={setZoom}
          signatures={doc.signatures}
          sealed={doc.sealed}
          lockedByOther={lockedByOther}
          onSignatureFieldClick={() => {}}
          getSignerName={(userId) => userById(users, userId)?.name || 'User'}
          canDownload={confPolicy.download}
          onDownload={actDownload}
        />

        <div className="flex flex-col gap-4">
          <DocumentDetailsPanel
            documentId={doc.id}
            documentType={doc.documentType}
            cabinetId={doc.cabinetId}
            ownerName={userById(users, doc.createdBy)?.name || 'System'}
            createdAtLabel={fmtDateTime(doc.createdAt)}
            metadata={doc.metadata || []}
            canEditMetadata={
              can('document_metadata', 'edit') &&
              cabinetAllows(myCabinetLevel, 'edit') &&
              !closed &&
              !lockedByOther
            }
            confidentiality={doc.confidentiality}
            urgency={doc.urgency}
            canEditClassification={
              can('document', 'edit') &&
              cabinetAllows(myCabinetLevel, 'edit') &&
              !closed &&
              !lockedByOther
            }
          />

          {/* New versions are only uploaded on the workflow page, in answer to
              a "Request changes" — never here, so a file can't be swapped
              mid-review. Restoring an old version is likewise blocked while a
              workflow is running. */}
          <DocumentVersionsPanel
            documentId={doc.id}
            currentVersionId={doc.currentVersionId}
            canView={can('document_version', 'view')}
            canEdit={
              can('document_version', 'restore') && !closed && !lockedByOther && !activeWorkflow
            }
            canUploadVersion={false}
            getUploaderName={(userId) => userById(users, userId)?.name || 'User'}
          />

          <div className="card">
            <div className="card-head">
              <span className="h3">Workflows</span>
            </div>
            <div className="card-body">
              {isLoadingInstances ? (
                <SkeletonText lines={2} />
              ) : workflows.length === 0 ? (
                <div className="caption">
                  Not in any workflow — nobody has been asked to act on it.
                </div>
              ) : (
                <div className="flex flex-col gap-2">
                  {workflows.map((w) => (
                    <button
                      key={w.id}
                      className="menu-item"
                      style={{ justifyContent: 'space-between', width: '100%' }}
                      onClick={() => router.push(`/workflow-instances/${w.id}`)}
                    >
                      <span>
                        {w.workflowDefinition?.name || 'Workflow'}
                        <span className="caption"> · started {fmtDate(w.startedAt)}</span>
                      </span>
                      <StatusBadge status={WORKFLOW_STATUS_LABEL[w.status]} />
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
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
          <div className="flex gap-2 mt-2 flex-wrap">
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
              <SkeletonText lines={3} />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
