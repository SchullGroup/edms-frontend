import type {
  WorkflowDefinitionJson,
  WorkflowStage,
  WorkflowTransition,
} from '@/types/models';

// The routing graph: what a definition means, how edits rewrite it, and what the
// backend's `definitions.validation.ts` would reject, so a save doesn't 422.

/** A definition with its lookups built once. Transitions to or from a stage
 *  that doesn't exist are left out, as the backend's graph checks leave them out. */
export interface WorkflowGraph {
  stages: WorkflowStage[];
  transitions: WorkflowTransition[];
  name: (id: string) => string;
  outgoing: (id: string) => WorkflowTransition[];
  incoming: (id: string) => WorkflowTransition[];
}

export function indexGraph({ stages, transitions }: WorkflowDefinitionJson): WorkflowGraph {
  const byId = new Map(stages.map((s) => [s.id, s]));
  const valid = transitions.filter((t) => byId.has(t.from) && byId.has(t.to));
  const out = new Map<string, WorkflowTransition[]>();
  const into = new Map<string, WorkflowTransition[]>();
  valid.forEach((t) => {
    out.set(t.from, [...(out.get(t.from) ?? []), t]);
    into.set(t.to, [...(into.get(t.to) ?? []), t]);
  });
  return {
    stages,
    transitions: valid,
    name: (id) => byId.get(id)?.name || id,
    outgoing: (id) => out.get(id) ?? [],
    incoming: (id) => into.get(id) ?? [],
  };
}

export interface StageTransitionIssue {
  stageId: string;
  message: string;
}

/** The backend's per-stage `validateWorkflowRouting` rules: one fallback once any
 *  branch is conditional, unique priorities, no two routes to the same stage. */
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

  // The backend refuses two routes between the same pair (`Duplicate transition`),
  // even when the designer shows them as separate cards.
  const targets = outgoing.map((t) => t.to);
  if (new Set(targets).size !== targets.length) {
    issues.push({ stageId, message: 'Two branches from this stage point to the same next stage — pick a different target for one of them.' });
  }

  return issues;
}

/** After a stage is added or deleted: keeps every authored route between stages
 *  that still exist, and links a stage left with none to the next stage. */
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

// --- Parallel routing (edms-backend PR #54) ----------------------------------
// A fork's branches, their routes on and the `join: 'all'` stage must change in ONE save.

/** Two or more outgoing transitions, none conditional: they all run at once. */
export const isParallelFork = (outgoing: WorkflowTransition[]) =>
  outgoing.length > 1 && outgoing.every((t) => !t.condition);

export type TransitionKind = 'conditional' | 'parallel' | 'fallback' | 'plain';

/** How a transition behaves among its stage's outgoing ones (`siblings`, itself
 *  included). */
export const transitionKind = (
  transition: WorkflowTransition,
  siblings: WorkflowTransition[],
): TransitionKind =>
  transition.condition
    ? 'conditional'
    : isParallelFork(siblings)
      ? 'parallel'
      : siblings.length > 1
        ? 'fallback'
        : 'plain';

/** Every stage reachable from `start`, `start` included: the backend's
 *  `getReachableStages`. */
export function reachableFrom(graph: WorkflowGraph, start: string): Set<string> {
  const seen = new Set<string>();
  const stack = [start];
  while (stack.length > 0) {
    const current = stack.pop()!;
    if (seen.has(current)) continue;
    seen.add(current);
    graph.outgoing(current).forEach((t) => stack.push(t.to));
  }
  return seen;
}

/** Stages, in `stages` order, that every branch of the fork at `forkId` reaches:
 *  where its branches meet again. */
export function branchMeetingStages(graph: WorkflowGraph, forkId: string): WorkflowStage[] {
  const reach = graph.outgoing(forkId).map((t) => reachableFrom(graph, t.to));
  return graph.stages.filter((s) => reach.every((r) => r.has(s.id)));
}

