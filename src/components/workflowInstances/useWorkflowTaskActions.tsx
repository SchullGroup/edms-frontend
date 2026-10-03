'use client';

import React from 'react';
import { useUIStore } from '@/store/useUIStore';
import { useTaskAction } from '@/apis/hooks/useTasks';
import { useAttachWorkflowDocument } from '@/apis/hooks/useWorkflowInstances';
import {
  WorkflowDocumentPicker,
  type PickedDocument,
  type UploadDefaults,
} from './WorkflowDocumentPicker';
import { useCreateAuditLog } from '@/apis/hooks/useAudit';
import { useSignAndApprove } from '@/hooks/useSignAndApprove';
import type { TaskActionRequest, User } from '@/types/models';

export interface WorkflowTaskActionsArgs {
  /** The task being actioned — must be the caller's active, current-stage task. */
  taskId: string | undefined;
  stageLabel: string;
  /** The task's documents, for choosing which ones a "Request changes" covers. */
  documents: { id: string; title: string }[];
  /** Pre-ticked in the "Request changes" picker — the one being viewed. */
  selectedDocumentId?: string;
  /** Audit-log target — the workflow's primary document. */
  auditTargetId: string;
  /** The workflow instance — documents picked on "Mark reviewed" attach to it. */
  instanceId: string;
  /** Holds `workflow_instance:create`, which `POST /workflow-instances/:id/documents` requires. */
  canAttachDocuments: boolean;
  /** Starting cabinet/confidentiality/urgency for a file uploaded in the picker. */
  uploadDefaults?: UploadDefaults;
  users: User[];
  me: { id: string; name: string };
}

/**
 * Every stage action the API accepts, each behind the modal/confirm it needs.
 * `request_changes` (send back a stage) and `reject` (end the workflow) are
 * deliberately separate. Each returns the mutation's promise so the modal stays
 * open with a loading state until the action actually lands.
 */
