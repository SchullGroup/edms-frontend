'use client';

import React, { useState, useEffect } from 'react';
import { useStore } from '@/store/useStore';
import { useUIStore } from '@/store/useUIStore';
import { useUsers, useCreateUser, useUpdateUser } from '@/apis/hooks/useUsers';
import { Table, Column } from '@/components/ui/Table';
import { Icon } from '@/components/ui/Icons';

export default function UsersRolesPage() {
  const { rolesMatrix, policies, updateRoleMatrix, updatePolicyControl, auditAction } = useStore();
  const { setPageTitle, openModal, closeModal, addToast } = useUIStore();
  const [tab, setTab] = useState<'users' | 'roles' | 'groups'>('users');

  const { data: usersData, isLoading } = useUsers();
  const rawUsers = usersData?.data || [];

  const createUser = useCreateUser();
  const updateUser = useUpdateUser();

  const users = rawUsers.map((u) => ({
    ...u,
    roleLabel: 'Staff', // Mock for now since userRoles requires relation inclusion
    dept: u.departmentId || 'Unknown',
    status: u.status === 'active' ? 'Active' : u.status === 'suspended' ? 'Suspended' : 'Inactive',
    sso: false,
  }));

  useEffect(() => {
    setPageTitle('Users & Roles');
  }, [setPageTitle]);

  const handleUserModal = (user: any | null) => {
    const isNew = !user;
    let u = user || {
      id: 'u-' + Date.now(),
      name: '',
      email: '',
      role: 'staff',
      roleLabel: 'Staff Officer',
      dept: 'Operations',
      status: 'Active',
      sso: false,
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
              className="input"
              defaultValue={u.roleLabel}
              onChange={(e) => (u.roleLabel = e.target.value)}
            >
              {rolesMatrix?.map((r: any) => (
                <option key={r.role} value={r.role}>
                  {r.role}
                </option>
              ))}
            </select>
          </div>
          <div className="field">
            <label>Department</label>
            <select
              className="input"
              defaultValue={u.dept}
              onChange={(e) => (u.dept = e.target.value)}
            >
              {[
                'Operations',
                'Finance',
                'Legal',
                'Procurement',
                'IT',
                'Audit & Compliance',
                'Executive',
              ].map((d) => (
                <option key={d} value={d}>
                  {d}
                </option>
              ))}
            </select>
          </div>
          <div className="field">
            <label>SSO (Okta)</label>
            <label className="check">
              <input
                type="checkbox"
                defaultChecked={u.sso}
                onChange={(e) => (u.sso = e.target.checked)}
              />{' '}
              Enrolled in single sign-on
            </label>
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
            const map: Record<string, string> = {
              'Staff Officer': 'staff',
              Supervisor: 'supervisor',
              Management: 'management',
              'Client Admin': 'clientadmin',
              'Internal Auditor': 'auditor',
            };
            u.role = map[u.roleLabel] || 'staff';
            if (isNew) {
              createUser.mutate({
                email: u.email,
                name: u.name,
                password: 'password', // Default
                departmentId: u.dept,
              });
              auditAction('USER_INVITE', u.id, 'Invited ' + u.email);
            } else {
              updateUser.mutate({
                id: u.id,
                updates: { name: u.name, email: u.email },
              });
              auditAction('USER_EDIT', u.id, 'Updated profile/role');
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
      key: 'sso',
      label: 'SSO',
      render: (u) =>
        u.sso ? (
          <span className="badge b-status-closed">Enrolled</span>
        ) : (
          <span className="badge b-status-pending">Pending</span>
        ),
    },
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

  const permCols = [
    ['view', 'View'],
    ['upload', 'Upload'],
    ['approve', 'Approve'],
    ['sign', 'Sign'],
    ['redact', 'Redact'],
    ['admin', 'Admin'],
    ['audit', 'Audit'],
  ];

  return (
    <div>
      <div className="page-head">
        <div>
          <div className="page-title">Users & Roles</div>
          <div className="page-sub">Manage users, permissions, groups and SoD rules.</div>
        </div>
        <div className="actions">
          <button className="btn btn-primary flex aic" onClick={() => handleUserModal(null)}>
            <span style={{ marginRight: '8px' }}>
              <Icon name="plus" size={15} />
            </span>{' '}
            Invite user
          </button>
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
          {isLoading ? (
            <div style={{ padding: '32px', textAlign: 'center', color: 'var(--text-soft)' }}>
              Loading users...
            </div>
          ) : (
            <Table cols={userCols} rows={users} />
          )}
        </div>
      )}

      {tab === 'roles' && (
        <div className="card">
          <div className="card-head">
            <span className="h3">Permission matrix</span>
            <span className="caption">Changes apply immediately and are audited</span>
          </div>
          <div className="tbl-wrap">
            <table className="tbl pm-grid">
              <thead>
                <tr>
                  <th>Role</th>
                  {permCols.map(([k, l]) => (
                    <th key={k}>{l}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rolesMatrix?.map((r: any) => (
                  <tr key={r.role}>
                    <td>
                      <b>{r.role}</b>
                    </td>
                    {permCols.map(([k]) => (
                      <td key={k}>
                        <label className="switch">
                          <input
                            type="checkbox"
                            checked={r.perms[k] || false}
                            onChange={(e) => {
                              const newPerms = { ...r.perms, [k]: e.target.checked };
                              updateRoleMatrix(r.role, newPerms);
                              auditAction(
                                'ROLE_EDIT',
                                r.role,
                                `${e.target.checked ? 'Granted' : 'Revoked'} ${k}`,
                              );
                              addToast(
                                `${r.role}: ${k} ${e.target.checked ? 'granted' : 'revoked'}`,
                                'info',
                              );
                            }}
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
                        updatePolicyControl(c.rule, e.target.checked);
                        auditAction(
                          'CONTROL_TOGGLE',
                          c.rule,
                          e.target.checked ? 'Enabled' : 'Disabled',
                        );
                        addToast(
                          'Control ' + (e.target.checked ? 'enabled' : 'disabled'),
                          e.target.checked ? 'success' : 'warning',
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
