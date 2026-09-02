'use client';

import React, { useRef } from 'react';
import { Avatar } from '@/components/ui/Avatar';
import { timeAgo } from '@/utils/helpers';
import type { WorkflowInstance } from '@/types/models';
import type { DocumentCommentUI } from '@/components/documents/types';

export interface WorkflowActivityPanelProps {
  workflowInstance: WorkflowInstance | undefined;
  currentStageActorName: string;
  comments: DocumentCommentUI[];
  getCommentAuthor: (comment: DocumentCommentUI) => { name: string } | undefined;
  onAddComment: (text: string) => void;
  isAddingComment: boolean;
}

export function WorkflowActivityPanel({
  workflowInstance,
  currentStageActorName,
  comments,
  getCommentAuthor,
  onAddComment,
  isAddingComment,
}: WorkflowActivityPanelProps) {
  const commentInputRef = useRef<HTMLTextAreaElement>(null);
  const stages = workflowInstance?.workflowDefinition?.definition?.stages;

  const handleSubmitComment = () => {
    const text = commentInputRef.current?.value?.trim();
    if (!text) return;
    onAddComment(text);
    if (commentInputRef.current) commentInputRef.current.value = '';
  };

  return (
    <div className="card">
      <div className="card-head">
        <span className="h3">Workflow & Activity</span>
      </div>
      <div className="card-body">
        {!workflowInstance && <div className="caption mb8">No workflow started for this document.</div>}
        {stages?.map((s, i, arr) => {
          const curIdx = arr.findIndex((x) => x.id === workflowInstance!.currentStage);
          const state = workflowInstance!.status === 'closed' || i < curIdx ? 'done' : i === curIdx ? 'current' : 'next';
          return (
            <div key={s.id} className={`wf-stage ${state}`}>
              <div className="wf-dot">{state === 'done' ? '✓' : String(i + 1)}</div>
              <div className="wf-info" style={{ flex: 1 }}>
                <div className="nm">{s.name || s.id}</div>
                <div className="who">
                  {state === 'current' ? `${currentStageActorName} · in progress` : s.role || ''}
                </div>
              </div>
            </div>
          );
        })}

        <div className="divider"></div>
        <div className="h3 mb8">Minutes & comments</div>
        {comments.map((c, i) => {
          const author = getCommentAuthor(c) || { name: 'User' };
          return (
            <div key={c.id || i} className="comment">
              <Avatar user={author} />
              <div>
                <div className="by">
                  {author.name} · {c.createdAt ? timeAgo(new Date(c.createdAt).getTime()) : ''}
                </div>
                <div className="body">{c.text}</div>
              </div>
            </div>
          );
        })}
        {comments.length === 0 && <div className="caption mb8">No comments yet.</div>}

        <div className="mt8">
          <textarea
            ref={commentInputRef}
            className="input"
            placeholder="Add a comment or minute…"
            style={{ minHeight: '54px' }}
          />
          <button
            className="btn btn-primary btn-sm mt8"
            disabled={isAddingComment}
            onClick={handleSubmitComment}
          >
            {isAddingComment ? 'Adding...' : 'Add comment'}
          </button>
        </div>
      </div>
    </div>
  );
}
