'use client';

import React from 'react';
import { UserPicker } from '@/components/common/UserPicker';
import { useMyDepartmentId } from '@/hooks/useMyDepartmentId';

/**
 * Searches active people in the caller's own department, the only valid reassign
 * targets (the backend 403s `TASK_REASSIGN_DEPARTMENT_FORBIDDEN` otherwise).
 */
export function ReassignAssigneePicker({
  excludeId,
  onPick,
}: {
  excludeId?: string | null;
  onPick: (user: { id: string; name: string } | null) => void;
}) {
  const { departmentId, known } = useMyDepartmentId();

  if (!departmentId) {
    return known ? (
      <div className="help">You aren’t in a department, so there’s no one to reassign to.</div>
    ) : (
      <input className="input" disabled placeholder="Loading…" aria-label="New assignee" />
    );
  }

  return (
    <UserPicker
      onChange={(_, user) => onPick(user ?? null)}
      filters={{ status: 'active', departmentId }}
      excludeIds={excludeId ? [excludeId] : undefined}
      placeholder="Select user…"
      ariaLabel="New assignee"
    />
  );
}
