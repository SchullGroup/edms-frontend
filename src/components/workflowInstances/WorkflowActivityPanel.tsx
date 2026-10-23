'use client';

import React from 'react';
import type { WorkflowInstance } from '@/types/models';
import { WorkflowStageProgress } from './WorkflowStageProgress';
import { WorkflowHistoryTimeline } from './WorkflowHistoryTimeline';
import { useWorkflowDocumentPositions } from './useWorkflowDocumentPositions';

export interface WorkflowActivityPanelProps {
  workflowInstance: WorkflowInstance | undefined;
  currentStageActorName: string;
  /** Opens the route-to-workflow picker. Omitted when the viewer can't route. */
  onRoute?: () => void;
}

export function WorkflowActivityPanel({
  workflowInstance,
  currentStageActorName,
  onRoute,
}: WorkflowActivityPanelProps) {
  const stages = workflowInstance?.workflowDefinition?.definition?.stages;
  const { positions } = useWorkflowDocumentPositions(workflowInstance);
  // The backend blanks every comment, note and signature in a workflow's
  // history for a viewer who can't open one of its documents (edms-backend
  // `3014b89`), so say so rather than let the gaps read as silence.
  const historyRedacted = (workflowInstance?.documents ?? []).some(
    (d) => d.isLocked || d.access?.canView === false,
  );

  return (
    <div className="card">
      <div className="card-head">
        <span className="h3">Workflow & Activity</span>
      </div>
      <div className="card-body">
        {!workflowInstance ? (
          <div className="mb-4">
            <div className="caption mb-2">
              No workflow started for this document — nobody has been asked to act on it.
            </div>
            {onRoute && (
              <button className="btn btn-primary btn-sm" onClick={onRoute}>
                Route to workflow
              </button>
            )}
          </div>
        ) : (
          <>
            <WorkflowStageProgress
              stages={stages}
              transitions={workflowInstance.workflowDefinition?.definition?.transitions}
              positions={positions}
              status={workflowInstance.status}
              tasks={workflowInstance.tasks}
              currentActorName={currentStageActorName}
            />

            <div className="divider"></div>
            <div className="h3 mb-2">Activity trail</div>
            {historyRedacted && (
              <div className="caption mb-2">
                Comments and signatures are hidden because this workflow includes documents you
                can’t open.
              </div>
            )}
            {/* Fixed height, scrolls on its own — a long trail would otherwise
                stretch the page far below the document viewer beside it. */}
            <div
              tabIndex={0}
              aria-label="Activity trail"
              style={{ maxHeight: 340, overflowY: 'auto', paddingRight: 4 }}
            >
              <WorkflowHistoryTimeline
                workflowInstanceId={workflowInstance.id}
                stages={stages}
                limit={50}
                emptyMessage="Nothing has been actioned on this workflow yet."
              />
            </div>
          </>
        )}

        <div className="caption mt-2">
          Comments and minutes are added when you act on your workflow task (approve, review,
          request changes…) and appear in the activity trail above.
        </div>
      </div>
    </div>
  );
}
