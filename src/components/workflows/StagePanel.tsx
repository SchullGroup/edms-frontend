'use client';

import { StagePropertiesPanel, StagePropertiesPanelProps } from './StagePropertiesPanel';
import { BranchEditorCard } from './BranchEditorCard';
import type { WorkflowStage, WorkflowTransition } from '@/types/models';

export type StageTab = 'properties' | 'transitions';

export interface StagePanelProps {
  selectedStage: WorkflowStage | null;
  stages: WorkflowStage[];
  transitions: WorkflowTransition[];
  onSaveTransitions: (stageId: string, outgoing: WorkflowTransition[]) => void;
  saving: boolean;
  canEdit: boolean;
  propertiesProps: Omit<StagePropertiesPanelProps, 'selectedStage' | 'bare'>;
  /** Whether this stage has any conditional branch — shown as a small dot on
   *  the Transitions tab so a stage's routing isn't invisible from the
   *  Properties tab. */
  hasConditionalBranch: boolean;
  /** Controlled from the page, not local state — clicking a branch line's
   *  label on the canvas needs to force this to 'transitions', which a
   *  sibling component (WorkflowCanvas) can't reach into local state for. */
  tab: StageTab;
  onTabChange: (tab: StageTab) => void;
}

/**
 * One card, two tabs, for whichever stage is selected on the canvas: what to
 * assign it and its SLA (Properties), and where its documents go next
 * (Transitions). Both tabs stay mounted (hidden via CSS, not unmounted) when
 * you switch — an in-progress edit on either one survives flipping to the
 * other and back, which a plain conditional render wouldn't give you.
 *
 * The Transitions tab is `BranchEditorCard` — the same component used for
 * the canvas-anchored popover this replaced — so routing here and there
 * would (if both existed) share one implementation; there's no second copy
 * of the rule-builder to keep in sync.
 */
export function StagePanel({
  selectedStage,
  stages,
  transitions,
  onSaveTransitions,
  saving,
  canEdit,
  propertiesProps,
  hasConditionalBranch,
  tab,
  onTabChange,
}: StagePanelProps) {
  if (!selectedStage) {
    return (
      <div className="card wfd-props">
        <div className="card-head">
          <span className="h3">Stage</span>
        </div>
        <StagePropertiesPanel {...propertiesProps} selectedStage={null} bare />
      </div>
    );
  }

  return (
    <div className="card wfd-props">
      <div className="card-head">
        <span className="h3">{selectedStage.name || selectedStage.id}</span>
        {saving && <span className="btn-spinner" aria-hidden="true" />}
      </div>

      <div className="seg wfd-tabbar" role="tablist" aria-label="Stage configuration">
        <button type="button" role="tab" aria-selected={tab === 'properties'} className={tab === 'properties' ? 'active' : ''} onClick={() => onTabChange('properties')}>
          Properties
        </button>
        <button type="button" role="tab" aria-selected={tab === 'transitions'} className={tab === 'transitions' ? 'active' : ''} onClick={() => onTabChange('transitions')}>
          Transitions
          {hasConditionalBranch && <span className="wfd-tab-dot" aria-label="Has a conditional branch" />}
        </button>
      </div>

      <div style={{ display: tab === 'properties' ? 'block' : 'none' }}>
        <StagePropertiesPanel {...propertiesProps} selectedStage={selectedStage} bare />
      </div>
      <div style={{ display: tab === 'transitions' ? 'block' : 'none' }}>
        <div className="card-body">
          <BranchEditorCard
            stage={selectedStage}
            stages={stages}
            transitions={transitions}
            onSave={onSaveTransitions}
            saving={saving}
            canEdit={canEdit}
          />
        </div>
      </div>
    </div>
  );
}
