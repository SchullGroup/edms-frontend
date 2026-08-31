export function effStatus(doc: any) {
  if (doc.status === 'Closed') return 'Closed';
  if (doc.status === 'On Hold') return 'On Hold';
  if (doc.dueDate && Date.now() > Date.parse(doc.dueDate)) return 'Overdue';
  return doc.status; // Pending, In Progress
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

export function currentStage(doc: any) {
  return doc.workflow?.find((s: any) => s.state === 'current');
}
