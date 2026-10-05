'use client';

import { useRequestDocumentAccess } from '@/apis/hooks/useDocuments';
import { useCreateAuditLog } from '@/apis/hooks/useAudit';
import { useUIStore } from '@/store/useUIStore';

/**
 * The "Request access" modal for a document the caller can't open (its
 * confidentiality is above their clearance — `GET /documents/:id` 403s).
 * Shared by the document page and the workflow page's document viewer.
 */
export function useRequestAccessPrompt() {
  const { openModal } = useUIStore();
  const requestAccess = useRequestDocumentAccess();
  const createAuditLog = useCreateAuditLog();

  const promptRequestAccess = (documentId: string, documentTitle?: string) => {
    let reason = '';
    openModal({
      title: documentTitle ? `Request access — ${documentTitle}` : 'Request access',
      body: (
        <div className="field">
          <label>Reason (optional)</label>
          <textarea
            className="input"
            placeholder="Why do you need access to this document?"
            onChange={(e) => (reason = e.target.value)}
          />
        </div>
      ),
      actions: [
        { label: 'Cancel' },
        {
          label: 'Send request',
          kind: 'btn-primary',
          onClick: () =>
            requestAccess
              .mutateAsync({ id: documentId, reason: reason.trim() || undefined })
              .then(() => {
                createAuditLog.mutate({
                  action: 'ACCESS_REQUEST',
                  target: documentId,
                  detail: 'Requested access',
                });
              })
              .catch(() => false),
        },
      ],
    });
  };

  return { promptRequestAccess, isRequesting: requestAccess.isPending };
}
