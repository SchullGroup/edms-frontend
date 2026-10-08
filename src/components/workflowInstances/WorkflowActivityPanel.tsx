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
              positions={positions}
              status={workflowInstance.status}
              currentActorName={currentStageActorName}
            />

            <div className="divider"></div>
            <div className="h3 mb-2">Activity trail</div>
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
                limit={20}
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
