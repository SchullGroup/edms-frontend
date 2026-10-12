'use client';

import { useState } from 'react';
import { useRequestDocumentAccess } from '@/apis/hooks/useDocuments';
import { useUIStore } from '@/store/useUIStore';
import { ACCESS_KIND_LABEL } from '@/constants/documentLevels';
import type { DocumentAccessKind } from '@/types/models';

export interface RequestAccessOptions {
  /** The kinds of access this prompt may ask for. Defaults to View access.
   *  With more than one, the dialog shows a tick box per kind. */
  kinds?: DocumentAccessKind[];
  /** Which of `kinds` start ticked. Defaults to all of them. */
  checked?: DocumentAccessKind[];
}

/** The tick boxes, one per kind. Reports the current selection upwards on
 *  every change, since the modal's actions are set when it opens. */
function AccessKindChoice({
  kinds,
  initial,
  onChange,
}: {
  kinds: DocumentAccessKind[];
  initial: DocumentAccessKind[];
  onChange: (selected: DocumentAccessKind[]) => void;
}) {
  const [selected, setSelected] = useState<DocumentAccessKind[]>(initial);
  const toggle = (kind: DocumentAccessKind) => {
    const next = selected.includes(kind)
      ? selected.filter((k) => k !== kind)
      : kinds.filter((k) => k === kind || selected.includes(k));
    setSelected(next);
    onChange(next);
  };
  return (
    <div className="field">
      <label>What do you need?</label>
      {kinds.map((kind) => (
        <label key={kind} className="flex items-center gap-2" style={{ fontWeight: 400 }}>
          <input type="checkbox" checked={selected.includes(kind)} onChange={() => toggle(kind)} />
          {ACCESS_KIND_LABEL[kind]}
        </label>
      ))}
      {selected.length === 0 && <div className="caption">Tick at least one.</div>}
    </div>
  );
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
    { kinds = ['view'], checked = kinds }: RequestAccessOptions = {},
  ) => {
    let reason = '';
    let selected = kinds.filter((k) => checked.includes(k));
    openModal({
      title: documentTitle ? `Request access — ${documentTitle}` : 'Request access',
      body: (
        <div>
          <p className="caption mb-4">
            Your request will be reviewed and you will be notified of the decision.
          </p>
          {kinds.length > 1 && (
            <AccessKindChoice
              kinds={kinds}
              initial={selected}
              onChange={(next) => (selected = next)}
            />
          )}
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
            // Nothing ticked: keep the dialog open; the choice says why.
            if (selected.length === 0) return false;
            const results = await Promise.allSettled(
              selected.map((permission) =>
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
