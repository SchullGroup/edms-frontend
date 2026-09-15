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
} from '@/apis/hooks/useUsers';
import { useRoles } from '@/apis/hooks/useRoles';
import { useDepartments } from '@/apis/hooks/useDepartments';
import { buildDepartmentIndex, departmentName } from '@/apis/utils/managementAggregation';
import { Table, Column } from '@/components/ui/Table';
import { Pagination } from '@/components/ui/Pagination';
import { Icon } from '@/components/ui/Icons';

const USERS_PAGE_SIZE = 10;

export default function UsersPage() {
  const { auditAction } = useStore();
  const { setPageTitle, openModal, closeModal, addToast } = useUIStore();

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
    const existingRoleId = user?.userRoles?.[0]?.roleId ?? user?.roles?.[0]?.id ?? '';
    let u = {
      id: user?.id,
      name: user?.name || '',
      email: user?.email || '',
      roleId: existingRoleId,
      departmentId: user?.departmentId || departmentList[0]?.id || '',
    };

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
              className="input"
              defaultValue={u.email}
              placeholder="name@firstatlantic.com"
              onChange={(e) => (u.email = e.target.value)}
            />
          </div>
          <div className="field">
            <label>Role</label>
            <RoleSelect initialRoleId={u.roleId} onChange={(roleId) => (u.roleId = roleId)} />
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
        </div>
      ),
      actions: [
        { label: 'Cancel' },
        {
          label: isNew ? 'Send invite' : 'Save',
          kind: 'btn-primary',
          onClick: () => {
            if (!u.name.trim() || !u.email.trim()) {
              addToast('Name and email are required', 'error');
              return;
            }
            if (isNew) {
              createUser.mutate(
                {
                  email: u.email,
                  name: u.name,
                  password: 'password', // Default
                  departmentId: u.departmentId || undefined,
                  roleIds: u.roleId ? [u.roleId] : undefined,
                },
                {
                  onSuccess: (newUser: any) => {
                    auditAction('USER_INVITE', newUser.id, 'Invited ' + u.email);
                  },
                },
              );
            } else {
              updateUser.mutate(
                {
                  id: u.id,
                  updates: { name: u.name, email: u.email, departmentId: u.departmentId } as any,
                },
                {
                  onSuccess: () => {
                    auditAction('USER_EDIT', u.id, 'Updated profile');
                  },
                },
              );
              // Persist a role change — the modal only tracks a single role.
              if (u.roleId && u.roleId !== existingRoleId) {
                assignUserRoles.mutate({ id: u.id, roleIds: [u.roleId] });
                if (existingRoleId) {
                  removeUserRole.mutate({ id: u.id, roleId: existingRoleId });
                }
                auditAction('USER_ROLE_CHANGE', u.id, `Role → ${u.roleId}`);
              }
            }
            closeModal();
          },
        },
      ],
    });
  };

  const handleToggleStatus = (u: any) => {
    if (u.status === 'Active') {
      const confirmed = window.confirm(
        `Suspend ${u.name}? The user loses access immediately. In-flight tasks remain assigned and should be reassigned by a supervisor.`,
      );
      if (confirmed) {
        updateUser.mutate({ id: u.id, updates: { status: 'suspended' } });
        auditAction('USER_SUSPEND', u.id, 'Suspended');
      }
    } else {
      updateUser.mutate({ id: u.id, updates: { status: 'active' } });
      auditAction('USER_ACTIVATE', u.id, 'Re-activated');
    }
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
    { key: 'roleLabel', label: 'Role', sortable: true },
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
            onClick={(e) => {
              e.stopPropagation();
              handleUserModal(u);
            }}
          >
            Edit
          </button>
          <button
            className="btn btn-secondary btn-sm"
            onClick={(e) => {
              e.stopPropagation();
              handleToggleStatus(u);
            }}
          >
            {u.status === 'Active' ? 'Suspend' : 'Activate'}
          </button>
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
            Invite people, edit their profile and department, and assign a role.
          </div>
        </div>
        <div className="actions">
          <button className="btn btn-primary flex items-center" onClick={() => handleUserModal(null)}>
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
          <div style={{ padding: '32px', textAlign: 'center', color: 'var(--text-soft)' }}>
            Loading users...
          </div>
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
 * The invite/edit modal's role picker. Split out into its own component so it
 * fetches roles itself rather than reading a `roles` value captured by the
 * surrounding `openModal(...)` call — that value is frozen at the moment the
 * modal button is clicked, so if the query hadn't resolved yet the `<select>`
 * was stuck without roles until the modal was closed and reopened.
 *
 * `key={isLoading ...}` forces a remount once roles arrive, so an edit modal's
 * `defaultValue` (the user's existing role) gets re-applied against the
 * now-available `<option>` list instead of falling back to "Unassigned".
 */
function RoleSelect({
  initialRoleId,
  onChange,
}: {
  initialRoleId: string;
  onChange: (roleId: string) => void;
}) {
  const { data: roles, isLoading } = useRoles();

  return (
    <select
      key={isLoading ? 'loading' : 'loaded'}
      className="input capitalize"
      defaultValue={initialRoleId}
      onChange={(e) => onChange(e.target.value)}
    >
      <option value="">Unassigned</option>
      {isLoading && (
        <option value="_loading" disabled>
          Loading roles….
        </option>
      )}
      {roles?.map((r) => (
        <option key={r.id} value={r.id}>
          {r.name.replace('_', ' ')}
        </option>
      ))}
    </select>
  );
}
