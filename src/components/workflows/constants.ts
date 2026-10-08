import type {
  CabinetMetadataField,
  CabinetMetadataFieldType,
  WorkflowCondition,
  WorkflowConditionField,
  WorkflowConditionOperator,
  WorkflowConditionRule,
  WorkflowConditionValue,
  WorkflowStage,
  WorkflowTransition,
} from '@/types/models';

// Every option here is a real, distinct value from WorkflowStageAction — no
// cosmetic "stage type" layer on top of it. A stage can allow more than one
// (e.g. a decision stage typically wants both approve and reject).
export const STAGE_ACTIONS = [
  { value: 'review', label: 'Review', hint: 'Marks it reviewed and advances to the next stage' },
  { value: 'approve', label: 'Approve', hint: 'Advances to the next stage' },
  { value: 'reject', label: 'Reject', hint: 'Ends the workflow' },
  { value: 'request_changes', label: 'Request changes', hint: 'Sends the file back to the previous stage' },
  { value: 'delegate', label: 'Delegate', hint: "Hands this stage off to someone else, without advancing it" },
  { value: 'close', label: 'Close', hint: 'Ends the workflow' },
];

export const actionLabel = (a: string) => STAGE_ACTIONS.find((x) => x.value === a)?.label || a;

export const DEFAULT_WORKFLOW_DEFINITION = {
  stages: [{ id: 'start', name: 'Start stage', role: 'staff', sla_hours: 24, actions: ['review'] }],
  transitions: [],
};

// --- Conditional routing -------------------------------------------------
// Mirrors `edms-backend/src/shared/constants/workflow.constants.ts` and the
// per-field rules in `definitions.validation.ts` exactly — these values and
// restrictions are enforced server-side with a strict Zod schema, so this
// isn't a UI convenience list, it's the same contract restated for the form.

export const CONDITION_FIELDS: { value: WorkflowConditionField; label: string }[] = [
  { value: 'urgency', label: 'Urgency' },
  { value: 'confidentiality', label: 'Confidentiality' },
  { value: 'metadata', label: 'Metadata field' },
];

const COMPARISON_OPERATORS: WorkflowConditionOperator[] = [
  'greater_than',
  'greater_than_or_equal',
  'less_than',
  'less_than_or_equal',
];

const OPERATOR_LABELS: Record<WorkflowConditionOperator, string> = {
  equals: 'equals',
  not_equals: 'does not equal',
  in: 'is one of',
  not_in: 'is not one of',
  greater_than: 'is greater than',
  greater_than_or_equal: 'is at least',
  less_than: 'is less than',
  less_than_or_equal: 'is at most',
};

/** The operators a rule may use. Comparisons need a number or date metadata
 *  field: the backend refuses them on `urgency`/`confidentiality` when the
 *  workflow is saved, and on any other metadata type when a document reaches
 *  the stage (a 422 mid-workflow). A yes/no field only makes sense as
 *  equals / does not equal. Without a known field type, metadata gets the
 *  full list, as before. */
export function operatorsForField(
  field: WorkflowConditionField,
  metadataFieldType?: CabinetMetadataFieldType,
) {
  const base: WorkflowConditionOperator[] = ['equals', 'not_equals', 'in', 'not_in'];
  let values = base;
  if (field === 'metadata') {
    if (metadataFieldType === 'boolean') values = ['equals', 'not_equals'];
    else if (metadataFieldType === 'text' || metadataFieldType === 'select') values = base;
    else values = [...base, ...COMPARISON_OPERATORS];
  }
  return values.map((value) => ({ value, label: OPERATOR_LABELS[value] }));
}

/** `in` / `not_in` take a list of values; every other operator takes one. */
export const isListOperator = (operator: WorkflowConditionOperator) =>
  operator === 'in' || operator === 'not_in';

/** A sensible starting value for a rule — a list for list operators. Free-form
 *  types start empty, so the author has to type a real value before saving. */
export function defaultRuleValue(
  field: WorkflowConditionField,
  operator: WorkflowConditionOperator,
  metadataField?: Pick<CabinetMetadataField, 'fieldType' | 'options'>,
): WorkflowConditionRule['value'] {
  const fixed = valueOptionsForField(field);
  let single: WorkflowConditionValue = '';
  if (fixed) single = fixed[0].value;
  else if (metadataField?.fieldType === 'boolean') single = true;
  else if (metadataField?.fieldType === 'select') single = metadataField.options?.[0] ?? '';
  if (!isListOperator(operator)) return single;
  return single === '' ? [] : [single];
}