/** The join the backend will use for a fork: the first meeting stage marked
 *  `join: 'all'`. */
export function forkJoinStage(graph: WorkflowGraph, forkId: string): WorkflowStage | undefined {
  return branchMeetingStages(graph, forkId).find((s) => s.join === 'all');
}

/** Where a new fork's branches most likely meet: its current join, else the
 *  nearest stage every branch reaches that isn't itself a branch. */
export function suggestJoinStage(graph: WorkflowGraph, forkId: string): string | null {
  const starts = new Set(graph.outgoing(forkId).map((t) => t.to));
  const meeting = branchMeetingStages(graph, forkId).filter(
    (s) => s.id !== forkId && !starts.has(s.id),
  );
  if (meeting.length === 0) return null;
  const existing = meeting.find((s) => s.join === 'all');
  if (existing) return existing.id;
  const column = new Map(computeStageLayout(graph).map((l) => [l.id, l.column]));
  return [...meeting].sort((a, b) => (column.get(a.id) ?? 0) - (column.get(b.id) ?? 0))[0].id;
}

/** Sets `join: 'all'` on exactly the stages that are some fork's join (`chosen`
 *  overrides a fork's join; null = none). A stale flag is a 422. */
export function normalizeJoins(
  graph: WorkflowGraph,
  chosen: Map<string, string | null> = new Map(),
): WorkflowStage[] {
  const joins = new Set<string>();
  graph.stages.forEach((stage) => {
    if (!isParallelFork(graph.outgoing(stage.id))) return;
    const join = chosen.has(stage.id) ? chosen.get(stage.id) : forkJoinStage(graph, stage.id)?.id;
    if (join) joins.add(join);
  });
  return graph.stages.map((stage) => {
    if (joins.has(stage.id)) return stage.join === 'all' ? stage : { ...stage, join: 'all' };
    if (stage.join === undefined) return stage;
    const { join: _removed, ...rest } = stage;
    return rest;
  });
}

/** The definition after replacing one stage's outgoing routes. A fork with a join
 *  also drops branch-to-branch routes and sends a dead-end branch on to the join. */
export function applyStageRouting(
  definition: WorkflowDefinitionJson,
  stageId: string,
  outgoing: WorkflowTransition[],
  joinStageId: string | null,
): WorkflowDefinitionJson {
  let transitions = [...definition.transitions.filter((t) => t.from !== stageId), ...outgoing];
  const parallel = isParallelFork(outgoing);

  if (parallel && joinStageId) {
    const branches = new Set(outgoing.map((t) => t.to));
    transitions = transitions.filter((t) => !(branches.has(t.from) && branches.has(t.to)));
    branches.forEach((branch) => {
      if (branch !== joinStageId && !transitions.some((t) => t.from === branch)) {
        transitions.push({ from: branch, to: joinStageId });
      }
    });
  }

  const chosen = new Map<string, string | null>();
  if (parallel) chosen.set(stageId, joinStageId);
  const stages = normalizeJoins(indexGraph({ stages: definition.stages, transitions }), chosen);
  return { stages, transitions };
}

/** The backend's whole-graph checks (reachability, a way out, parallel routing),
 *  in its order with stages named. Per-stage rules: `validateStageTransitions`. */
