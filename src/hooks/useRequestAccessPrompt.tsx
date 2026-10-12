'use client';

import { useRequestDocumentAccess } from '@/apis/hooks/useDocuments';
import { useUIStore } from '@/store/useUIStore';
import type { DocumentAccessKind } from '@/types/models';

export interface RequestAccessOptions {
  /** The kinds of access this prompt may ask for. Defaults to View access. */
  kinds?: DocumentAccessKind[];
}

/**
 * The "Request access" modal for a document the caller can't open (its
 * confidentiality is above their clearance, or it's outside their reach).
 * Shared by the document page and the workflow page.
 *
 * One access request is sent per kind (the API takes one `permission` per
 * request), each with its own toast. An administrator decides; the backend
 * notifies the requester and records the request in the audit trail.
 */
export function useRequestAccessPrompt() {
  const { openModal } = useUIStore();
  const requestAccess = useRequestDocumentAccess();

  const promptRequestAccess = (
    documentId: string,
    documentTitle?: string,
    { kinds = ['view'] }: RequestAccessOptions = {},
  ) => {
    let reason = '';
    openModal({
      title: documentTitle ? `Request access — ${documentTitle}` : 'Request access',
      body: (
        <div>
          <p className="caption mb-4">
            Your request will be reviewed and you will be notified of the decision.
          </p>
          <div className="field">
            <label>Reason (optional)</label>
            <textarea
              className="input"
              placeholder="Why do you need access to this document?"
              onChange={(e) => (reason = e.target.value)}
            />
          </div>
        </div>
      ),
      actions: [
        { label: 'Cancel' },
        {
          label: 'Send request',
          kind: 'btn-primary',
          onClick: async () => {
            const results = await Promise.allSettled(
              kinds.map((permission) =>
                requestAccess.mutateAsync({
                  id: documentId,
                  permission,
                  reason: reason.trim() || undefined,
                }),
              ),
            );
            // Keep the dialog open only when nothing went through. An "already
            // pending" (409) counts as through: there's nothing to retry.
            const allFailed = results.every(
              (r) => r.status === 'rejected' && (r.reason as any)?.response?.status !== 409,
            );
            return allFailed ? false : undefined;
          },
        },
      ],
    });
  };

  return { promptRequestAccess, isRequesting: requestAccess.isPending };
}
