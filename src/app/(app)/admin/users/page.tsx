'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { useStore } from '@/store/useStore';
import { useUIStore } from '@/store/useUIStore';
import {
  useUsers,
  useCreateUser,
  useUpdateUser,
  useAssignUserRoles,
  useRemoveUserRole,
  useResendInvitation,
} from '@/apis/hooks/useUsers';
import { useRoles } from '@/apis/hooks/useRoles';
import { usePermissions } from '@/hooks/usePermissions';
import { useDepartments } from '@/apis/hooks/useDepartments';
import { buildDepartmentIndex, departmentName } from '@/apis/utils/managementAggregation';
import { Table, Column } from '@/components/ui/Table';
import { Pagination } from '@/components/ui/Pagination';
import { Icon } from '@/components/ui/Icons';
import { SkeletonTable } from '@/components/common/Skeleton';

const USERS_PAGE_SIZE = 10;

export default function UsersPage() {
  const { auditAction } = useStore();
  const { setPageTitle, openModal, openConfirm, addToast } = useUIStore();
  const { can } = usePermissions();
  const canCreateUser = can('user', 'create');
  const canEditUser = can('user', 'edit');

  const [page, setPage] = useState(1);
  const [departmentFilter, setDepartmentFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState<'' | 'active' | 'inactive' | 'suspended'>('');

  const { data: usersData, isLoading } = useUsers({
    page,
    limit: USERS_PAGE_SIZE,
    departmentId: departmentFilter || undefined,
    status: statusFilter || undefined,
  });
  const rawUsers = usersData?.data || [];

  const createUser = useCreateUser();
  const updateUser = useUpdateUser();
  const assignUserRoles = useAssignUserRoles();
  const removeUserRole = useRemoveUserRole();
  const resendInvitation = useResendInvitation();

  const { data: departmentsData } = useDepartments();
  const departmentIndex = useMemo(
    () => buildDepartmentIndex(departmentsData?.data || []),
    [departmentsData],
  );
  const departmentList = useMemo(() => Array.from(departmentIndex.values()), [departmentIndex]);

  const roleLabel = (u: any) => {
    const names =
      u.userRoles?.map((ur: any) => ur.role?.name).filter(Boolean) ??
      u.roles?.map((r: any) => r.name);
    return names?.length ? names.join(', ') : 'Unassigned';
  };

  const users = rawUsers.map((u) => ({
    ...u,
    roleLabel: roleLabel(u),
    dept: departmentName(u.departmentId, departmentIndex),
    status: u.status === 'active' ? 'Active' : u.status === 'suspended' ? 'Suspended' : 'Inactive',
  }));

  useEffect(() => {
    setPageTitle('Users');
  }, [setPageTitle]);

  const handleUserModal = (user: any | null) => {
    const isNew = !user;
    const existingRoleIds: string[] =
      user?.userRoles?.map((ur: any) => ur.roleId) ?? user?.roles?.map((r: any) => r.id) ?? [];
    let u = {
      id: user?.id,
      name: user?.name || '',
      email: user?.email || '',
      roleIds: existingRoleIds,
      departmentId: user?.departmentId || departmentList[0]?.id || '',
    };
    // Modal actions aren't real <form> submits, so `required`/`type="email"`
    // alone won't pop the browser's native validation UI — this ref lets the
    // Save/Send invite handler trigger it explicitly via reportValidity().
    const emailInputRef = { current: null as HTMLInputElement | null };

    openModal({
      title: isNew ? 'Invite user' : 'Edit user — ' + u.name,
      body: (
        <div className="grid grid-cols-2 gap-3">
          <div className="field">
            <label>
              Name <span className="req">*</span>
            </label>
            <input
              className="input"
              defaultValue={u.name}
              placeholder="Full name"
              onChange={(e) => (u.name = e.target.value)}
            />
          </div>
          <div className="field">
            <label>
              Email <span className="req">*</span>
            </label>
            <input
              ref={(el) => {
                emailInputRef.current = el;
              }}
              className="input"
              type="email"
              required
              defaultValue={u.email}
              placeholder="name@firstatlantic.com"
              onChange={(e) => (u.email = e.target.value)}
            />
          </div>
          <div className="field">
            <label>Department</label>
            <select
              className="input"
              defaultValue={u.departmentId}
              onChange={(e) => (u.departmentId = e.target.value)}
            >
              {departmentList.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.name}
                </option>
              ))}
            </select>
          </div>
          <div className="field col-span-2">
            <label>Roles</label>
            <RolePicker initialRoleIds={u.roleIds} onChange={(roleIds) => (u.roleIds = roleIds)} />
            <div className="help">
              Someone with several roles has the rights of all of them, and switches between their
              portals from the top bar.
            </div>
          </div>
        </div>
      ),
      actions: [
        { label: 'Cancel' },
        {
          label: isNew ? 'Send invite' : 'Save',
          kind: 'btn-primary',
          onClick: () => {
            if (emailInputRef.current && !emailInputRef.current.checkValidity()) {
              emailInputRef.current.reportValidity();
              return false;
            }
            if (!u.name.trim() || !u.email.trim()) {
              addToast('Name and email are required', 'error');
              return false;
            }
            if (isNew) {
              // No `password` — the backend now accepts creation without one
              // and sends a real invite email (`invited: true` in the
              // response) instead of us setting a caller-chosen default.
              return createUser
                .mutateAsync({
                  email: u.email,
                  name: u.name,
                  departmentId: u.departmentId || undefined,
                  roleIds: u.roleIds.length ? u.roleIds : undefined,
                })
                .then((newUser: any) => {
                  auditAction('USER_INVITE', newUser.id, 'Invited ' + u.email);
                })
                .catch(() => false);
            }
            // Returning the combined promise keeps the modal open (with a
            // loading state) until the profile update — and, if changed, the
            // role changes — actually land, instead of closing immediately and
            // hoping they succeed in the background.
            const tasks: Promise<any>[] = [
              updateUser
                .mutateAsync({
                  id: u.id,
                  updates: { name: u.name, email: u.email, departmentId: u.departmentId } as any,
                })
                .then(() => {
                  auditAction('USER_EDIT', u.id, 'Updated profile');
                }),
            ];
            // Role changes: `POST /users/:id/roles` adds, `DELETE .../roles/:roleId`
            // removes one. Additions go first and removals after, one at a time,
            // so a user swapping roles is never briefly left with none.
            const added = u.roleIds.filter((id) => !existingRoleIds.includes(id));
            const removed = existingRoleIds.filter((id) => !u.roleIds.includes(id));
            if (added.length || removed.length) {
              tasks.push(
                (added.length
                  ? assignUserRoles.mutateAsync({ id: u.id, roleIds: added })
                  : Promise.resolve()
                )
                  .then(() =>
                    removed.reduce<Promise<unknown>>(
                      (chain, roleId) =>
                        chain.then(() => removeUserRole.mutateAsync({ id: u.id, roleId })),
                      Promise.resolve(),
                    ),
                  )
                  .then(() => {
                    auditAction(
                      'USER_ROLE_CHANGE',
                      u.id,
                      [
                        added.length ? `added ${added.join(', ')}` : '',
                        removed.length ? `removed ${removed.join(', ')}` : '',
                      ]
                        .filter(Boolean)
                        .join('; '),
                    );
                  }),
              );
            }
            return Promise.all(tasks)
              .then(() => {})
              .catch(() => false);
          },
        },
      ],
    });
  };

  const handleToggleStatus = (u: any) => {
    if (u.status === 'Active') {
      openConfirm({
        title: `Suspend ${u.name}?`,
        message:
          'The user loses access immediately. In-flight tasks remain assigned and should be reassigned by a supervisor.',
        confirmLabel: 'Suspend user',
        danger: true,
        onConfirm: () =>
          updateUser
            .mutateAsync({ id: u.id, updates: { status: 'suspended' } })
            .then(() => {
              auditAction('USER_SUSPEND', u.id, 'Suspended');
            })
            .catch(() => false),
      });
    } else {
      updateUser.mutate({ id: u.id, updates: { status: 'active' } });
      auditAction('USER_ACTIVATE', u.id, 'Re-activated');
    }
  };

  const handleResendInvitation = (u: any) => {
    resendInvitation.mutate(u.id, {
      onSuccess: () => auditAction('USER_INVITE_RESEND', u.id, `Resent invitation to ${u.email}`),
    });
  };

  const userCols: Column<any>[] = [
    {
      key: 'name',
      label: 'User',
      sortable: true,
      render: (u) => (
        <span className="flex items-center gap-2">
          <div className="avatar">{u.name.charAt(0)}</div>
          <span>
            <div style={{ fontWeight: 700 }}>{u.name}</div>
            <div className="caption">{u.email}</div>
          </span>
        </span>
      ),
    },
    { key: 'roleLabel', label: 'Roles', sortable: true },
    { key: 'dept', label: 'Department' },
    {
      key: 'status',
      label: 'Status',
      render: (u) => (
        <span className={`badge ${u.status === 'Active' ? 'b-status-closed' : 'b-status-overdue'}`}>
          {u.status}
        </span>
      ),
    },
    {
      key: 'act',
      label: '',
      render: (u) => (
        <div className="flex gap-2">
          <button
            className="btn btn-secondary btn-sm"
            disabled={!canEditUser}
            title={!canEditUser ? "You don't have permission to edit users" : undefined}
            onClick={(e) => {
              e.stopPropagation();
              handleUserModal(u);
            }}
          >
            Edit
          </button>
          <button
            className="btn btn-secondary btn-sm"
            disabled={!canEditUser}
            title={!canEditUser ? "You don't have permission to edit users" : undefined}
            onClick={(e) => {
              e.stopPropagation();
              handleToggleStatus(u);
            }}
          >
            {u.status === 'Active' ? 'Suspend' : 'Activate'}
          </button>
          {u.status === 'Active' && !u.lastLoginAt && (
            <button
              className="btn btn-secondary btn-sm"
              disabled={resendInvitation.isPending || !canCreateUser}
              title={!canCreateUser ? "You don't have permission to invite users" : undefined}
              onClick={(e) => {
                e.stopPropagation();
                handleResendInvitation(u);
              }}
            >
              Resend invite
            </button>
          )}
        </div>
      ),
    },
  ];

  return (
    <div>
      <div className="page-head">
        <div>
          <div className="page-title">Users</div>
          <div className="page-sub">
            Invite people, edit their profile and department, and assign their roles.
          </div>
        </div>
        <div className="actions">
          <button
            className="btn btn-primary flex items-center"
            onClick={() => handleUserModal(null)}
            disabled={!canCreateUser}
            title={!canCreateUser ? "You don't have permission to invite users" : undefined}
          >
            <span style={{ marginRight: '8px' }}>
              <Icon name="plus" size={15} />
            </span>{' '}
            Invite user
          </button>
        </div>
      </div>

      <div className="card">
        <div className="card-head">
          <span className="h3">{usersData?.pagination?.total ?? 0} users</span>
          <div className="flex items-center gap-2">
            <select
              className="input"
              style={{ width: 'auto', height: '32px' }}
              aria-label="Filter by department"
              value={departmentFilter}
              onChange={(e) => {
                setDepartmentFilter(e.target.value);
                setPage(1);
              }}
            >
              <option value="">All departments</option>
              {departmentList.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.name}
                </option>
              ))}
            </select>
            <select
              className="input"
              style={{ width: 'auto', height: '32px' }}
              aria-label="Filter by status"
              value={statusFilter}
              onChange={(e) => {
                setStatusFilter(e.target.value as typeof statusFilter);
                setPage(1);
              }}
            >
              <option value="">--Select Status--</option>
              <option value="active">Active</option>
              <option value="inactive">Inactive</option>
              <option value="suspended">Suspended</option>
            </select>
          </div>
        </div>
        {isLoading ? (
          <SkeletonTable columns={['Name', 'Roles', 'Department', 'Status', '']} rows={8} />
        ) : (
          <>
            <Table cols={userCols} rows={users} />
            {usersData?.pagination && (
              <Pagination
                page={usersData.pagination.page}
                totalPages={usersData.pagination.totalPages}
                total={usersData.pagination.total}
                limit={usersData.pagination.limit}
                onPageChange={setPage}
              />
            )}
          </>
        )}
      </div>
    </div>
  );
}