export function validateParallelRouting(graph: WorkflowGraph): string[] {
  const { stages, name, outgoing, incoming } = graph;
  const issues: string[] = [];

  if (stages[0]) {
    const reachable = reachableFrom(graph, stages[0].id);
    stages
      .filter((s) => !reachable.has(s.id))
      .forEach((s) => issues.push(`Nothing routes to ${name(s.id)} any more — no document could reach it.`));

    // The backend's `getStagesThatCanReachTerminal`: walk back from the stages with
    // no route out; a reachable stage never reached is stuck in a loop.
    const finishing = new Set(stages.filter((s) => outgoing(s.id).length === 0).map((s) => s.id));
    const stack = [...finishing];
    while (stack.length > 0) {
      incoming(stack.pop()!).forEach(({ from }) => {
        if (finishing.has(from)) return;
        finishing.add(from);
        stack.push(from);
      });
    }
    stages
      .filter((s) => reachable.has(s.id) && !finishing.has(s.id))
      .forEach((s) =>
        issues.push(`${name(s.id)} can't reach a last stage — every route from it loops back.`),
      );
  }

  stages
    .filter((s) => s.join === 'all' && incoming(s.id).length < 2)
    .forEach((s) =>
      issues.push(`${name(s.id)} waits for parallel branches but fewer than two routes lead into it.`),
    );

  stages
    .filter((s) => isParallelFork(outgoing(s.id)))
    .forEach((fork) => {
      const meeting = branchMeetingStages(graph, fork.id);
      const join = meeting.find((s) => s.join === 'all');
      if (!join) {
        if (meeting.length > 0) {
          const starts = new Set(outgoing(fork.id).map((t) => t.to));
          const where = meeting.find((s) => !starts.has(s.id));
          issues.push(
            where
              ? `The parallel branches from ${name(fork.id)} meet again at ${name(where.id)}, which has to wait for all of them — choose it under "Branches meet at".`
              : `One parallel branch from ${name(fork.id)} leads into another — point each branch somewhere else first.`,
          );
        }
        return;
      }

      // Walk each branch up to the join, noting where one stops or splits again.
      const ended = new Set<string>();
      const nested = new Set<string>();
      outgoing(fork.id).forEach(({ to: start }) => {
        const seen = new Set<string>();
        const stack = [start];
        while (stack.length > 0) {
          const current = stack.pop()!;
          if (current === join.id || seen.has(current)) continue;
          seen.add(current);
          const next = outgoing(current);
          if (next.length === 0) ended.add(current);
          if (isParallelFork(next)) nested.add(current);
          next.forEach((t) => stack.push(t.to));
        }
      });
      ended.forEach((id) =>
        issues.push(
          `A branch from ${name(fork.id)} can end at ${name(id)} without reaching ${name(join.id)}.`,
        ),
      );
      nested.forEach((id) =>
        issues.push(
          `${name(id)} splits into parallel branches again before ${name(join.id)} — a branch can't split further.`,
        ),
      );
    });

  return issues;
}

/** Everything the backend checks on save. For edits outside the Transitions tab
 *  (add, delete, move), which can break a stage they never touched. */
export function validateDefinition(definition: WorkflowDefinitionJson): string[] {
  const graph = indexGraph(definition);
  const perStage = graph.stages.flatMap((s) =>
    validateStageTransitions(s.id, graph.outgoing(s.id)).map(
      (issue) => `${s.name} — ${issue.message}`,
    ),
  );
  return [...perStage, ...validateParallelRouting(graph)];
}

/** Which neighbour `moveStage` swaps a stage with. */
export type MoveDirection = 'earlier' | 'later';

/** Swaps a stage with its neighbour along a straight link (A → B → C → D becomes
 *  A → C → B → D), or says why it can't. A join flag stays with the position. */
