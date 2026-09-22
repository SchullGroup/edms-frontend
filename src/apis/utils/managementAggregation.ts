import { Department } from '@/types/models';

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

/**
 * Lays already-aggregated `{key: "YYYY-MM", count}` buckets from
 * `GET /documents/stats` / `GET /workflow-instances/stats` onto a fixed
 * N-month axis, filling any month the server omitted with 0. This is the
 * replacement for the old `bucketByMonth` — that one walked every raw
 * document/instance client-side (see DRIFT-07); this one only reshapes
 * numbers the server already grouped.
 */
export function alignMonthlyBuckets(
  buckets: { key: string; count: number }[],
  monthsBack: number,
  from: Date = new Date(),
): { labels: string[]; values: number[] } {
  const months = lastNMonths(monthsBack, from);
  const byKey = new Map(buckets.map((b) => [b.key, b.count]));
  return {
    labels: months.map((m) => m.label),
    values: months.map((m) => byKey.get(m.key) ?? 0),
  };
}
