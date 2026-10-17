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
 * Deadlines: `GET /tasks/:id` and workflow history always carried them;
 * `GET /tasks`, `GET /tasks/approvals` and `GET /workflow-instances` have since
 * edms-backend PR #50 (per-document `currentStage`, `status`, `stageDueAt`).
 * Every deadline helper still returns null when the data isn't there, so a
 * page shows "—" rather than a wrong answer.
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

const ACTIVE_TASK_STATUSES: readonly string[] = ['pending', 'escalated'];

type TaskDocumentRow = NonNullable<Task['documents']>[number];

/**
 * Whether a document on an open task was already actioned there (edms-backend
 * PR #52: a partial action keeps the task open, and `GET /tasks/:id` still
 * lists the actioned rows). `actionedAt` says so for every document the viewer
 * can see; a Restricted one omits it, so it counts as actioned while its
 * execution is away from this task's stage. A document sent back by "Request
 * changes" can return to the same open task: the backend reuses the task and
 * clears `actionedAt` (edms-backend PR #54), so it counts as pending again.
 * A closed task's documents are never "actioned" here: its history is whole.
 */
export function isActionedTaskDocument(
  doc: TaskDocumentRow,
  task: Partial<Pick<Task, 'status' | 'stage'>>,
): boolean {
  if (!task.status || !ACTIVE_TASK_STATUSES.includes(task.status)) return false;
  if (doc.actionedAt !== undefined) return doc.actionedAt !== null;
  const execution = doc.workflowDocumentExecution;
  if (!execution.currentStage && !execution.status) return false;
  return !isActiveExecution(execution) || execution.currentStage !== task.stage;
}

/** An open task's documents still waiting on it: every document of a closed task. */
export function pendingTaskDocuments(
  task: Pick<Task, 'documents'> & Partial<Pick<Task, 'status' | 'stage'>>,
) {
  return (task.documents ?? []).filter((d) => !isActionedTaskDocument(d, task));
}

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
  // A Restricted document's urgency is withheld (null), so it can't rank.
  return taskDocuments(task)
    .map((d) => d.urgency)
    .filter((u): u is string => !!u)
    .sort((a, b) => (rank[a.toLowerCase()] ?? 2) - (rank[b.toLowerCase()] ?? 2))[0];
}

/** A task's deadline: the earliest `stageDueAt` among its documents still in
 *  progress and not yet actioned on it. Null when none has one. */
export function taskDueAt(
  task: Pick<Task, 'documents'> & Partial<Pick<Task, 'status' | 'stage'>>,
): string | null {
  return earliest(
    pendingTaskDocuments(task)
      .map((d) => d.workflowDocumentExecution)
      .filter(isActiveExecution)
      .map((e) => e.stageDueAt),
  );
}

/** How many of a task's documents are past their deadline. */
export function overdueDocumentCount(
  task: Pick<Task, 'documents'> & Partial<Pick<Task, 'status' | 'stage'>>,
  now = Date.now(),
): number {
  return pendingTaskDocuments(task)
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

/** Every document execution still moving (`GET /workflow-instances` lists
 *  them per document since edms-backend PR #50). */
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