export function moveStage(
  definition: WorkflowDefinitionJson,
  stageId: string,
  direction: MoveDirection,
):
  | { definition: WorkflowDefinitionJson }
  | { reason: string } {
  const { stages, transitions } = definition;
  const { name, incoming: into, outgoing: outOf } = indexGraph(definition);

  let earlier: string;
  let later: string;
  if (direction === 'earlier') {
    const incoming = into(stageId);
    if (stages[0]?.id === stageId) return { reason: 'This is already the first stage.' };
    if (incoming.length === 0) return { reason: 'Nothing routes to this stage yet.' };
    if (incoming.length > 1) {
      return { reason: 'Several routes lead into this stage, so there’s no single stage before it to swap with.' };
    }
    earlier = incoming[0].from;
    later = stageId;
    if (outOf(earlier).length > 1) {
      return { reason: `${name(earlier)} branches here, so it can’t swap with this stage.` };
    }
  } else {
    const outgoing = outOf(stageId);
    if (outgoing.length === 0) return { reason: 'This is the last stage — nothing comes after it.' };
    if (outgoing.length > 1) {
      return { reason: 'This stage branches, so there’s no single next stage to swap with.' };
    }
    earlier = stageId;
    later = outgoing[0].to;
    if (into(later).length > 1) {
      return { reason: `Several routes lead into ${name(later)}, so it can’t swap with this stage.` };
    }
  }
  if (outOf(later).some((t) => t.to === earlier)) {
    return { reason: `${name(earlier)} and ${name(later)} route back to each other.` };
  }

  const nextTransitions = transitions.map((t): WorkflowTransition => {
    if (t.from === earlier && t.to === later) return { from: later, to: earlier };
    if (t.to === earlier) return { ...t, to: later };
    if (t.from === later) return { ...t, from: earlier };
    return t;
  });

  const earlierIndex = stages.findIndex((s) => s.id === earlier);
  const laterIndex = stages.findIndex((s) => s.id === later);
  const earlierWaits = stages[earlierIndex].join === 'all';
  const swapped = stages.map((s, i) => {
    const stage = i === earlierIndex ? stages[laterIndex] : i === laterIndex ? stages[earlierIndex] : s;
    if (!earlierWaits) return stage;
    if (stage.id === later) return { ...stage, join: 'all' as const };
    if (stage.id === earlier) {
      const { join: _moved, ...rest } = stage;
      return rest;
    }
    return stage;
  });

  const nextStages = normalizeJoins(indexGraph({ stages: swapped, transitions: nextTransitions }));
  const next = { stages: nextStages, transitions: nextTransitions };
  const problem = validateDefinition(next)[0];
  return problem ? { reason: problem } : { definition: next };
}

export interface StageLayoutPosition {
  id: string;
  /** Hops from the first stage along the routing graph. */
  column: number;
  /** Position among same-column siblings, centered on 0. */
  row: number;
}

/** Canvas layout: column = longest path from the first stage (so every stage sits
 *  right of what leads into it), row = order within the column. Loops are skipped. */
export function computeStageLayout(graph: WorkflowGraph): StageLayoutPosition[] {
  const stageIds = graph.stages.map((s) => s.id);

  const column = new Map<string, number>();
  if (stageIds.length > 0) {
    const start = stageIds[0];

    // Depth-first from the first stage: the stages it reaches, and the back edges
    // (into a stage still on the current path) that close loops.
    const visitState = new Map<string, 'visiting' | 'done'>();
    const backEdges = new Set<WorkflowTransition>();
    const visit = (id: string) => {
      visitState.set(id, 'visiting');
      for (const t of graph.outgoing(id)) {
        const state = visitState.get(t.to);
        if (state === 'visiting') backEdges.add(t);
        else if (!state) visit(t.to);
      }
      visitState.set(id, 'done');
    };
    visit(start);

    // Longest path over the remaining (acyclic) edges, in topological order.
    const isForward = (t: WorkflowTransition) =>
      !backEdges.has(t) && visitState.has(t.from) && visitState.has(t.to);
    const indegree = new Map<string, number>();
    graph.transitions.filter(isForward).forEach((t) => indegree.set(t.to, (indegree.get(t.to) ?? 0) + 1));
    column.set(start, 0);
    const queue = [start];
    while (queue.length > 0) {
      const current = queue.shift()!;
      for (const t of graph.outgoing(current).filter(isForward)) {
        column.set(t.to, Math.max(column.get(t.to) ?? 0, column.get(current)! + 1));
        const remaining = (indegree.get(t.to) ?? 1) - 1;
        indegree.set(t.to, remaining);
        if (remaining === 0) queue.push(t.to);
      }
    }
  }

  // A stage the first can't reach (an orphan, or one just added) still gets a
  // column, so it renders.
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
