import { useEffect, useState } from 'react';
import {
  applyStageRouting,
  coerceRuleValue,
  defaultRule,
  defaultRuleValue,
  forkJoinStage,
  isParallelFork,
  operatorsForField,
  reachableFrom,
  ruleValueIssue,
  suggestJoinStage,
  validateParallelRouting,
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

type Definition = { stages: WorkflowStage[]; transitions: WorkflowTransition[] };

/** JSON with object keys sorted: the saved definition comes back from a
 *  Postgres `jsonb` column, which reorders keys (`{"to":…,"from":…}`). */
const canonical = (value: unknown): string =>
  JSON.stringify(value, (_key, v) =>
    v && typeof v === 'object' && !Array.isArray(v)
      ? Object.fromEntries(Object.keys(v).sort().map((k) => [k, v[k]]))
      : v,
  );
/** Insensitive to key order and to transition order, so moving a stage's
 *  transitions to the end of the list on save doesn't count as a change. */
const sameDefinition = (a: Definition, b: Definition) =>
  canonical(a.stages) === canonical(b.stages) &&
  canonical(a.transitions.map(canonical).sort()) === canonical(b.transitions.map(canonical).sort());

/** What saving changes beyond this stage's own branches, in plain words. */
function describeSideEffects(before: Definition, after: Definition, stageId: string): string[] {
  const name = (id: string) => after.stages.find((s) => s.id === id)?.name || id;
  const key = (t: WorkflowTransition) => `${t.from}->${t.to}`;
  const others = (d: Definition) => d.transitions.filter((t) => t.from !== stageId);
  const beforeKeys = new Set(others(before).map(key));
  const afterKeys = new Set(others(after).map(key));
  const notes: string[] = [];
  others(after)
    .filter((t) => !beforeKeys.has(key(t)))
    .forEach((t) => notes.push(`${name(t.from)} goes on to ${name(t.to)}`));
  others(before)
    .filter((t) => !afterKeys.has(key(t)))
    .forEach((t) => notes.push(`${name(t.from)} no longer goes to ${name(t.to)}`));
  after.stages.forEach((s) => {
    const was = before.stages.find((b) => b.id === s.id)?.join === 'all';
    if (s.join === 'all' && !was) notes.push(`${name(s.id)} waits for every branch`);
    if (s.join !== 'all' && was) notes.push(`${name(s.id)} stops waiting for branches`);
  });
  return notes;
}

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
  /** The whole definition: a parallel branch can change other stages too. */
  onSave: (definition: Definition) => void,
) {
  const { data: metadataFields } = useAllMetadataFields();

  const outgoing = stage ? transitions.filter((t) => t.from === stage.id) : [];
  const [drafts, setDrafts] = useState<DraftTransition[]>(() => toDrafts(outgoing));
  // Where parallel branches meet: undefined = not chosen yet (the current join,
  // else a suggestion), null = they never meet.
  const [joinDraft, setJoinDraft] = useState<string | null | undefined>(undefined);

  // Only resync from server data when the *selection* changes (or a save
  // lands and the popover reopens for the same stage) — never clobber an
  // in-progress edit on a background refetch.
  useEffect(() => {
    setDrafts(toDrafts(stage ? transitions.filter((t) => t.from === stage.id) : []));
    setJoinDraft(undefined);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stage?.id]);

  const otherStages = stage ? stages.filter((s) => s.id !== stage.id) : [];
  const isTerminal = !!stage && stages[stages.length - 1]?.id === stage.id && drafts.length === 0;

  const plainDrafts = drafts.map(({ _key, ...t }) => t);
  const parallel = isParallelFork(plainDrafts);
  const current: Definition = { stages, transitions };
  // Only a stage that is already a fork has a join; otherwise the "meeting
  // stage" of its single route is just wherever that route leads.
  const savedJoin =
    stage && isParallelFork(outgoing)
      ? (forkJoinStage(stages, transitions, stage.id)?.id ?? null)
      : null;
  const draftTransitions = stage
    ? [...transitions.filter((t) => t.from !== stage.id), ...plainDrafts]
    : transitions;
  // A branch can't also be where the branches meet.
  const notABranch = (id: string | null) =>
    id && !plainDrafts.some((t) => t.to === id) ? id : null;
  const joinStageId = !parallel || !stage
    ? null
    : joinDraft !== undefined
      ? notABranch(joinDraft)
      : (notABranch(savedJoin) ?? suggestJoinStage(stages, draftTransitions, stage.id));
  const next = stage ? applyStageRouting(current, stage.id, plainDrafts, joinStageId) : current;
  const sideEffects = stage ? describeSideEffects(current, next, stage.id) : [];
  // Where branches can meet: any stage after this one that isn't a branch
  // itself (a stage leading back here would loop).
  const joinOptions = otherStages.filter(
    (s) =>
      !plainDrafts.some((t) => t.to === s.id) &&
      !(stage && reachableFrom(s.id, transitions).has(stage.id)),
  );

  const dirty = !sameDefinition(next, current);
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
        // Only once something changed: an untouched stage shouldn't show
        // problems elsewhere in the workflow it can't fix.
        ...(dirty
          ? validateParallelRouting(next).map((message) => ({ stageId: stage.id, message }))
          : []),
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

  /** Another unconditional transition: with two or more and no conditions,
   *  every one of them runs at once. */
  const addParallelBranch = () => {
    const target = availableTargets[0];
    if (!target || !stage) return;
    setDrafts((prev) => [...prev, { _key: nextDraftKey(), from: stage.id, to: target.id }]);
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
    onSave(next);
  };

  const handleDiscard = () => {
    setDrafts(toDrafts(outgoing));
    setJoinDraft(undefined);
  };

  return {
    drafts,
    otherStages,
    isTerminal,
    dirty,
    issues,
    availableTargets,
    metadataFields,
    parallel,
    joinStageId,
    joinOptions,
    setJoinStageId: setJoinDraft,
    sideEffects,
    updateDraft,
    removeDraft,
    addConditionalBranch,
    addParallelBranch,
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
