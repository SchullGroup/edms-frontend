'use client';

import { useUIStore } from '@/store/useUIStore';
import { useTaskAction } from '@/apis/hooks/useTasks';
import { useMultipartUploader } from '@/apis/hooks/useMultipartUploader';
import { SignaturePad } from '@/components/documents/SignaturePad';
import type { TaskActionSignature } from '@/types/models';

type Mime = TaskActionSignature['mimeType'];

interface PromptArgs {
  taskId: string;
  /** Document / task title for the modal heading. */
  title?: string;
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
  const { startUpload } = useMultipartUploader();

  const promptSignAndApprove = ({ taskId, title, onSuccess }: PromptArgs) => {
    const sig: { current: { blob: Blob; mimeType: Mime } | null } = { current: null };
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
            if (!sig.current) {
              addToast('Add a signature to approve', 'error');
              return false;
            }
            submitting = true;
            try {
              const { blob, mimeType } = sig.current;
              const ext = mimeType === 'image/jpeg' ? 'jpg' : mimeType === 'image/webp' ? 'webp' : 'png';
              const file = new File([blob], `signature-${taskId}-${Date.now()}.${ext}`, {
                type: mimeType,
              });
              const fileUrl = await startUpload({
                file,
                fileName: file.name,
                folderName: 'edms-signatures',
              });
              await taskAction.mutateAsync({
                id: taskId,
                actionReq: {
                  action: 'approve',
                  signature: { fileUrl, mimeType },
                  ...(comment.current.trim() ? { comment: comment.current.trim() } : {}),
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
