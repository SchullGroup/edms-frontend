import { useEffect, useState } from 'react';
import {
  coerceRuleValue,
  defaultRule,
  defaultRuleValue,
  operatorsForField,
  ruleValueIssue,
  trimRuleValues,
} from '@/components/workflows/constants';
import {
  applyStageRouting,
  forkJoinStage,
  indexGraph,
  isParallelFork,
  reachableFrom,
  suggestJoinStage,
  validateParallelRouting,
  validateStageTransitions,
} from '@/components/workflows/workflowGraph';
import { useAllMetadataFields } from '@/apis/hooks/useMetadataFields';
import type {
  WorkflowConditionField,
  WorkflowConditionOperator,
  WorkflowConditionRule,
  WorkflowDefinitionJson,
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
const sameDefinition = (a: WorkflowDefinitionJson, b: WorkflowDefinitionJson) =>
  canonical(a.stages) === canonical(b.stages) &&
  canonical(a.transitions.map(canonical).sort()) === canonical(b.transitions.map(canonical).sort());

/** What saving changes beyond this stage's own branches, in plain words. */
function describeSideEffects(before: WorkflowDefinitionJson, after: WorkflowDefinitionJson, stageId: string): string[] {
  const { name } = indexGraph(after);
  const key = (t: WorkflowTransition) => `${t.from}->${t.to}`;
  const others = (d: WorkflowDefinitionJson) => d.transitions.filter((t) => t.from !== stageId);
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

/** State and rules for editing one stage's outgoing transitions, kept out of
 *  `BranchEditorCard` so any editor UI can use them. */
export function useBranchDraft(
  stage: WorkflowStage | null,
  stages: WorkflowStage[],
  transitions: WorkflowTransition[],
  /** The whole definition: a parallel branch can change other stages too. */
  onSave: (definition: WorkflowDefinitionJson) => void,
) {
  const { data: metadataFields } = useAllMetadataFields();

  const current: WorkflowDefinitionJson = { stages, transitions };
  const graph = indexGraph(current);
  const outgoing = stage ? graph.outgoing(stage.id) : [];
  const [drafts, setDrafts] = useState<DraftTransition[]>(() => toDrafts(outgoing));
  // Where parallel branches meet: undefined = not chosen yet (the current join,
  // else a suggestion), null = they never meet.
  const [joinDraft, setJoinDraft] = useState<string | null | undefined>(undefined);

  // Resync only when the selection changes (or a save reopens the same stage),
  // so a background refetch never clobbers an edit in progress.
  useEffect(() => {
    setDrafts(toDrafts(stage ? graph.outgoing(stage.id) : []));
    setJoinDraft(undefined);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stage?.id]);

  const otherStages = stage ? stages.filter((s) => s.id !== stage.id) : [];
  const isTerminal = !!stage && stages[stages.length - 1]?.id === stage.id && drafts.length === 0;

  // Rule values trimmed as the backend stores them, or a value saved with a
  // trailing space comes back different and the tab reads as unsaved.
  const plainDrafts = drafts.map(({ _key, ...t }): WorkflowTransition =>
    t.condition ? { ...t, condition: { ...t.condition, rules: t.condition.rules.map(trimRuleValues) } } : t,
  );
  const parallel = isParallelFork(plainDrafts);
  // Only a stage that is already a fork has a join; otherwise the "meeting
  // stage" of its single route is just wherever that route leads.
  const savedJoin =
    stage && isParallelFork(outgoing)
      ? (forkJoinStage(graph, stage.id)?.id ?? null)
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
      : (notABranch(savedJoin) ?? suggestJoinStage(indexGraph({ stages, transitions: draftTransitions }), stage.id));
  const next = stage ? applyStageRouting(current, stage.id, plainDrafts, joinStageId) : current;
  const sideEffects = stage ? describeSideEffects(current, next, stage.id) : [];
  // Where branches can meet: any stage after this one that isn't a branch
  // itself (a stage leading back here would loop).
  const joinOptions = otherStages.filter(
    (s) =>
      !plainDrafts.some((t) => t.to === s.id) &&
      !(stage && reachableFrom(graph, s.id).has(stage.id)),
  );

  const dirty = !sameDefinition(next, current);
  const fieldById = (id?: string) => metadataFields?.find((f) => f.id === id);
  // A value that doesn't fit its field blocks the save here, rather than failing
  // later (for metadata, maybe only when a document reaches the stage).
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
          ? validateParallelRouting(indexGraph(next)).map((message) => ({ stageId: stage.id, message }))
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

  // The backend refuses two branches to the same stage, so don't offer another
  // branch once every other stage is a target (e.g. a 2-stage workflow).
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
