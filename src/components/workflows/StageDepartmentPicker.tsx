'use client';

import type { Department } from '@/types/models';

export interface StageDepartmentPickerProps {
  /** `GET /departments` as returned: top-level departments, each with its
   *  sub-departments under `children` (one level, edms-backend PR #51). */
  departments: Department[];
  departmentId: string;
  subDepartmentId: string;
  onChange: (departmentId: string, subDepartmentId: string) => void;
  /** Offers "Any department" (value ''), for a role stage. */
  allowAny?: boolean;
}

/**
 * A stage's department: a top-level department, then optionally one of its
 * sub-departments. Picking the parent first keeps sub-departments that share a
 * name ("Admin" under Finance and under HR) apart.
 */
export function StageDepartmentPicker({
  departments,
  departmentId,
  subDepartmentId,
  onChange,
  allowAny = false,
}: StageDepartmentPickerProps) {
  const parent = departments.find((d) => d.id === departmentId);
  const children = parent?.children ?? [];

  return (
    <div className="flex flex-col gap-2">
      <select
        className="input"
        aria-label="Department"
        value={departmentId}
        onChange={(e) => onChange(e.target.value, '')}
      >
        {allowAny && <option value="">Any department</option>}
        {departments.map((d) => (
          <option key={d.id} value={d.id}>
            {d.name}
          </option>
        ))}
      </select>
      {parent && children.length > 0 && (
        <select
          className="input"
          aria-label={`Sub-department of ${parent.name}`}
          value={subDepartmentId}
          onChange={(e) => onChange(departmentId, e.target.value)}
        >
          <option value="">No sub-department: {parent.name} itself</option>
          {children.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
      )}
    </div>
  );
}
