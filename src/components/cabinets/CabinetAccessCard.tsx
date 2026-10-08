'use client';

import React, { useState } from 'react';
import { useStore } from '@/store/useStore';
import { useUIStore } from '@/store/useUIStore';
import { usePermissions } from '@/hooks/usePermissions';
import { Table, Column } from '@/components/ui/Table';
import { Combobox } from '@/components/ui/Combobox';
import { SkeletonTable } from '@/components/common/Skeleton';
import {
  useCabinetAccessGrants,
  useGrantCabinetAccess,
  useRevokeCabinetAccess,
} from '@/apis/hooks/useCabinets';
import { useRoles } from '@/apis/hooks/useRoles';
import { useAllUsers } from '@/apis/hooks/useUsers';
import type { Cabinet, CabinetAccessPermission, User } from '@/types/models';
import {
  CABINET_BYPASS_ROLE,
  cabinetAllows,
  grantableLevels,
  useMyCabinetAccess,
} from './cabinetAccess';

const roleNamesOf = (u: User) =>
  u.roles?.map((r) => r.name) ?? u.userRoles?.map((ur) => ur.role.name) ?? [];

/** Whether the caller may grant access on `cabinet` — callers use this to decide
 *  whether to render the card. The API needs `cabinet_access:create` plus `edit` here. */
export function useCanGrantAccess(cabinet: Cabinet | null | undefined) {
  const { can } = usePermissions();
  return cabinetAllows(useMyCabinetAccess(cabinet?.id), 'edit') && can('cabinet_access', 'create');
}

/**
 * Access grants for one cabinet, shared by Cabinet Designer and the Cabinets
 * page. Non-admins can't grant to themselves, to a role they hold, or above
 * their own level. The API doesn't refuse any of these yet, so the pickers
 * are the only thing stopping them — keep that in mind before widening who
 * holds `cabinet_access:create` (today: client_admin only, who is exempt).
 * A grant to client_admin, or to anyone holding it, changes nothing, so those
 * aren't offered either.
 */