/** Carries a rule's value across an operator change: one value becomes a
 *  one-item list and a list keeps its first item. */
export function coerceRuleValue(
  value: WorkflowConditionRule['value'],
  operator: WorkflowConditionOperator,
): WorkflowConditionRule['value'] {
  if (isListOperator(operator)) {
    if (Array.isArray(value)) return value;
    return value === '' ? [] : [value];
  }
  return Array.isArray(value) ? (value[0] ?? '') : value;
}

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

/**
 * What's wrong with a rule's value for its field, or null — checked before
 * save, against the same rules the backend applies to that field type:
 * numbers must be numbers, dates real dates, a dropdown one of its options,
 * yes/no a yes or no, and a list operator at least one value.
 */
export function ruleValueIssue(
  rule: WorkflowConditionRule,
  metadataField?: Pick<CabinetMetadataField, 'name' | 'fieldType' | 'options'>,
): string | null {
  if (rule.field === 'metadata' && !rule.metadata_field_id) return 'Choose a metadata field.';
  const list = isListOperator(rule.operator);
  if (list && (!Array.isArray(rule.value) || rule.value.length === 0)) {
    return 'Add at least one value.';
  }
  const values = Array.isArray(rule.value) ? rule.value : [rule.value];

  const fixed = valueOptionsForField(rule.field);
  if (fixed) {
    return values.every((v) => fixed.some((o) => o.value === v)) ? null : 'Pick a value.';
  }
  if (!metadataField) return values.every((v) => String(v).trim()) ? null : 'Enter a value.';

  const name = metadataField.name;
  switch (metadataField.fieldType) {
    case 'number':
      return values.every((v) => String(v).trim() !== '' && Number.isFinite(Number(v)))
        ? null
        : `${name} is a number field — enter a number.`;
    case 'date':
      return values.every(
        (v) => typeof v === 'string' && DATE_RE.test(v) && !Number.isNaN(Date.parse(v)),
      )
        ? null
        : `${name} is a date field — pick a date.`;
    case 'boolean':
      return values.every((v) => v === true || v === false || v === 'true' || v === 'false')
        ? null
        : `${name} is a yes/no field — choose Yes or No.`;
    case 'select':
      return values.every((v) => metadataField.options?.includes(String(v)))
        ? null
        : `Choose from ${name}'s options.`;
    default:
      return values.every((v) => String(v).trim()) ? null : 'Enter a value.';
  }
}

export const URGENCY_VALUES = [
  { value: 'low', label: 'Low' },
  { value: 'normal', label: 'Normal' },
  { value: 'high', label: 'High' },
  { value: 'critical', label: 'Critical' },
];

export const CONFIDENTIALITY_VALUES = [
  { value: 'public', label: 'Public' },
  { value: 'internal', label: 'Internal' },
  { value: 'confidential', label: 'Confidential' },
  { value: 'restricted', label: 'Restricted' },
  { value: 'top_secret', label: 'Top secret' },
];

/** Fixed value choices for a field, or `null` when it's a free-form value
 *  (metadata — compared against whatever that field actually stores). */
export function valueOptionsForField(field: WorkflowConditionField) {
  if (field === 'urgency') return URGENCY_VALUES;
  if (field === 'confidentiality') return CONFIDENTIALITY_VALUES;
  return null;
}

export function defaultRule(): WorkflowConditionRule {
  return { field: 'urgency', operator: 'equals', value: 'critical' };
}

/** Short, human-readable summary for a branch's pill label on the canvas —
 *  e.g. "urgency = critical", "Invoice Amount is greater than 5000000" or
 *  "2 rules (any)". A metadata rule shows its field's name when `fieldName`
 *  can resolve it, else just "metadata". Not sent to the backend. */
