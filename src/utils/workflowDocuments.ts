import type {
  Task,
  WorkflowDocumentExecution,
  WorkflowExecutionStatus,
  WorkflowHistoryRecord,
  WorkflowInstance,
} from '@/types/models';

/*
 * Multi-document workflows (edms-backend `919d0ef`): a workflow carries several
 * documents, each moving through the stages on its own "execution" with its own
 * deadline. Neither a workflow nor a task has a single stage or due date any
 * more, so every page asks these helpers instead of reading fields directly.
 *
 * Deadlines are only in some responses today: `GET /tasks/:id` and workflow
 * history carry them; `GET /tasks` and `GET /workflow-instances` don't yet
 * (requested from the backend). Every deadline helper returns null when the
 * data isn't there, so pages show "—" rather than a wrong answer, and fill in
 * on their own once those list responses include it.
 */

const ACTIVE_EXECUTION_STATUSES: readonly WorkflowExecutionStatus[] = [
  'pending',
  'in_progress',
  'on_hold',
  'waiting',
];

/** A document still moving through the workflow. An execution whose status
 *  wasn't returned counts as active — the list responses that omit it only
 *  ever embed a task's current documents. */
export function isActiveExecution(execution?: Partial<WorkflowDocumentExecution> | null): boolean {
  if (!execution) return false;
  return !execution.status || ACTIVE_EXECUTION_STATUSES.includes(execution.status);
}

function earliest(isoDates: (string | null | undefined)[]): string | null {
  let best: string | null = null;
  for (const iso of isoDates) {
    if (iso && (best === null || Date.parse(iso) < Date.parse(best))) best = iso;
  }
  return best;
}

/** "Invoice 0912", "Invoice 0912 + 2 more", or '' for none. */
export function documentsLabel(titles: string[]): string {
  if (titles.length === 0) return '';
  if (titles.length === 1) return titles[0];
  return `${titles[0]} + ${titles.length - 1} more`;
}

// --- Tasks -------------------------------------------------------------------

/** The documents a task covers, as plain summaries, in the order the task holds them. */
export function taskDocuments(task: Pick<Task, 'documents'>) {
  return (task.documents ?? []).map(
    (d) => d.workflowDocumentExecution.workflowInstanceDocument.document,
  );
}

/** The first document a task covers — for a link or an urgency badge. */
export function taskPrimaryDocument(task: Pick<Task, 'documents'>) {
  return taskDocuments(task)[0];
}

/** What to call a task in a list: its document title(s). */
export function taskTitle(task: Pick<Task, 'documents'>): string {
  return documentsLabel(taskDocuments(task).map((d) => d.title)) || 'Untitled task';
}

/** The most urgent of a task's documents' urgencies. */
export function taskUrgency(task: Pick<Task, 'documents'>): string | undefined {
  const rank: Record<string, number> = { critical: 0, high: 1, normal: 2, low: 3 };
  return taskDocuments(task)
    .map((d) => d.urgency)
    .sort((a, b) => (rank[a?.toLowerCase()] ?? 2) - (rank[b?.toLowerCase()] ?? 2))[0];
}

/** A task's deadline: the earliest `stageDueAt` among its documents still in
 *  progress. Null when unknown — `GET /tasks` doesn't return deadlines yet. */
export function taskDueAt(task: Pick<Task, 'documents'>): string | null {
  return earliest(
    (task.documents ?? [])
      .map((d) => d.workflowDocumentExecution)
      .filter(isActiveExecution)
      .map((e) => e.stageDueAt),
  );
}

/** How many of a task's documents are past their deadline. */
export function overdueDocumentCount(task: Pick<Task, 'documents'>, now = Date.now()): number {
  return (task.documents ?? [])
    .map((d) => d.workflowDocumentExecution)
    .filter((e) => isActiveExecution(e) && !!e.stageDueAt && Date.parse(e.stageDueAt) < now).length;
}

// --- Workflows ---------------------------------------------------------------

/** What to call a workflow in a list: its document title(s). */
export function instanceTitle(instance: Pick<WorkflowInstance, 'documents'>): string {
  return (
    documentsLabel((instance.documents ?? []).map((d) => d.document?.title).filter(Boolean)) ||
    'Untitled workflow'
  );
}

/** Every document execution still moving — empty until the list response
 *  includes executions (requested from the backend). */
export function instanceActiveExecutions(instance: Pick<WorkflowInstance, 'documents'>) {
  return (instance.documents ?? []).flatMap((d) => (d.executions ?? []).filter(isActiveExecution));
}

/** The workflow's nearest deadline across its documents, or null when unknown. */
export function instanceDueAt(instance: Pick<WorkflowInstance, 'documents'>): string | null {
  return earliest(instanceActiveExecutions(instance).map((e) => e.stageDueAt));
}

/** The distinct stages its documents currently sit at. */
export function instanceStages(instance: Pick<WorkflowInstance, 'documents'>): string[] {
  return [...new Set(instanceActiveExecutions(instance).map((e) => e.currentStage))];
}

/**
 * Each document's live position, rebuilt from workflow history: every event
 * about a document embeds that document's execution as it stands NOW, so the
 * newest event per execution gives its current stage, status and deadline.
 * Keyed by workflow-instance-document id; a document split into parallel
 * branches has one entry per branch.
 */
export function executionsByDocumentFromHistory(
  history: WorkflowHistoryRecord[],
): Map<string, WorkflowDocumentExecution[]> {
  const latestByExecution = new Map<string, { at: number; execution: WorkflowDocumentExecution }>();
  for (const event of history) {
    const execution = event.workflowDocumentExecution;
    if (!execution?.id) continue;
    const at = Date.parse(event.occurredAt);
    const seen = latestByExecution.get(execution.id);
    if (!seen || at > seen.at) latestByExecution.set(execution.id, { at, execution });
  }

  const byDocument = new Map<string, WorkflowDocumentExecution[]>();
  for (const { execution } of latestByExecution.values()) {
    const key = execution.workflowInstanceDocumentId;
    if (!key) continue;
    byDocument.set(key, [...(byDocument.get(key) ?? []), execution]);
  }
  return byDocument;
}
