import { useEffect, useState } from 'react';
import {
  coerceRuleValue,
  defaultRule,
  defaultRuleValue,
  operatorsForField,
  ruleValueIssue,
  validateStageTransitions,
} from '@/components/workflows/constants';
import { useAllMetadataFields } from '@/apis/hooks/useMetadataFields';
import type {
  WorkflowConditionField,
  WorkflowConditionOperator,
  WorkflowConditionRule,
  WorkflowStage,
  WorkflowTransition,
} from '@/types/models';

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
  const fieldById = (id?: string) => metadataFields?.find((f) => f.id === id);
  // A value that doesn't fit its field (a word in a number field, a date that
  // isn't one) blocks the save here rather than failing later — for metadata,
  // possibly only when a document reaches the stage.
  const ruleIssue = (rule: WorkflowConditionRule) =>
    ruleValueIssue(rule, rule.field === 'metadata' ? fieldById(rule.metadata_field_id) : undefined);
  const ruleIssueCount = drafts.reduce(
    (n, d) => n + (d.condition?.rules.filter((r) => ruleIssue(r) !== null).length ?? 0),
    0,
  );
  const issues = stage
    ? [
        ...validateStageTransitions(stage.id, drafts),
        ...(ruleIssueCount > 0
          ? [
              {
                stageId: stage.id,
                message: `${ruleIssueCount} rule${ruleIssueCount === 1 ? ' has a value that doesn’t fit its field' : 's have values that don’t fit their fields'} — fix ${ruleIssueCount === 1 ? 'it' : 'them'} above.`,
              },
            ]
          : []),
      ]
    : [];

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
    const metadataField = field === 'metadata' ? metadataFields?.[0] : undefined;
    updateRule(key, idx, {
      field,
      operator: 'equals',
      value: defaultRuleValue(field, 'equals', metadataField),
      metadata_field_id: metadataField?.id,
    });
  };

  /** A different metadata field can mean a different type: keep the operator
   *  only if the new type allows it, and start the value afresh. */
  const handleMetadataFieldChange = (
    key: string,
    idx: number,
    rule: WorkflowConditionRule,
    fieldId: string,
  ) => {
    const field = fieldById(fieldId);
    const allowed = operatorsForField('metadata', field?.fieldType).map((o) => o.value);
    const operator = allowed.includes(rule.operator) ? rule.operator : 'equals';
    updateRule(key, idx, {
      metadata_field_id: fieldId,
      operator,
      value: defaultRuleValue('metadata', operator, field),
    });
  };

  /** Switching between a one-value and a list operator reshapes the value. */
  const handleOperatorChange = (
    key: string,
    idx: number,
    rule: WorkflowConditionRule,
    operator: WorkflowConditionOperator,
  ) => {
    updateRule(key, idx, { operator, value: coerceRuleValue(rule.value, operator) });
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
    handleMetadataFieldChange,
    handleOperatorChange,
    fieldById,
    ruleIssue,
    handleSave,
    handleDiscard,
  };
}