/**
 * The invite/edit modal's role picker: one checkbox per role, any number ticked.
 * It fetches roles itself rather than reading a `roles` value captured by the
 * surrounding `openModal(...)` call, which is frozen at the moment the modal
 * opens, so roles still loading then would never appear. The ticked set is its
 * own state, reported up through `onChange`.
 */
function RolePicker({
  initialRoleIds,
  onChange,
}: {
  initialRoleIds: string[];
  onChange: (roleIds: string[]) => void;
}) {
  const { data: roles, isLoading } = useRoles();
  const [selected, setSelected] = useState<string[]>(initialRoleIds);

  const toggle = (roleId: string) => {
    const next = selected.includes(roleId)
      ? selected.filter((id) => id !== roleId)
      : [...selected, roleId];
    setSelected(next);
    onChange(next);
  };

  if (isLoading) return <div className="caption">Loading roles…</div>;

  return (
    <div
      role="group"
      aria-label="Roles"
      className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-1"
      style={{
        border: '1px solid var(--border)',
        borderRadius: 8,
        padding: '8px 12px',
        maxHeight: 180,
        overflowY: 'auto',
      }}
    >
      {roles?.map((r) => (
        <label
          key={r.id}
          className="flex items-center gap-2 capitalize"
          style={{ fontWeight: 500, cursor: 'pointer', padding: '3px 0', margin: 0 }}
        >
          <input type="checkbox" checked={selected.includes(r.id)} onChange={() => toggle(r.id)} />
          {r.name.replace(/_/g, ' ')}
        </label>
      ))}
      {!roles?.length && <div className="caption">No roles defined yet.</div>}
    </div>
  );
}
