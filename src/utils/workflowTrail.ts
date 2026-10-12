import type { WorkflowHistoryRecord } from '@/types/models';

/**
 * One entry in the workflow trail: a single thing someone did.
 *
 * Since multi-document workflows (edms-backend `919d0ef`), the history records
 * one row per document an action covered, plus one summary row for the action
 * itself. Approving three documents writes four rows with the same action,
 * stages, actor, time and comment; starting a workflow writes a
 * `workflow_started` row and a `document_started` row per document. Shown
 * as-is, the trail repeats itself, so rows are merged back into the action.
 */
export interface TrailEntry {
  /** The summary row when there is one, otherwise the first document row. */
  record: WorkflowHistoryRecord;
  action: string;
  /** Titles of the documents the action covered, in the order they appear. */
  documents: string[];
  comment?: string | null;
  signature?: string | null;
}

const isStart = (action: string) => action === 'workflow_started' || action === 'document_started';

function entryKey(r: WorkflowHistoryRecord): string {
  // Times are compared to the second: the rows of one action share a timestamp.
  const at = r.occurredAt.slice(0, 19);
  if (isStart(r.action)) return ['start', r.actorId ?? '', at].join('|');
  return [r.action, r.taskId ?? '', r.fromStage ?? '', r.toStage ?? '', r.actorId ?? '', at].join(
    '|',
  );
}

/** Merges the per-document rows of each action, keeping the records' order. */
export function groupWorkflowHistory(records: WorkflowHistoryRecord[]): TrailEntry[] {
  const groups = new Map<string, WorkflowHistoryRecord[]>();
  for (const r of records) {
    const key = entryKey(r);
    const list = groups.get(key);
    if (list) list.push(r);
    else groups.set(key, [r]);
  }

  return [...groups.values()].map((rows) => {
    const summary =
      rows.find((r) => r.action === 'workflow_started') ??
      rows.find((r) => !r.workflowInstanceDocumentId) ??
      rows[0];
    const documents = [
      ...new Set(
        rows
          .map((r) => r.workflowInstanceDocument?.document?.title)
          .filter((t): t is string => !!t),
      ),
    ];
    const withComment = rows.find((r) => r.comment || r.note);
    const signed = rows.find((r) => typeof r.task?.signature === 'string');
    return {
      record: summary,
      action: summary.action,
      documents,
      comment: withComment ? withComment.comment || withComment.note : null,
      signature: signed ? (signed.task!.signature as string) : null,
    };
  });
}

/** How many different documents appear anywhere in the trail. */
export function trailDocumentCount(records: WorkflowHistoryRecord[]): number {
  return new Set(records.map((r) => r.workflowInstanceDocumentId).filter(Boolean)).size;
}
