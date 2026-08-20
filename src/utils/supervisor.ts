import { Task, User } from '@/types/models';

/**
 * Helpers for the supervisor dashboards.
 *
 * These deliberately live apart from `utils/helpers.ts`. That module's
 * `effStatus` compares against title-case document statuses ('Closed',
 * 'Pending') from the old seed data, while the API returns snake_case
 * ('closed', 'in_progress'). Rather than change a helper the rest of the app
 * still depends on, the supervisor pages work off tasks — which is where
 * assignment, due dates and stage actually live in the backend model.
 */

/** A task the assignee still has to act on. */
export const ACTIVE_TASK_STATUSES = ['pending', 'escalated'] as const;

export function isActiveTask(task: Task): boolean {
  return (ACTIVE_TASK_STATUSES as readonly string[]).includes(task.status);
}

export function isOverdue(task: Task, now: number = Date.now()): boolean {
  return isActiveTask(task) && !!task.dueAt && Date.parse(task.dueAt) < now;
}

/** The badge vocabulary `StatusBadge` expects, derived from task state. */
export function taskStatusLabel(task: Task, now: number = Date.now()): string {
  if (task.status === 'completed') return 'Closed';
  if (isOverdue(task, now)) return 'Overdue';
  if (task.status === 'escalated') return 'Overdue';
  if (task.workflowInstance?.status === 'on_hold') return 'On Hold';
  // A stage that has already been handed on at least once is work in flight.
  return task.workflowInstance?.status === 'in_progress' ? 'In Progress' : 'Pending';
}

/** Backend urgency is lowercase; `UrgBadge` keys off title case. */
export function urgencyLabel(urgency?: string | null): string {
  if (!urgency) return 'Normal';
  return urgency.charAt(0).toUpperCase() + urgency.slice(1);
}

const URGENCY_RANK: Record<string, number> = { critical: 0, high: 1, normal: 2, low: 3 };

export function urgencyRank(urgency?: string | null): number {
  return URGENCY_RANK[(urgency ?? 'normal').toLowerCase()] ?? 2;
}

/** Whole days a task has been sitting at its current stage. */
export function ageDays(task: Task, now: number = Date.now()): number {
  if (!task.createdAt) return 0;
  return Math.max(0, Math.floor((now - Date.parse(task.createdAt)) / 86400000));
}

/** Wall-clock days between a task being raised and completed. */
export function turnaroundDays(task: Task): number | null {
  if (!task.completedAt || !task.createdAt) return null;
  return Math.max(0, (Date.parse(task.completedAt) - Date.parse(task.createdAt)) / 86400000);
}

/** True when a completed task landed on or before its SLA deadline. Tasks with
 *  no `dueAt` have no SLA to meet and are excluded by returning null. */
export function metSla(task: Task): boolean | null {
  if (task.status !== 'completed' || !task.completedAt || !task.dueAt) return null;
  return Date.parse(task.completedAt) <= Date.parse(task.dueAt);
}

export function roleNames(user?: Partial<User> | null): string[] {
  if (!user) return [];
  if (user.userRoles?.length) return user.userRoles.map((ur) => ur.role.name);
  if (user.roles?.length) return user.roles.map((r) => r.name);
  return [];
}

export function primaryRoleLabel(user?: Partial<User> | null): string {
  const [name] = roleNames(user);
  if (!name) return 'Staff';
  return name.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}

/** Stage ids come from the workflow definition JSON ('supervisor_review'); render
 *  them in prose. */
export function stageLabel(stage?: string | null): string {
  if (!stage) return '—';
  return stage.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}

/** Sort key matching the backend's own ordering: urgency, then due date. */
export function byUrgencyThenDue(a: Task, b: Task): number {
  const rank = urgencyRank(a.workflowInstance?.document?.urgency) -
    urgencyRank(b.workflowInstance?.document?.urgency);
  if (rank !== 0) return rank;

  const aDue = a.dueAt ? Date.parse(a.dueAt) : Number.MAX_SAFE_INTEGER;
  const bDue = b.dueAt ? Date.parse(b.dueAt) : Number.MAX_SAFE_INTEGER;
  return aDue - bDue;
}

/** Groups tasks by the user they are assigned to. Role-pool tasks (no
 *  `assigneeId`) are collected under the `unassigned` key. */
export function groupByAssignee(tasks: Task[]): Map<string, Task[]> {
  const grouped = new Map<string, Task[]>();

  for (const task of tasks) {
    const key = task.assigneeId ?? 'unassigned';
    const bucket = grouped.get(key);
    if (bucket) bucket.push(task);
    else grouped.set(key, [task]);
  }

  return grouped;
}

export function withinLastDays(iso: string | null | undefined, days: number, now = Date.now()) {
  if (!iso) return false;
  return now - Date.parse(iso) <= days * 86400000;
}

/** ISO week label ('W28') for the week containing `ts`. Used by the performance
 *  trend chart so buckets line up with how the business reports. */
export function isoWeekLabel(ts: number): string {
  const date = new Date(ts);
  const target = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const dayNumber = (target.getUTCDay() + 6) % 7; // Monday = 0
  target.setUTCDate(target.getUTCDate() - dayNumber + 3); // nearest Thursday
  const firstThursday = new Date(Date.UTC(target.getUTCFullYear(), 0, 4));
  const firstDayNumber = (firstThursday.getUTCDay() + 6) % 7;
  firstThursday.setUTCDate(firstThursday.getUTCDate() - firstDayNumber + 3);
  const week = 1 + Math.round((target.getTime() - firstThursday.getTime()) / (7 * 86400000));
  return `W${week}`;
}
