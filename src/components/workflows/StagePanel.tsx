'use client';

import { StagePropertiesPanel, StagePropertiesPanelProps } from './StagePropertiesPanel';
import { BranchEditorCard } from './BranchEditorCard';
import type { WorkflowDefinitionJson, WorkflowStage, WorkflowTransition } from '@/types/models';

export type StageTab = 'properties' | 'transitions';

export interface StagePanelProps {
  selectedStage: WorkflowStage | null;
  stages: WorkflowStage[];
  transitions: WorkflowTransition[];
  onSaveTransitions: (definition: WorkflowDefinitionJson) => void;
  saving: boolean;
  canEdit: boolean;
  propertiesProps: Omit<StagePropertiesPanelProps, 'selectedStage' | 'bare'>;
  /** Whether this stage branches (conditionally or in parallel); shown as a dot on
   *  the Transitions tab. */
  stageBranches: boolean;
  /** Controlled by the page, so a branch-label click on the canvas can switch it
   *  to 'transitions'. */
  tab: StageTab;
  onTabChange: (tab: StageTab) => void;
}

/** The selected stage's Properties and Transitions tabs. Both stay mounted (hidden by
 *  CSS), so an unsaved edit survives switching tabs. */
export function StagePanel({
  selectedStage,
  stages,
  transitions,
  onSaveTransitions,
  saving,
  canEdit,
  propertiesProps,
  stageBranches,
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
          {stageBranches && <span className="wfd-tab-dot" aria-label="This stage branches" />}
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
