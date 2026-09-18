'use client';

import React, { useState } from 'react';
import { useDocumentComments, useAddDocumentComment } from '@/apis/hooks/useDocuments';
import { fmtDateTime } from '@/utils/helpers';

interface Props {
  documentId: string;
  /** Controls whether the panel renders at all — should reflect
   *  `document_comment:view`, not `document:view`. */
  canView: boolean;
  /** Controls whether the post-a-comment form renders — should reflect
   *  `document_comment:create`. */
  canPost: boolean;
}

/**
 * The dedicated `GET/POST /documents/:id/comments` thread — a separate record
 * from the `comment` field on workflow task actions (which still drives the
 * approve/reject/etc. activity trail). This is general discussion, not tied
 * to any pending task.
 */
export function DocumentCommentsPanel({ documentId, canView, canPost }: Props) {
  const { data: comments, isLoading } = useDocumentComments(canView ? documentId : undefined);
  const addComment = useAddDocumentComment();
  const [draft, setDraft] = useState('');

  if (!canView) return null;

  const sorted = [...(comments || [])].sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
  );

  const post = () => {
    const content = draft.trim();
    if (!content) return;
    addComment.mutate(
      { id: documentId, content },
      { onSuccess: () => setDraft('') },
    );
  };

  return (
    <div className="card">
      <div className="card-head">
        <span className="h3">Comments</span>
      </div>
      <div className="card-body" style={{ paddingTop: '6px' }}>
        {canPost && (
          <div className="field" style={{ marginBottom: '12px' }}>
            <textarea
              className="input"
              placeholder="Add a comment…"
              maxLength={4000}
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
            />
            <div className="flex justify-end mt-2">
              <button
                className="btn btn-secondary btn-sm"
                disabled={!draft.trim() || addComment.isPending}
                onClick={post}
              >
                {addComment.isPending ? 'Posting…' : 'Post comment'}
              </button>
            </div>
          </div>
        )}

        {isLoading && <div className="caption">Loading comments…</div>}
        {!isLoading && sorted.length === 0 && <div className="caption">No comments yet.</div>}
        {sorted.map((c) => (
          <div key={c.id} className="meta-row" style={{ alignItems: 'flex-start' }}>
            <span className="k" style={{ flexShrink: 0 }}>
              {c.author.name}
            </span>
            <span className="v" style={{ textAlign: 'left' }}>
              <div style={{ fontSize: '12.5px' }}>{c.content}</div>
              <div className="caption" style={{ marginTop: '2px' }}>
                {fmtDateTime(c.createdAt)}
              </div>
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