export function describeCondition(
  condition: WorkflowCondition | undefined,
  fieldName?: (metadataFieldId: string) => string | undefined,
): string {
  if (!condition) return 'Fallback';
  if (condition.rules.length === 1) {
    const rule = condition.rules[0];
    const label = OPERATOR_LABELS[rule.operator];
    const shown = (v: WorkflowConditionValue) =>
      v === true ? 'Yes' : v === false ? 'No' : String(v);
    const value = Array.isArray(rule.value) ? rule.value.map(shown).join(', ') : shown(rule.value);
    const fieldLabel =
      rule.field === 'metadata'
        ? (rule.metadata_field_id && fieldName?.(rule.metadata_field_id)) || 'metadata'
        : rule.field;
    // Symbols keep the canvas pill short enough to read without truncating.
    const symbol: Partial<Record<WorkflowConditionOperator, string>> = {
      equals: '=',
      not_equals: '≠',
      greater_than: '>',
      greater_than_or_equal: '≥',
      less_than: '<',
      less_than_or_equal: '≤',
    };
    return `${fieldLabel} ${symbol[rule.operator] ?? label} ${value}`;
  }
  return `${condition.rules.length} rules (${condition.mode})`;
}

export interface StageTransitionIssue {
  stageId: string;
  message: string;
}

/**
 * Mirrors `validateWorkflowRouting` in the backend's `definitions.validation.ts`
 * closely enough to give the author feedback before a save round-trips into a
 * 422 — not a full re-implementation (unreachable-stage/cycle detection stays
 * server-side), just the two rules a branch author can actually violate while
 * editing one stage's transitions: exactly one fallback once any conditional
 * branch exists, and unique priorities among conditional branches.
 */
export function validateStageTransitions(
  stageId: string,
  outgoing: WorkflowTransition[],
): StageTransitionIssue[] {
  const issues: StageTransitionIssue[] = [];
  const conditional = outgoing.filter((t) => t.condition !== undefined);
  const fallback = outgoing.filter((t) => t.condition === undefined);

  if (conditional.length > 0 && fallback.length !== 1) {
    issues.push({
      stageId,
      message:
        fallback.length === 0
          ? 'This stage needs exactly one fallback transition (no condition) for when nothing matches.'
          : 'This stage can only have one fallback transition — the rest need a condition.',
    });
  }

  if (conditional.length > 1) {
    const missingPriority = conditional.some((t) => t.priority === undefined);
    if (missingPriority) {
      issues.push({ stageId, message: 'Every conditional branch needs a priority when there is more than one.' });
    }
    const priorities = conditional.map((t) => t.priority).filter((p): p is number => p !== undefined);
    if (new Set(priorities).size !== priorities.length) {
      issues.push({ stageId, message: 'Conditional branches need unique priorities.' });
    }
  }

  // The backend rejects two transitions between the same pair of stages
  // outright (`Duplicate transition 'from->to'`) — it has no way to tell them
  // apart at routing time even though the frontend shows them as separate
  // cards, one conditional and one not.
  const targets = outgoing.map((t) => t.to);
  if (new Set(targets).size !== targets.length) {
    issues.push({ stageId, message: 'Two branches from this stage point to the same next stage — pick a different target for one of them.' });
  }

  return issues;
}

/**
 * Reconciles the transition list after a structural edit (stage added,
 * removed or reordered) — replaces the old `rebuildTransitions`, which threw
 * away the *entire* transition list and rebuilt a straight chain every time.
 * That was correct back when a straight chain was the only shape a workflow
 * could have; now that a stage can carry an authored conditional branch (see
 * `WorkflowTransition.condition`), doing that would silently destroy it the
 * next time someone added a stage or dragged one to reorder it.
 *
 * The rule: any transition whose `from` stage still exists is left exactly as
 * authored (conditions, priorities and all). A stage that's left with *no*
 * outgoing transition at all — because it's new, or its old default one
 * pointed at a stage that no longer exists — gets a single plain fallback
 * transition to the next stage in `stages` order, the same default a brand
 * new sequential workflow has always had. The terminal stage never gets one.
 */
export function reconcileTransitions(
  stages: WorkflowStage[],
  existingTransitions: WorkflowTransition[],
): WorkflowTransition[] {
  const stageIds = new Set(stages.map((s) => s.id));

  const kept = existingTransitions.filter((t) => stageIds.has(t.from) && stageIds.has(t.to));
  const stagesWithOutgoing = new Set(kept.map((t) => t.from));

  const filled: WorkflowTransition[] = [...kept];
  stages.forEach((stage, i) => {
    const isTerminal = i === stages.length - 1;
    if (!isTerminal && !stagesWithOutgoing.has(stage.id)) {
      filled.push({ from: stage.id, to: stages[i + 1].id });
    }
  });

  return filled;
}

