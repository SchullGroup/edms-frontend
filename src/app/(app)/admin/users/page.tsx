'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { useStore } from '@/store/useStore';
import { useUIStore } from '@/store/useUIStore';
import { useUsers, useCreateUser, useUpdateUser } from '@/apis/hooks/useUsers';
import { useRoles, useCreateRole, useSetRolePermissions } from '@/apis/hooks/useRoles';
import { useDepartments } from '@/apis/hooks/useDepartments';
import { usePolicies, useUpdatePolicyControl } from '@/apis/hooks/usePolicies';
import { buildDepartmentIndex, departmentName } from '@/apis/utils/managementAggregation';
import { Table, Column } from '@/components/ui/Table';
import { Pagination } from '@/components/ui/Pagination';
import { Icon } from '@/components/ui/Icons';
import { Role } from '@/types/models';

const USERS_PAGE_SIZE = 10;

const PERMISSION_RESOURCES: { value: string; label: string }[] = [
  { value: 'document', label: 'Documents' },
  { value: 'cabinet', label: 'Cabinets' },
  { value: 'folder', label: 'Folders' },
  { value: 'workflow', label: 'Workflows' },
  { value: 'audit', label: 'Audit' },
  { value: 'user', label: 'Users' },
  { value: 'dashboard', label: 'Dashboard' },
];

const PERMISSION_ACTIONS: { value: string; label: string }[] = [
  { value: 'view', label: 'View' },
  { value: 'create', label: 'Create' },
  { value: 'edit', label: 'Edit' },
  { value: 'delete', label: 'Delete' },
  { value: 'route', label: 'Route' },
  { value: 'export', label: 'Export' },
  { value: 'download', label: 'Download' },
  { value: 'print', label: 'Print' },
];

