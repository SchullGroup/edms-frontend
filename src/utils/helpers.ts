/**
 * Title-cases a `Document`'s real backend status for `StatusBadge`. There is
 * no `Overdue` here on purpose — `Document` carries no due date anywhere in
 * the backend schema (that lives on `Task.dueAt` / `WorkflowInstance.
 * stageDueAt`), so a document-level "Overdue" would be a fabricated signal.
 * Use `taskStatusLabel` (`@/utils/supervisor`) for task rows, which does have
 * a real due date to check.
 */
const DOCUMENT_STATUS_LABEL: Record<string, string> = {
  pending: 'Pending',
  in_progress: 'In Progress',
  on_hold: 'On Hold',
  closed: 'Closed',
};

export function documentStatusLabel(doc: { status: string }): string {
  return DOCUMENT_STATUS_LABEL[doc.status] ?? doc.status;
}

/**
 * `'in_progress'` (real backend enum) and `'In Progress'` (SEED fixture
 * casing) both need to compare/display the same way. Handles snake_case →
 * words and lowercase → Title Case in one pass, and is idempotent on input
 * that's already correctly cased — safe to apply universally rather than
 * only where the source is known to be the API. Used by the badge
 * components (`Badges.tsx`) for display, and should be used for any
 * enum-value *comparison* too — a naive `charAt(0).toUpperCase() + slice(1)`
 * mishandles multi-word values (`'top_secret'` → `"Top_secret"`, which
 * matches nothing a Title-Case-keyed filter list expects).
 */
export function titleCase(s: string): string {
  return s
    .replace(/_/g, ' ')
    .split(' ')
    .filter(Boolean)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
    .join(' ');
}

export function dueLabel(ts: string | number | null | undefined) {
  if (!ts) return { text: 'No due date', late: false };
  const ms = typeof ts === 'string' ? Date.parse(ts) : ts;
  const d = Math.round((ms - Date.now()) / 86400000);
  if (d < 0) return { text: `${Math.abs(d)}d overdue`, late: true };
  if (d === 0) return { text: 'Due today', late: false };
  return { text: `Due in ${d}d`, late: false };
}

export function timeAgo(ts: number) {
  const s = Math.floor((Date.now() - ts) / 1000);
  if (s < 60) return 'just now';
  if (s < 3600) return Math.floor(s / 60) + 'm ago';
  if (s < 86400) return Math.floor(s / 3600) + 'h ago';
  return Math.floor(s / 86400) + 'd ago';
}

export const fmtDateTime = (timestamp: number | string | Date) => {
  return new Date(timestamp).toLocaleString();
};

export function fmtDate(ts: number | string | null | undefined) {
  if (!ts) return '—';
  return new Date(ts).toLocaleDateString('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}