export interface StageLayoutPosition {
  id: string;
  /** Hops from the first stage along the routing graph. */
  column: number;
  /** Position among same-column siblings, centered on 0. */
  row: number;
}

/**
 * A layered graph layout for the canvas: column = the LONGEST path from the
 * first stage, row = position among stages that share a column, centered
 * around 0.
 *
 * Longest-path, so every stage sits to the right of everything that leads
 * into it. A fork that reconverges — the usual shape: a stage branches to
 * two approvals and a fallback, and all three lead on to one final stage —
 * then reads left to right: source, the branch targets, the shared target.
 * The earlier shortest-path layering put that shared target in the SAME
 * column as the branch targets whenever the fallback pointed straight at it,
 * so the lines into it ran backwards behind the cards and disappeared.
 *
 * A line that skips a column (a fallback straight to the final stage) is
 * routed around any card in between by `WorkflowCanvas`. Transitions that
 * point back to an earlier stage (a loop) are left out of the layering, or it
 * would never settle; they still draw.
 *
 * Row order within a column is each stage's original array order — simple,
 * deterministic, and the order an author builds stages in usually reads
 * sensibly top to bottom.
 */
export function computeStageLayout(
  stages: WorkflowStage[],
  transitions: WorkflowTransition[],
): StageLayoutPosition[] {
  const stageIds = stages.map((s) => s.id);
  const idSet = new Set(stageIds);
  const validTransitions = transitions.filter((t) => idSet.has(t.from) && idSet.has(t.to));

  const outgoingByFrom = new Map<string, WorkflowTransition[]>();
  validTransitions.forEach((t) => {
    const arr = outgoingByFrom.get(t.from) ?? [];
    arr.push(t);
    outgoingByFrom.set(t.from, arr);
  });

  const column = new Map<string, number>();
  if (stageIds.length > 0) {
    const start = stageIds[0];

    // Depth-first from the first stage to find the stages it reaches and the
    // back edges (into a stage still on the current path) that close loops.
    const visitState = new Map<string, 'visiting' | 'done'>();
    const backEdges = new Set<WorkflowTransition>();
    const visit = (id: string) => {
      visitState.set(id, 'visiting');
      for (const t of outgoingByFrom.get(id) ?? []) {
        const state = visitState.get(t.to);
        if (state === 'visiting') backEdges.add(t);
        else if (!state) visit(t.to);
      }
      visitState.set(id, 'done');
    };
    visit(start);

    // Longest path over the remaining (acyclic) edges, in topological order.
    const forward = validTransitions.filter(
      (t) => !backEdges.has(t) && visitState.has(t.from) && visitState.has(t.to),
    );
    const indegree = new Map<string, number>();
    forward.forEach((t) => indegree.set(t.to, (indegree.get(t.to) ?? 0) + 1));
    column.set(start, 0);
    const queue = [start];
    while (queue.length > 0) {
      const current = queue.shift()!;
      for (const t of forward.filter((f) => f.from === current)) {
        column.set(t.to, Math.max(column.get(t.to) ?? 0, column.get(current)! + 1));
        const remaining = (indegree.get(t.to) ?? 1) - 1;
        indegree.set(t.to, remaining);
        if (remaining === 0) queue.push(t.to);
      }
    }
  }

  // Anything unreachable from the first stage (an orphan, or one just added
  // with no transition yet) still needs a column so it renders somewhere,
  // rather than being silently dropped from the canvas.
  let maxColumn = Math.max(0, ...Array.from(column.values()));
  stageIds.forEach((id) => {
    if (!column.has(id)) {
      maxColumn += 1;
      column.set(id, maxColumn);
    }
  });

  const byColumn = new Map<number, string[]>();
  stageIds.forEach((id) => {
    const col = column.get(id)!;
    const group = byColumn.get(col) ?? [];
    group.push(id);
    byColumn.set(col, group);
  });

  const rowById = new Map<string, number>();
  byColumn.forEach((ids) => {
    const center = (ids.length - 1) / 2;
    ids.forEach((id, i) => rowById.set(id, i - center));
  });

  return stageIds.map((id) => ({ id, column: column.get(id)!, row: rowById.get(id)! }));
}