export function useWorkflowTaskActions({
  taskId,
  stageLabel,
  documents,
  selectedDocumentId,
  auditTargetId,
  instanceId,
  canAttachDocuments,
  uploadDefaults,
  users,
  me,
}: WorkflowTaskActionsArgs) {
  const { openModal, openConfirm, addToast } = useUIStore();
  const taskAction = useTaskAction();
  const attachDocument = useAttachWorkflowDocument();
  const createAuditLog = useCreateAuditLog();
  const { promptSignAndApprove } = useSignAndApprove();

  const runAction = (
    actionReq: TaskActionRequest,
    audit: { action: string; detail: string },
    toast: { message: string; kind: 'success' | 'warning' | 'error' },
  ) => {
    if (!taskId) return;
    return taskAction
      .mutateAsync({ id: taskId, actionReq })
      .then(() => {
        createAuditLog.mutate({ action: audit.action, target: auditTargetId, detail: audit.detail });
        addToast(toast.message, toast.kind);
      })
      .catch((err: any) => {
        addToast(err?.response?.data?.message || 'Action failed', 'error');
        return false;
      });
  };

  // A review must come with at least one document — the reviewer's output
  // (report, minutes, marked-up copy…). The backend's `review` action takes no
  // documents, so they're attached to the workflow first
  // (`POST /workflow-instances/:id/documents`, allowed for the active task's
  // holder), then the review is sent.
  //
  // Two steps in the one modal: 1) pick documents, 2) optional comment and
  // confirm. "Next"/"Back" swap the modal's content and return `false` so the
  // modal stays open; the selection and comment carry across both ways.
  const actReview = () => {
    if (!taskId) return;
    let picked: PickedDocument[] = [];
    let commentText = '';
    // Survives a retry after a partial failure, so nothing is attached twice.
    const attached = new Set<string>();
    const title = `Mark reviewed — ${stageLabel}`;

    const submit = async () => {
      for (const doc of picked) {
        if (attached.has(doc.id)) continue;
        try {
          await attachDocument.mutateAsync({ instanceId, documentId: doc.id });
          attached.add(doc.id);
        } catch (err: any) {
          addToast(
            err?.response?.data?.message || `Could not attach “${doc.title}”`,
            'error',
          );
          return false;
        }
      }
      return runAction(
        { action: 'review', ...(commentText.trim() ? { comment: commentText.trim() } : {}) },
        {
          action: 'REVIEW',
          detail: `Reviewed stage “${stageLabel}”, attaching ${picked.map((d) => d.title).join(', ')}`,
        },
        { message: 'Reviewed — advanced to next stage', kind: 'success' },
      );
    };

    const openStepOne = () =>
      openModal({
        title,
        body: canAttachDocuments ? (
          <div>
            <div className="caption mb-2">Step 1 of 2 — choose documents</div>
            <div className="banner info mb-4">
              Attach the document(s) from your review. They join this workflow and travel with it
              to the next stage.
            </div>
            <WorkflowDocumentPicker
              excludeIds={documents.map((d) => d.id)}
              initialSelected={picked}
              uploadDefaults={uploadDefaults}
              onChange={(docs) => (picked = docs)}
            />
          </div>
        ) : (
          <div className="banner error">
            Reviewing this stage requires attaching a document, and your role can&apos;t add
            documents to a workflow (it needs <code>workflow_instance:create</code>). Ask an
            administrator to grant it, or delegate this stage.
          </div>
        ),
        actions: [
          { label: 'Cancel' },
          {
            label: 'Next',
            kind: 'btn-primary',
            disabled: !canAttachDocuments,
            onClick: () => {
              if (picked.length === 0) {
                addToast('Choose at least one document to attach', 'error');
                return false;
              }
              openStepTwo();
              return false;
            },
          },
        ],
      });

    const openStepTwo = () =>
      openModal({
        title,
        body: (
          <div>
            <div className="caption mb-2">Step 2 of 2 — add a comment</div>
            <div className="field">
              <label>Attaching</label>
              <ul style={{ margin: 0, paddingLeft: 18, fontSize: '12.5px' }}>
                {picked.map((d) => (
                  <li key={d.id}>{d.title}</li>
                ))}
              </ul>
            </div>
            <div className="field">
              <label>Comment (optional)</label>
              <textarea
                className="input"
                placeholder="Added to the workflow activity trail…"
                maxLength={2000}
                defaultValue={commentText}
                onChange={(e) => (commentText = e.target.value)}
              />
            </div>
            <div className="caption">
              “{stageLabel}” is then marked reviewed and moves to the next stage.
            </div>
          </div>
        ),
        actions: [
          {
            label: 'Back',
            onClick: () => {
              openStepOne();
              return false;
            },
          },
          { label: 'Attach & mark reviewed', kind: 'btn-primary', onClick: submit },
        ],
      });

    openStepOne();
  };

  // Approving requires a signature image (backend 422s without one).
  const actApprove = () => {
    if (!taskId) return;
    promptSignAndApprove({
      taskId,
      title: stageLabel,
      onSuccess: () =>
        createAuditLog.mutate({
          action: 'APPROVE',
          target: auditTargetId,
          detail: `Signed & approved stage “${stageLabel}”`,
        }),
    });
  };

  // Sends the work back one stage. The backend requires at least one of the
  // task's documents to be named — each becomes a revision request the
  // previous stage answers by uploading a new version of that document.
  const actRequestChanges = () => {
    if (!taskId) return;
    let reasonText = '';
    const chosen = new Set<string>(
      documents.length === 1
        ? [documents[0].id]
        : selectedDocumentId && documents.some((d) => d.id === selectedDocumentId)
          ? [selectedDocumentId]
          : [],
    );
    openModal({
      title: 'Request changes — return to previous stage',
      body: (
        <div>
          <div className="banner warning">
            The workflow goes back to the previous stage with your reason. The SLA timer restarts
            for that stage and the workflow stays open.
          </div>
          <div className="field">
            <label>
              Documents that need changes <span className="req">*</span>
            </label>
            <div className="flex flex-col gap-2">
              {documents.map((d) => (
                <label key={d.id} className="flex items-center gap-2" style={{ fontWeight: 500 }}>
                  <input
                    type="checkbox"
                    defaultChecked={chosen.has(d.id)}
                    onChange={(e) => (e.target.checked ? chosen.add(d.id) : chosen.delete(d.id))}
                  />
                  {d.title}
                </label>
              ))}
            </div>
          </div>
          <div className="field">
            <label>
              Reason <span className="req">*</span>
            </label>
            <textarea
              className="input"
              placeholder="Reason (required, shared with the previous stage owner)…"
              maxLength={2000}
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
            if (chosen.size === 0) {
              addToast('Pick at least one document that needs changes', 'error');
              return false;
            }
            if (!reasonText.trim()) {
              addToast('A reason is required', 'error');
              return false;
            }
            const titles = documents.filter((d) => chosen.has(d.id)).map((d) => d.title);
            return runAction(
              {
                action: 'request_changes',
                comment: reasonText.trim(),
                documents: [...chosen].map((documentId) => ({ documentId })),
              },
              {
                action: 'REQUEST_CHANGES',
                detail: `Changes requested on ${titles.join(', ')}: ${reasonText.trim()}`,
              },
              { message: 'Returned to previous stage with reason', kind: 'warning' },
            );
          },
        },
      ],
    });
  };

  // The terminating action — the workflow ends here.
  const actReject = () => {
    if (!taskId) return;
    let reasonText = '';
    openModal({
      title: 'Reject and end this workflow',
      body: (
        <div>
          <div className="banner error">
            Rejecting <b>ends the workflow outright</b> — the remaining stages are never raised. To
            send it back for edits instead, use “Request changes”.
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
            return runAction(
              { action: 'reject', comment: reasonText.trim() },
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
    if (!taskId) return;
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
            return runAction(
              { action: 'delegate', delegateId, ...(note.trim() ? { comment: note.trim() } : {}) },
              { action: 'DELEGATE', detail: `Delegated “${stageLabel}” to ${name}` },
              { message: `Delegated to ${name}`, kind: 'success' },
            );
          },
        },
      ],
    });
  };

  const actClose = () => {
    if (!taskId) return;
    openConfirm({
      title: 'Close this workflow?',
      confirmLabel: 'Close workflow',
      danger: true,
      message: `The workflow ends at “${stageLabel}” — any remaining stages are skipped. This cannot be undone.`,
      onConfirm: () =>
        runAction(
          { action: 'close', comment: 'Closed by ' + me.name },
          { action: 'CLOSE', detail: `Closed workflow at stage “${stageLabel}”` },
          { message: 'Workflow closed', kind: 'success' },
        ),
    });
  };

  return { actReview, actApprove, actRequestChanges, actReject, actDelegate, actClose };
}