export function CabinetAccessCard({ cabinet }: { cabinet: Cabinet }) {
  const { auditAction, currentUser } = useStore();
  const { can } = usePermissions();
  const { openModal, openConfirm, closeModal, addToast } = useUIStore();

  const level = useMyCabinetAccess(cabinet.id);
  const hasEdit = cabinetAllows(level, 'edit');
  const canCreateAccess = hasEdit && can('cabinet_access', 'create');
  const canDeleteAccess = hasEdit && can('cabinet_access', 'delete');
  const canViewAccess = can('cabinet_access', 'view');
  const isAdmin = !!currentUser?.roles?.includes(CABINET_BYPASS_ROLE);

  const { data: accessGrants = [], isLoading } = useCabinetAccessGrants(cabinet.id, {
    enabled: canViewAccess,
  });
  const grantAccess = useGrantCabinetAccess();
  const revokeAccess = useRevokeCabinetAccess();

  const { data: roles = [] } = useRoles();
  const { data: usersResult } = useAllUsers();
  const users = usersResult?.items || [];

  const myRoleNames = new Set(currentUser?.roles ?? []);
  const grantableRoles = roles.filter(
    (r) => r.name !== CABINET_BYPASS_ROLE && (isAdmin || !myRoleNames.has(r.name)),
  );
  const grantableUsers = users.filter(
    (u) => u.id !== currentUser?.id && !roleNamesOf(u).includes(CABINET_BYPASS_ROLE),
  );
  const levels = grantableLevels(level);

  const handleGrantAccess = () => {
    const roleOptions = grantableRoles.map((r) => ({
      value: r.id,
      label: r.name.replace(/_/g, ' '),
    }));
    const userOptions = grantableUsers.map((u) => ({ value: u.id, label: u.name, hint: u.email }));

    const form: {
      permission: CabinetAccessPermission;
      targetType: 'role' | 'user';
      roleIds: string[];
      userIds: string[];
    } = {
      permission: 'view',
      targetType: 'role',
      roleIds: [],
      userIds: [],
    };

    const Body = () => {
      const [targetType, setTargetType] = useState<'role' | 'user'>(form.targetType);
      const [roleIds, setRoleIds] = useState<string[]>(form.roleIds);
      const [userIds, setUserIds] = useState<string[]>(form.userIds);
      return (
        <div className="grid" style={{ gap: '12px' }}>
          <div className="field">
            <label>Permission</label>
            <select
              className="input"
              defaultValue={form.permission}
              onChange={(e) => (form.permission = e.target.value as CabinetAccessPermission)}
            >
              {levels.map((p) => (
                <option key={p.value} value={p.value}>
                  {p.label}
                </option>
              ))}
            </select>
            {!isAdmin && (
              <div className="help">You can grant up to your own level on this cabinet.</div>
            )}
          </div>
          <div className="field">
            <label>Grant to</label>
            <select
              className="input"
              value={targetType}
              onChange={(e) => {
                const v = e.target.value as 'role' | 'user';
                setTargetType(v);
                form.targetType = v;
              }}
            >
              <option value="role">Roles</option>
              <option value="user">Specific users</option>
            </select>
          </div>
          <div className="field">
            <label>{targetType === 'role' ? 'Roles' : 'Users'}</label>
            <Combobox
              multiple
              options={targetType === 'role' ? roleOptions : userOptions}
              value={targetType === 'role' ? roleIds : userIds}
              onChange={(v) => {
                const arr = v as string[];
                if (targetType === 'role') {
                  setRoleIds(arr);
                  form.roleIds = arr;
                } else {
                  setUserIds(arr);
                  form.userIds = arr;
                }
              }}
              placeholder={targetType === 'role' ? 'Select roles…' : 'Select users…'}
              searchPlaceholder={targetType === 'role' ? 'Search roles…' : 'Search users…'}
            />
            <div className="help">
              The API grants to one {targetType} per call — picking several sends a request for
              each.{' '}
              {targetType === 'role'
                ? isAdmin
                  ? 'Client admins already reach every cabinet, so that role isn’t listed.'
                  : 'Roles you hold aren’t listed — you can’t grant access to yourself.'
                : 'You and client admins aren’t listed — client admins already reach every cabinet.'}
            </div>
          </div>
        </div>
      );
    };

    openModal({
      title: `Grant access — ${cabinet.name}`,
      body: <Body />,
      actions: [
        { label: 'Cancel' },
        {
          label: 'Grant access',
          kind: 'btn-primary',
          onClick: () => {
            const ids = form.targetType === 'role' ? form.roleIds : form.userIds;
            if (ids.length === 0) {
              addToast(`Select at least one ${form.targetType}`, 'error');
              return false;
            }
            return Promise.all(
              ids.map((id) =>
                grantAccess.mutateAsync({
                  cabinetId: cabinet.id,
                  data: {
                    permission: form.permission,
                    ...(form.targetType === 'role' ? { roleId: id } : { userId: id }),
                  },
                }),
              ),
            )
              .then(() => {
                auditAction(
                  'CABINET_ACCESS_GRANT',
                  cabinet.id,
                  `Granted ${form.permission} to ${ids.length} ${form.targetType}${
                    ids.length === 1 ? '' : 's'
                  }`,
                );
                closeModal();
              })
              .catch(() => false);
          },
        },
      ],
    });
  };

  const grantTargetLabel = (g: any) => {
    if (g.role?.name) return `Role: ${g.role.name.replace(/_/g, ' ')}`;
    if (g.roleId) return `Role: ${roles.find((r) => r.id === g.roleId)?.name ?? g.roleId}`;
    if (g.user?.name) return `User: ${g.user.name}`;
    if (g.userId) {
      const u = users.find((x) => x.id === g.userId);
      return `User: ${u ? u.name : g.userId}`;
    }
    return '—';
  };

  const handleRevokeAccess = (g: any) => {
    openConfirm({
      title: 'Revoke this access grant?',
      message: `${grantTargetLabel(g)} will lose "${g.permission}" access to ${cabinet.name}.`,
      confirmLabel: 'Revoke',
      danger: true,
      onConfirm: () =>
        revokeAccess
          .mutateAsync({ cabinetId: cabinet.id, grantId: g.id })
          .then(() => {
            auditAction('CABINET_ACCESS_REVOKE', cabinet.id, `Revoked ${g.permission}`);
          })
          .catch(() => {}),
    });
  };

  const cols: Column<any>[] = [
    { key: 'target', label: 'Grantee', render: (g) => <b>{grantTargetLabel(g)}</b> },
    {
      key: 'permission',
      label: 'Permission',
      render: (g) => <span className="badge b-urg-low">{g.permission}</span>,
    },
  ];
  if (canDeleteAccess) {
    cols.push({
      key: 'act',
      label: '',
      render: (g) => (
        <button className="btn btn-ghost btn-sm" onClick={() => handleRevokeAccess(g)}>
          Revoke
        </button>
      ),
    });
  }

  return (
    <div className="card mb-4">
      <div className="card-head">
        <span className="h3">Access</span>
        {canCreateAccess && (
          <button className="btn btn-secondary btn-sm" onClick={handleGrantAccess}>
            + Grant access
          </button>
        )}
      </div>
      {!canViewAccess ? (
        <div className="card-body caption">
          You can grant access here, but your role can’t list the existing grants.
        </div>
      ) : isLoading ? (
        <SkeletonTable columns={['Grantee', 'Permission', '']} rows={3} />
      ) : (
        <Table
          cols={cols}
          rows={accessGrants}
          emptyMsg="No explicit grants — this cabinet is open only to its own department (or everyone, if it has none)."
        />
      )}
    </div>
  );
}
