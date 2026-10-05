import type {
  WorkflowCondition,
  WorkflowConditionField,
  WorkflowConditionOperator,
  WorkflowConditionRule,
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

/** Comparison operators are metadata-only — the backend rejects them on
 *  `urgency`/`confidentiality` rules. */
export function operatorsForField(field: WorkflowConditionField) {
  const base: WorkflowConditionOperator[] = ['equals', 'not_equals', 'in', 'not_in'];
  const values = field === 'metadata' ? [...base, ...COMPARISON_OPERATORS] : base;
  return values.map((value) => ({ value, label: OPERATOR_LABELS[value] }));
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
 *  e.g. "urgency = critical" or "2 rules (any)". Not sent to the backend. */
export function describeCondition(condition: WorkflowCondition | undefined): string {
  if (!condition) return 'Fallback';
  if (condition.rules.length === 1) {
    const rule = condition.rules[0];
    const label = OPERATOR_LABELS[rule.operator];
    const value = Array.isArray(rule.value) ? rule.value.join(', ') : String(rule.value);
    const fieldLabel = rule.field === 'metadata' ? 'metadata' : rule.field;
    return `${fieldLabel} ${rule.operator === 'equals' ? '=' : label} ${value}`;
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
 * A simple layered graph layout for the canvas: column = *shortest*-path
 * distance from the first stage (breadth-first, not longest-path — see
 * below), row = position among stages that share a column, centered around
 * 0. This is what stops a branch's connector line from being drawn across
 * an unrelated stage card — the previous flat layout placed every stage in
 * one row at its array index, so a transition skipping over a stage (a
 * branch and its required fallback rarely land on adjacent array entries)
 * had no way to avoid visually crossing whatever sat between them.
 *
 * Shortest-path, not longest-path: a stage that's directly branched to from
 * an earlier one, but *also* reachable the "long way" through another stage
 * (the common shape here — appending a new stage always auto-chains it
 * after the previous last stage, so a fresh conditional branch aimed at it
 * is nearly always also reachable the long way around), needs to land right
 * next to its direct sibling for the fork to actually read as a fork.
 * Longest-path layering (the usual default for drawing a DAG) would instead
 * push it out to the column dictated by the longer path, landing it after
 * everything else — which is what "the canvas still looks linear" was: a
 * real branch existed, but nothing about the layout showed it as one.
 *
 * Row order within a column is each stage's original array order, not
 * transition priority — simpler and deterministic, and in practice the
 * order a workflow author builds stages in already reads sensibly
 * top-to-bottom. The trade-off shortest-path introduces: an edge whose
 * target lands in the same column as its source (or earlier) — the
 * "long way around" edge in the scenario above — draws as a small
 * loop-back curve rather than a clean left-to-right line. That's an
 * artifact of an auto-generated default edge, not a hand-authored one; it's
 * usually worth revisiting that stage's own transitions once a branch is
 * added past it.
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
    // Breadth-first: each stage gets the column of the *first* time it's
    // reached, which — processing level by level — is necessarily its
    // shortest path from the first stage.
    const start = stageIds[0];
    column.set(start, 0);
    const queue = [start];
    while (queue.length > 0) {
      const current = queue.shift()!;
      const currentColumn = column.get(current)!;
      for (const t of outgoingByFrom.get(current) ?? []) {
        if (!column.has(t.to)) {
          column.set(t.to, currentColumn + 1);
          queue.push(t.to);
        }
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
