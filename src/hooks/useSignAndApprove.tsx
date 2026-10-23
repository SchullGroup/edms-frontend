'use client';

import { useUIStore } from '@/store/useUIStore';
import { useTaskAction } from '@/apis/hooks/useTasks';
import { useMultipartUploader } from '@/apis/hooks/useMultipartUploader';
import { SignaturePad } from '@/components/documents/SignaturePad';
import {
  DocumentScopeField,
  scopedDocuments,
  type ScopeDocument,
} from '@/components/workflowInstances/DocumentScopeField';
import type { TaskActionSignature } from '@/types/models';

type Mime = TaskActionSignature['mimeType'];

/** What `SignaturePad` hands back: the drawn, typed or uploaded image. */
export interface SignatureImage {
  blob: Blob;
  mimeType: Mime;
}

/** Uploads a signature image and returns the `signature` that `approve` and `review` take. */
export function useSignatureUpload() {
  const { startUpload } = useMultipartUploader();
  return async (taskId: string, { blob, mimeType }: SignatureImage): Promise<TaskActionSignature> => {
    const ext = mimeType === 'image/jpeg' ? 'jpg' : mimeType === 'image/webp' ? 'webp' : 'png';
    const file = new File([blob], `signature-${taskId}-${Date.now()}.${ext}`, { type: mimeType });
    const fileUrl = await startUpload({
      file,
      fileName: file.name,
      folderName: 'edms-signatures',
    });
    return { fileUrl, mimeType };
  };
}

interface PromptArgs {
  taskId: string;
  /** Document / task title for the modal heading. */
  title?: string;
  /** The task's documents the approver has Action access to — with more than
   *  one, they pick which to approve. */
  documents?: ScopeDocument[];
  /** How many of the task's documents they can't act on (never offered). */
  heldBack?: number;
  onSuccess?: () => void;
}

/**
 * The `approve` task action requires a signature image (the backend 422s
 * without one). This opens a modal with a signature pad, uploads the drawn /
 * chosen image, and calls `POST /tasks/{taskId}/action` with
 * `{ action: 'approve', signature: { fileUrl, mimeType }, comment? }`.
 */
export function useSignAndApprove() {
  const { openModal, closeModal, addToast } = useUIStore();
  const taskAction = useTaskAction();
  const uploadSignature = useSignatureUpload();

  const promptSignAndApprove = ({
    taskId,
    title,
    documents = [],
    heldBack = 0,
    onSuccess,
  }: PromptArgs) => {
    const sig: { current: SignatureImage | null } = { current: null };
    const chosen = new Set(documents.map((d) => d.id));
    const comment: { current: string } = { current: '' };
    let submitting = false;

    openModal({
      title: title ? `Sign & approve — ${title}` : 'Sign & approve',
      size: 'lg',
      body: (
        <div>
          <div className="banner info mb-4">
            Your signature is stored with the approval and recorded on the workflow trail.
            Approving advances the file to the next stage.
          </div>
          <DocumentScopeField
            documents={documents}
            chosen={chosen}
            heldBack={heldBack}
            label="Approve which documents?"
          />
          <div className="field mb-4">
            <label>Signature</label>
            <SignaturePad onChange={(r) => (sig.current = r)} />
          </div>
          <div className="field">
            <label>Comment (optional)</label>
            <textarea
              className="input"
              placeholder="Added to the workflow activity trail…"
              maxLength={2000}
              onChange={(e) => (comment.current = e.target.value)}
            />
          </div>
        </div>
      ),
      actions: [
        { label: 'Cancel' },
        {
          label: 'Sign & approve',
          kind: 'btn-success',
          onClick: async () => {
            if (submitting) return false;
            if (documents.length > 1 && chosen.size === 0) {
              addToast('Pick at least one document to approve', 'error');
              return false;
            }
            if (!sig.current) {
              addToast('Add a signature to approve', 'error');
              return false;
            }
            const scope = scopedDocuments(documents, chosen, heldBack);
            submitting = true;
            try {
              const signature = await uploadSignature(taskId, sig.current);
              await taskAction.mutateAsync({
                id: taskId,
                actionReq: {
                  action: 'approve',
                  signature,
                  ...(comment.current.trim() ? { comment: comment.current.trim() } : {}),
                  ...(scope ? { documents: scope } : {}),
                },
              });
              addToast('Approved — advanced to next stage', 'success');
              onSuccess?.();
              closeModal();
            } catch (err: any) {
              submitting = false;
              addToast(
                err?.response?.data?.message || err?.message || 'Approval failed',
                'error',
              );
              return false;
            }
          },
        },
      ],
    });
  };

  return { promptSignAndApprove, isApproving: taskAction.isPending };
}
