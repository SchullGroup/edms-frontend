'use client';

import React from 'react';
import { useDocumentSignatures, useAddDocumentSignature } from '@/apis/hooks/useDocuments';
import { useMultipartUploader } from '@/apis/hooks/useMultipartUploader';
import { useUIStore } from '@/store/useUIStore';
import { SignaturePad } from '@/components/documents/SignaturePad';
import { fmtDateTime } from '@/utils/helpers';

interface Props {
  documentId: string;
  /** Controls whether the panel renders at all — should reflect
   *  `document_signature:view`, not `document:view`. */
  canView: boolean;
  /** Controls whether "Sign document" is offered — should reflect
   *  `document_signature:create` (the caller also folds in `!closed`). */
  canSign: boolean;
}

type Mime = 'image/png' | 'image/jpeg' | 'image/webp';

/**
 * The dedicated `GET/POST /documents/:id/signatures` list — a flat "who
 * signed this document" record with no positional/field placement, separate
 * from the in-viewer signature fields captured on an `approve` task action
 * (see `useSignAndApprove`). Use this for a sign-off that isn't tied to any
 * pending workflow task.
 */
export function DocumentSignaturesPanel({ documentId, canView, canSign }: Props) {
  const { data: signatures, isLoading } = useDocumentSignatures(canView ? documentId : undefined);
  const addSignature = useAddDocumentSignature();
  const { startUpload } = useMultipartUploader();
  const { openModal, closeModal, addToast } = useUIStore();

  if (!canView) return null;

  const sorted = [...(signatures || [])].sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
  );

  const promptSign = () => {
    const sig: { current: { blob: Blob; mimeType: Mime } | null } = { current: null };
    let submitting = false;

    openModal({
      title: 'Sign this document',
      size: 'lg',
      body: (
        <div>
          <div className="banner info mb-4">
            This records a signature against the document itself, independent of any
            workflow task.
          </div>
          <div className="field">
            <label>Signature</label>
            <SignaturePad onChange={(r) => (sig.current = r)} />
          </div>
        </div>
      ),
      actions: [
        { label: 'Cancel' },
        {
          label: 'Sign',
          kind: 'btn-success',
          onClick: async () => {
            if (submitting) return false;
            if (!sig.current) {
              addToast('Draw or upload a signature first', 'error');
              return false;
            }
            submitting = true;
            try {
              const { blob, mimeType } = sig.current;
              const ext =
                mimeType === 'image/jpeg' ? 'jpg' : mimeType === 'image/webp' ? 'webp' : 'png';
              const file = new File([blob], `signature-${documentId}-${Date.now()}.${ext}`, {
                type: mimeType,
              });
              const fileUrl = await startUpload({
                file,
                fileName: file.name,
                folderName: 'edms-signatures',
              });
              await addSignature.mutateAsync({ id: documentId, url: fileUrl });
              closeModal();
            } catch (err: any) {
              submitting = false;
              addToast(err?.response?.data?.message || err?.message || 'Signing failed', 'error');
              return false;
            }
          },
        },
      ],
    });
  };

  return (
    <div className="card">
      <div className="card-head flex justify-between items-center">
        <span className="h3">Signatures</span>
        {canSign && (
          <button className="btn btn-secondary btn-sm" onClick={promptSign}>
            Sign document
          </button>
        )}
      </div>
      <div className="card-body" style={{ paddingTop: '6px' }}>
        {isLoading && <div className="caption">Loading signatures…</div>}
        {!isLoading && sorted.length === 0 && <div className="caption">Not signed yet.</div>}
        {sorted.map((s) => (
          <div key={s.id} className="meta-row" style={{ alignItems: 'center' }}>
            <span className="k">{s.signer.name}</span>
            <span className="v flex items-center gap-2" style={{ justifyContent: 'flex-end' }}>
              <span className="caption">{fmtDateTime(s.createdAt)}</span>
              <a href={s.url} target="_blank" rel="noreferrer">
                <img
                  src={s.url}
                  alt={`${s.signer.name}'s signature`}
                  style={{ height: '24px', maxWidth: '80px', objectFit: 'contain' }}
                />
              </a>
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
