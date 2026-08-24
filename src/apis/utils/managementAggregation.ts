import { Cabinet, Department, Document, Task } from '@/types/models';

/** Flattens the department tree (GET /departments returns top-level nodes with nested children). */
export function buildDepartmentIndex(departments: Department[]): Map<string, Department> {
  const index = new Map<string, Department>();
  const add = (dept: Department) => {
    index.set(dept.id, dept);
    dept.children?.forEach(add);
  };
  departments.forEach(add);
  return index;
}

export function departmentName(
  departmentId: string | null | undefined,
  index: Map<string, Department>,
): string {
  if (!departmentId) return 'Unassigned';
  return index.get(departmentId)?.name ?? `Dept #${departmentId.slice(0, 8)}`;
}

/** cabinetId -> departmentId. Cabinet already embeds `department`, so this works even without a separate /departments fetch. */
export function buildCabinetDepartmentIndex(cabinets: Cabinet[]): Map<string, string | null> {
  const index = new Map<string, string | null>();
  cabinets.forEach((c) => index.set(c.id, c.departmentId ?? c.department?.id ?? null));
  return index;
}

export function documentDepartmentId(
  doc: Document,
  cabinetIndex: Map<string, string | null>,
): string | null {
  return cabinetIndex.get(doc.cabinetId) ?? null;
}

/**
 * A task's department is one hop through its workflow instance's document -> cabinet.
 * This embed shape is observed from a real /tasks response, not guaranteed by the
 * (loosely-typed) Swagger schema, so every step here is optional-chained on purpose.
 */
export function taskDepartmentId(
  task: Task,
  cabinetIndex: Map<string, string | null>,
): string | null {
  const cabinetId = task.workflowInstance?.document?.cabinetId;
  if (!cabinetId) return null;
  return cabinetIndex.get(cabinetId) ?? null;
}

export interface MonthBucket {
  key: string;
  label: string;
  start: Date;
  end: Date;
}

export function lastNMonths(n: number, from: Date = new Date()): MonthBucket[] {
  const months: MonthBucket[] = [];
  for (let i = n - 1; i >= 0; i--) {
    const start = new Date(from.getFullYear(), from.getMonth() - i, 1);
    const end = new Date(from.getFullYear(), from.getMonth() - i + 1, 1);
    months.push({
      key: `${start.getFullYear()}-${String(start.getMonth() + 1).padStart(2, '0')}`,
      label: start.toLocaleDateString('en-GB', { month: 'short' }),
      start,
      end,
    });
  }
  return months;
}

export function bucketByMonth<T>(
  items: T[],
  getDate: (item: T) => string | null | undefined,
  monthsBack: number,
  from: Date = new Date(),
): { labels: string[]; values: number[] } {
  const buckets = lastNMonths(monthsBack, from);
  const values = buckets.map(() => 0);
  for (const item of items) {
    const raw = getDate(item);
    if (!raw) continue;
    const d = new Date(raw);
    if (Number.isNaN(d.getTime())) continue;
    const idx = buckets.findIndex((b) => d >= b.start && d < b.end);
    if (idx >= 0) values[idx] += 1;
  }
  return { labels: buckets.map((b) => b.label), values };
}

/** % of tasks completed on/before their due date; open tasks not yet past due also count as on-time. */
export function taskSlaRate(tasks: Task[]): number {
  const relevant = tasks.filter((t) => t.dueAt);
  if (relevant.length === 0) return 100;
  const onTime = relevant.filter((t) => {
    if (t.completedAt) return new Date(t.completedAt) <= new Date(t.dueAt as string);
    return new Date(t.dueAt as string) >= new Date();
  });
  return Math.round((onTime.length / relevant.length) * 100);
}

export function groupCountBy<T>(
  items: T[],
  getKey: (item: T) => string | null,
): Map<string, number> {
  const map = new Map<string, number>();
  for (const item of items) {
    const key = getKey(item) ?? 'unassigned';
    map.set(key, (map.get(key) ?? 0) + 1);
  }
  return map;
}