export default function UsersRolesPage() {
  const { auditAction } = useStore();
  const { setPageTitle, openModal, closeModal, addToast } = useUIStore();
  const [tab, setTab] = useState<'users' | 'roles' | 'groups'>('users');
  const [permResource, setPermResource] = useState<string>('document');

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

  // The role picker in the invite/edit modal is reachable from any tab (the
  // header button isn't tab-scoped), so keep it enabled once that modal's
  // been opened even if the admin isn't on the Roles tab — but don't fetch
  // it just for sitting on Users or Groups & SoD, which never render it.
  const [modalNeedsRoles, setModalNeedsRoles] = useState(false);
  const { data: roles } = useRoles({ enabled: tab === 'roles' || modalNeedsRoles });
  const setRolePermissions = useSetRolePermissions();
  const createRole = useCreateRole();

  const { data: departmentsData } = useDepartments();
  const departmentIndex = useMemo(
    () => buildDepartmentIndex(departmentsData?.data || []),
    [departmentsData],
  );
  const departmentList = useMemo(() => Array.from(departmentIndex.values()), [departmentIndex]);

  // Segregation-of-duties controls only render on the Groups & SoD tab.
  const { data: policiesData } = usePolicies({ enabled: tab === 'groups' });
  const policies = policiesData as any;
  const updatePolicyControl = useUpdatePolicyControl();

  const createUser = useCreateUser();
  const updateUser = useUpdateUser();

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
    setPageTitle('Users & Roles');
  }, [setPageTitle]);

  const handleUserModal = (user: any | null) => {
    setModalNeedsRoles(true);
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
        <div className="grid cols-2" style={{ gap: '12px' }}>
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
            <select
              className="input capitalize"
              defaultValue={u.roleId}
              onChange={(e) => (u.roleId = e.target.value)}
            >
              <option value="">Unassigned</option>
              {roles?.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.name.replace('_', ' ')}
                </option>
              ))}
            </select>
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
                    auditAction('USER_EDIT', u.id, 'Updated profile/role');
                  },
                },
              );
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
        <span className="flex aic g8">
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
        <div className="flex g8">
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

  const handleNewRole = () => {
    setModalNeedsRoles(true);
    const form = { name: '', description: '' };
    openModal({
      title: 'New role',
      body: (
        <div className="grid" style={{ gap: '12px' }}>
          <div className="field">
            <label>
              Role name <span className="req">*</span>
            </label>
            <input
              className="input"
              placeholder="e.g. finance_reviewer"
              maxLength={100}
              onChange={(e) => (form.name = e.target.value)}
            />
          </div>
          <div className="field">
            <label>Description</label>
            <input
              className="input"
              placeholder="Optional — what this role is for"
              maxLength={500}
              onChange={(e) => (form.description = e.target.value)}
            />
          </div>
        </div>
      ),
      actions: [
        { label: 'Cancel' },
        {
          label: 'Create role',
          kind: 'btn-primary',
          onClick: () => {
            const name = form.name.trim();
            if (!name) {
              addToast('Role name is required', 'error');
              return false;
            }
            return createRole
              .mutateAsync({ name, description: form.description.trim() || undefined })
              .then((created) => {
                auditAction('ROLE_CREATE', created.name, `Created role ${name}`);
                setTab('roles');
                closeModal();
              })
              .catch(() => false);
          },
        },
      ],
    });
  };

  const roleHasPermission = (role: Role, resource: string, action: string) =>
    !!role.permissions?.some((p) => p.resource === resource && p.action === action);

  const toggleRolePermission = (role: Role, resource: string, action: string, checked: boolean) => {
    const current = role.permissions || [];
    const next = checked
      ? [...current, { resource, action } as NonNullable<Role['permissions']>[number]]
      : current.filter((p) => !(p.resource === resource && p.action === action));

    setRolePermissions.mutate(
      { id: role.id, permissions: next },
      {
        onSuccess: () => {
          auditAction(
            'ROLE_EDIT',
            role.name,
            `${checked ? 'Granted' : 'Revoked'} ${resource}:${action}`,
          );
          addToast(
            `${role.name}: ${resource}:${action} ${checked ? 'granted' : 'revoked'}`,
            'info',
          );
        },
      },
    );
  };

  return (
    <div>
      <div className="page-head">
        <div>
          <div className="page-title">Users & Roles</div>
          <div className="page-sub">Manage users, permissions, groups and SoD rules.</div>
        </div>
        <div className="actions">
          {tab === 'roles' ? (
            <button className="btn btn-primary flex aic" onClick={handleNewRole}>
              <span style={{ marginRight: '8px' }}>
                <Icon name="plus" size={15} />
              </span>{' '}
              New role
            </button>
          ) : (
            <button className="btn btn-primary flex aic" onClick={() => handleUserModal(null)}>
              <span style={{ marginRight: '8px' }}>
                <Icon name="plus" size={15} />
              </span>{' '}
              Invite user
            </button>
          )}
        </div>
      </div>

      <div className="tabs mb16">
        <button
          className={`tab ${tab === 'users' ? 'active' : ''}`}
          onClick={() => setTab('users')}
        >
          Users
        </button>
        <button
          className={`tab ${tab === 'roles' ? 'active' : ''}`}
          onClick={() => setTab('roles')}
        >
          Roles & permissions
        </button>
        <button
          className={`tab ${tab === 'groups' ? 'active' : ''}`}
          onClick={() => setTab('groups')}
        >
          Groups & SoD
        </button>
      </div>

      {tab === 'users' && (
        <div className="card">
          <div className="card-head">
            <span className="h3">{usersData?.pagination?.total ?? 0} users</span>
            <div className="flex aic g8">
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
      )}

      {tab === 'roles' && (
        <div className="card">
          <div className="card-head">
            <span className="h3">Permission matrix</span>
            <span className="flex aic g8">
              <span className="caption">Resource</span>
              <select
                className="input"
                style={{ width: 'auto', height: '32px' }}
                value={permResource}
                onChange={(e) => setPermResource(e.target.value)}
              >
                {PERMISSION_RESOURCES.map((r) => (
                  <option key={r.value} value={r.value}>
                    {r.label}
                  </option>
                ))}
              </select>
            </span>
          </div>
          <div className="tbl-wrap">
            <table className="tbl pm-grid">
              <thead>
                <tr>
                  <th>Role</th>
                  {PERMISSION_ACTIONS.map((a) => (
                    <th key={a.value}>{a.label}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {roles?.map((r) => (
                  <tr key={r.id}>
                    <td>
                      <b>{r.name}</b>
                    </td>
                    {PERMISSION_ACTIONS.map((a) => (
                      <td key={a.value}>
                        <label className="switch">
                          <input
                            type="checkbox"
                            checked={roleHasPermission(r, permResource, a.value)}
                            onChange={(e) =>
                              toggleRolePermission(r, permResource, a.value, e.target.checked)
                            }
                          />
                          <i></i>
                        </label>
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {tab === 'groups' && (
        <div className="grid cols-2" style={{ alignItems: 'start' }}>
          <div className="card">
            <div className="card-head">
              <span className="h3">Groups</span>
            </div>
            <div className="card-body" style={{ paddingTop: '6px' }}>
              {[
                ['Finance Approvers', 4],
                ['Legal Reviewers', 3],
                ['Procurement Committee', 5],
                ['Executive Signatories', 2],
              ].map(([g, n]) => (
                <div key={g as string} className="metric-li">
                  <span>{g as string}</span>
                  <span className="caption">{n as number} members</span>
                </div>
              ))}
              <button
                className="btn btn-secondary btn-sm mt16"
                onClick={() =>
                  addToast(
                    'Group editor would open here (add/remove members, map to workflow roles)',
                    'info',
                  )
                }
              >
                + New group
              </button>
            </div>
          </div>
          <div className="card">
            <div className="card-head">
              <span className="h3">Segregation-of-duties rules</span>
            </div>
            <div className="card-body" style={{ paddingTop: '6px' }}>
              {policies?.controls?.map((c: any) => (
                <div key={c.rule} className="metric-li">
                  <span style={{ lineHeight: 1.5 }}>
                    {c.rule}
                    <div className="caption">Scope: {c.scope}</div>
                  </span>
                  <label className="switch">
                    <input
                      type="checkbox"
                      checked={c.enabled}
                      onChange={(e) => {
                        updatePolicyControl.mutate(
                          { ruleName: c.rule, enabled: e.target.checked },
                          {
                            onSuccess: () => {
                              auditAction(
                                'CONTROL_TOGGLE',
                                c.rule,
                                e.target.checked ? 'Enabled' : 'Disabled',
                              );
                            },
                          },
                        );
                      }}
                    />
                    <i></i>
                  </label>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
