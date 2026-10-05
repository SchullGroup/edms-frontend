import { useEffect, useState } from 'react';
import { defaultRule, validateStageTransitions, valueOptionsForField } from '@/components/workflows/constants';
import { useAllMetadataFields } from '@/apis/hooks/useMetadataFields';
import type { WorkflowConditionField, WorkflowConditionRule, WorkflowStage, WorkflowTransition } from '@/types/models';

let draftKeySeq = 0;
const nextDraftKey = () => `draft_${Date.now()}_${draftKeySeq++}`;

export interface DraftTransition extends WorkflowTransition {
  _key: string;
}

const toDrafts = (outgoing: WorkflowTransition[]): DraftTransition[] =>
  outgoing.map((t) => ({ ...t, _key: nextDraftKey() }));

/**
 * All the state and rules for editing one stage's outgoing transitions —
 * split out of the editor UI (`BranchEditorCard`) so the validation/mutation
 * logic isn't tied to any particular presentation. It used to live inside a
 * side-panel component; it works identically inside a canvas-anchored
 * popover, which is the entire point of pulling it out.
 */
export function useBranchDraft(
  stage: WorkflowStage | null,
  stages: WorkflowStage[],
  transitions: WorkflowTransition[],
  onSave: (stageId: string, outgoing: WorkflowTransition[]) => void,
) {
  const { data: metadataFields } = useAllMetadataFields();

  const outgoing = stage ? transitions.filter((t) => t.from === stage.id) : [];
  const [drafts, setDrafts] = useState<DraftTransition[]>(() => toDrafts(outgoing));

  // Only resync from server data when the *selection* changes (or a save
  // lands and the popover reopens for the same stage) — never clobber an
  // in-progress edit on a background refetch.
  useEffect(() => {
    setDrafts(toDrafts(stage ? transitions.filter((t) => t.from === stage.id) : []));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stage?.id]);

  const otherStages = stage ? stages.filter((s) => s.id !== stage.id) : [];
  const isTerminal = !!stage && stages[stages.length - 1]?.id === stage.id && drafts.length === 0;

  const dirty = JSON.stringify(drafts.map(({ _key, ...t }) => t)) !== JSON.stringify(outgoing);
  const issues = stage ? validateStageTransitions(stage.id, drafts) : [];

  // The backend rejects a second transition to a stage another one of this
  // stage's branches already targets, so there's no point offering "+ Add
  // conditional branch" when every other stage is already spoken for (most
  // visibly on a 2-stage workflow, where the single fallback already uses
  // the only other stage there is).
  const usedTargets = new Set(drafts.map((d) => d.to));
  const availableTargets = otherStages.filter((s) => !usedTargets.has(s.id));

  const updateDraft = (key: string, patch: Partial<DraftTransition>) => {
    setDrafts((prev) => prev.map((d) => (d._key === key ? { ...d, ...patch } : d)));
  };

  const removeDraft = (key: string) => {
    setDrafts((prev) => prev.filter((d) => d._key !== key));
  };

  const addConditionalBranch = () => {
    const target = availableTargets[0];
    if (!target || !stage) return;
    const conditionalCount = drafts.filter((d) => d.condition).length;
    setDrafts((prev) => [
      ...prev,
      {
        _key: nextDraftKey(),
        from: stage.id,
        to: target.id,
        priority: conditionalCount + 1,
        condition: { mode: 'all', rules: [defaultRule()] },
      },
    ]);
  };

  const addRule = (key: string) => {
    setDrafts((prev) =>
      prev.map((d) =>
        d._key === key && d.condition
          ? { ...d, condition: { ...d.condition, rules: [...d.condition.rules, defaultRule()] } }
          : d,
      ),
    );
  };

  const removeRule = (key: string, idx: number) => {
    setDrafts((prev) =>
      prev.map((d) =>
        d._key === key && d.condition
          ? { ...d, condition: { ...d.condition, rules: d.condition.rules.filter((_, i) => i !== idx) } }
          : d,
      ),
    );
  };

  const updateRule = (key: string, idx: number, patch: Partial<WorkflowConditionRule>) => {
    setDrafts((prev) =>
      prev.map((d) => {
        if (d._key !== key || !d.condition) return d;
        const rules = d.condition.rules.map((r, i) => (i === idx ? { ...r, ...patch } : r));
        return { ...d, condition: { ...d.condition, rules } };
      }),
    );
  };

  const setMode = (key: string, mode: 'all' | 'any') => {
    setDrafts((prev) =>
      prev.map((d) => (d._key === key && d.condition ? { ...d, condition: { ...d.condition, mode } } : d)),
    );
  };

  const handleFieldChange = (key: string, idx: number, field: WorkflowConditionField) => {
    const values = valueOptionsForField(field);
    updateRule(key, idx, {
      field,
      operator: 'equals',
      value: values ? values[0].value : '',
      metadata_field_id: field === 'metadata' ? metadataFields?.[0]?.id : undefined,
    });
  };

  const handleSave = () => {
    if (!stage || issues.length > 0) return;
    onSave(
      stage.id,
      drafts.map(({ _key, ...t }) => t),
    );
  };

  const handleDiscard = () => {
    setDrafts(toDrafts(outgoing));
  };

  return {
    drafts,
    otherStages,
    isTerminal,
    dirty,
    issues,
    availableTargets,
    metadataFields,
    updateDraft,
    removeDraft,
    addConditionalBranch,
    addRule,
    removeRule,
    updateRule,
    setMode,
    handleFieldChange,
    handleSave,
    handleDiscard,
  };
}
