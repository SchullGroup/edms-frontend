'use client';

import React, { useMemo } from 'react';
import { Combobox } from '@/components/ui/Combobox';
import { Icon } from '@/components/ui/Icons';
import { useDepartments } from '@/apis/hooks/useDepartments';
import { useRoles } from '@/apis/hooks/useRoles';
import { useAllUsers } from '@/apis/hooks/useUsers';
import { usePermissions } from '@/hooks/usePermissions';
import type { CircularAudience, CircularAudienceGroup } from '@/types/models';
import { flattenDepartments } from './circularLabels';

interface AudienceEditorProps {
  value: CircularAudience;
  onChange: (value: CircularAudience) => void;
}

/**
 * Builds a circular's audience: all staff, department/role groups, and named
 * people. Recipients are the union of everything selected.
 *
 * The role picker needs `role:view` (`GET /roles`), which supervisors and
 * management don't hold. Without it, groups are department-only. A draft's
 * audience is only checked for reach when it is published, against the
 * publisher's `circular:publish` scope.
 */
export function AudienceEditor({ value, onChange }: AudienceEditorProps) {
  const { hasPermission, scopeFor } = usePermissions();
  const canListRoles = hasPermission('role', 'view');
  const publishScope = scopeFor('circular', 'publish');

  const { data: departmentsData } = useDepartments();
  const { data: roles = [] } = useRoles({ enabled: canListRoles });
  const { data: usersData } = useAllUsers({ status: 'active' });

  const departments = useMemo(
    () => flattenDepartments(departmentsData?.data ?? []),
    [departmentsData],
  );
  const userOptions = useMemo(
    () => (usersData?.items ?? []).map((u) => ({ value: u.id, label: u.name, hint: u.email })),
    [usersData],
  );

  const setGroups = (groups: CircularAudienceGroup[]) => onChange({ ...value, groups });
  const updateGroup = (i: number, patch: Partial<CircularAudienceGroup>) =>
    setGroups(value.groups.map((g, j) => (j === i ? { ...g, ...patch } : g)));

  return (
    <div>
      <label className="check mb-2">
        <input
          type="checkbox"
          checked={value.allStaff}
          onChange={(e) => onChange({ ...value, allStaff: e.target.checked })}
        />
        <span>
          <b>All staff</b> — every active user in the organisation
        </span>
      </label>
      {value.allStaff && publishScope !== 'global' && (
        <div className="help mb-2">
          Only an organisation-wide publisher can send to all staff. You can save the draft and ask
          one to publish it.
        </div>
      )}

      {!value.allStaff && (
        <>
          <div className="caption mb-2" style={{ marginTop: 10 }}>
            Department and role groups
          </div>
          {value.groups.map((g, i) => (
            <div
              key={i}
              className="flex gap-2 items-center flex-wrap mb-2"
              style={{ alignItems: 'center' }}
            >
              <select
                className="input"
                style={{ flex: '1 1 180px', width: 'auto' }}
                aria-label="Department"
                value={g.departmentId ?? ''}
                onChange={(e) => updateGroup(i, { departmentId: e.target.value || undefined })}
              >
                <option value="">Any department</option>
                {departments.map((d) => (
                  <option key={d.id} value={d.id}>
                    {'  '.repeat(d.depth)}
                    {d.name}
                  </option>
                ))}
              </select>
              {canListRoles && (
                <select
                  className="input"
                  style={{ flex: '1 1 160px', width: 'auto' }}
                  aria-label="Role"
                  value={g.roleId ?? ''}
                  onChange={(e) => updateGroup(i, { roleId: e.target.value || undefined })}
                >
                  <option value="">Any role</option>
                  {roles.map((r) => (
                    <option key={r.id} value={r.id}>
                      {r.name.replace(/_/g, ' ')}
                    </option>
                  ))}
                </select>
              )}
              {g.departmentId && (
                <label className="check" style={{ whiteSpace: 'nowrap' }}>
                  <input
                    type="checkbox"
                    checked={g.includeSubDepartments !== false}
                    onChange={(e) => updateGroup(i, { includeSubDepartments: e.target.checked })}
                  />
                  Include sub-departments
                </label>
              )}
              <button
                type="button"
                className="btn btn-ghost btn-sm"
                aria-label="Remove group"
                onClick={() => setGroups(value.groups.filter((_, j) => j !== i))}
              >
                <Icon name="x" size={13} />
              </button>
            </div>
          ))}
          <button
            type="button"
            className="btn btn-secondary btn-sm mb-4"
            onClick={() => setGroups([...value.groups, { includeSubDepartments: true }])}
          >
            <Icon name="plus" size={13} /> Add group
          </button>
          {!canListRoles && value.groups.length > 0 && (
            <div className="help mb-2">
              Groups are by department. Name people below to add others.
            </div>
          )}

          <div className="caption mb-2">Named people</div>
          <Combobox
            multiple
            options={userOptions}
            value={value.userIds}
            onChange={(ids) => onChange({ ...value, userIds: ids as string[] })}
            placeholder="Add people by name…"
            searchPlaceholder="Search people…"
          />
        </>
      )}

      {publishScope && publishScope !== 'global' && !value.allStaff && (
        <div className="help mt-2">
          Your publishing scope is your own department and its sub-departments.
        </div>
      )}
    </div>
  );
}

/** A group with neither a department nor a role is rejected by the backend. */
export function isAudienceEmpty(a: CircularAudience): boolean {
  if (a.allStaff) return false;
  const groups = a.groups.filter((g) => g.departmentId || g.roleId);
  return groups.length === 0 && a.userIds.length === 0;
}

/** Drops blank group rows, and sends nothing but `allStaff` when it is set. */
export function cleanAudience(a: CircularAudience): CircularAudience {
  if (a.allStaff) return { allStaff: true, groups: [], userIds: [] };
  return {
    allStaff: false,
    groups: a.groups
      .filter((g) => g.departmentId || g.roleId)
      .map((g) => ({
        ...(g.departmentId ? { departmentId: g.departmentId } : {}),
        ...(g.roleId ? { roleId: g.roleId } : {}),
        includeSubDepartments: g.includeSubDepartments !== false,
      })),
    userIds: a.userIds,
  };
}
