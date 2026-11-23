'use client';

import React, { use, useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useUIStore } from '@/store/useUIStore';
import {
  useAddUserGroupMembers,
  useRemoveUserGroupMember,
  useUpdateUserGroup,
  useUserGroup,
  userGroupErrorMessage,
} from '@/apis/hooks/useUserGroups';
import { useUsersByIds } from '@/apis/hooks/useUsers';
import { useCanManageUserGroup } from '@/components/userGroups/useCanManageUserGroup';
import { UserMultiPicker } from '@/components/common/UserPicker';
import { Table, Column } from '@/components/ui/Table';
import { Icon } from '@/components/ui/Icons';
import { SkeletonPage } from '@/components/common/Skeleton';
import { ErrorMessage } from '@/components/common/ErrorMessage';
import type { UserGroupMember } from '@/types/models';
import { fmtDate, titleCase } from '@/utils/helpers';

/** The API takes 1–100 user ids per add. */
const MAX_ADD = 100;

/** One user group: its details, status and members. */
export default function UserGroupPage({ params }: { params: Promise<{ groupId: string }> }) {
  const { groupId } = use(params);
  const router = useRouter();
  const { setPageTitle, openConfirm, addToast } = useUIStore();
  const { data: group, isLoading, isError, error, refetch } = useUserGroup(groupId);
  const creator = useUsersByIds([group?.createdBy ?? '']).users.get(group?.createdBy ?? '');
  const canManage = useCanManageUserGroup(group);
  const updateGroup = useUpdateUserGroup();
  const addMembers = useAddUserGroupMembers();
  const removeMember = useRemoveUserGroupMember();
  const [toAdd, setToAdd] = useState<string[]>([]);
  // Remounts the picker after an add, which clears its chips.
  const [pickerKey, setPickerKey] = useState(0);

  useEffect(() => {
    setPageTitle(group?.name || 'User group');
  }, [group?.name, setPageTitle]);

  if (isLoading) return <SkeletonPage />;
  if (isError || !group) {
    const status = (error as any)?.response?.status;
    return (
      <ErrorMessage
        message={
          status === 404
            ? 'This group no longer exists.'
            : status === 403
              ? "You don't have permission to view user groups."
              : 'Failed to load the group.'
        }
        retry={status === 404 || status === 403 ? undefined : refetch}
      />
    );
  }

  const activeMembers = group.members.filter((m) => m.status === 'active').length;

  const toggleActive = () => {
    const deactivate = group.isActive;
    openConfirm({
      title: deactivate ? `Deactivate "${group.name}"?` : `Reactivate "${group.name}"?`,
      message: deactivate
        ? 'Documents can’t be routed to a stage assigned to an inactive group, and members can’t be added. Its members and history stay. You can reactivate it later.'
        : 'Stages assigned to this group can receive documents again.',
      confirmLabel: deactivate ? 'Deactivate' : 'Reactivate',
      danger: deactivate,
      onConfirm: () =>
        updateGroup
          .mutateAsync({ groupId, input: { isActive: !deactivate } })
          .then(() => addToast(deactivate ? 'Group deactivated' : 'Group reactivated', 'info'))
          .catch((err) => {
            addToast(userGroupErrorMessage(err, 'The group could not be changed.'), 'error');
            throw err;
          }),
    });
  };

  const handleRemove = (m: UserGroupMember) =>
    openConfirm({
      title: `Remove ${m.name} from "${group.name}"?`,
      message:
        'They stop receiving this group’s tasks, including ones open now. Tasks they already completed keep their name.',
      confirmLabel: 'Remove',
      danger: true,
      onConfirm: () => removeMember.mutateAsync({ groupId, userId: m.id }).then(() => {}),
    });

  const handleAdd = () => {
    if (!toAdd.length) return;
    addMembers.mutate(
      { groupId, userIds: toAdd },
      {
        onSuccess: () => {
          setToAdd([]);
          setPickerKey((k) => k + 1);
        },
      },
    );
  };

  const cols: Column<UserGroupMember>[] = [
    {
      key: 'name',
      label: 'Name',
      render: (m) => <span style={{ fontWeight: 600 }}>{m.name}</span>,
    },
    { key: 'email', label: 'Email' },
    {
      key: 'status',
      label: 'Status',
      render: (m) => (
        <span
          className={`badge ${m.status === 'active' ? 'b-status-closed' : 'b-status-pending'}`}
          title={
            m.status === 'active' ? undefined : 'Gets no group tasks until their account is active'
          }
        >
          {titleCase(m.status)}
        </span>
      ),
    },
    {
      key: 'id',
      label: '',
      render: (m) =>
        canManage ? (
          <button
            className="btn btn-secondary btn-sm"
            aria-label={`Remove ${m.name}`}
            disabled={removeMember.isPending}
            onClick={() => handleRemove(m)}
          >
            Remove
          </button>
        ) : null,
    },
  ];

  return (
    <div>
      <div className="mb-2">
        <Link href="/admin/user-groups" className="caption">
          ← User Groups
        </Link>
      </div>
      <div className="page-head">
        <div>
          <div className="page-title flex items-center gap-2">
            {group.name}
            <span className={`badge ${group.isActive ? 'b-status-closed' : 'b-status-pending'}`}>
              {group.isActive ? 'Active' : 'Inactive'}
            </span>
          </div>
          <div className="page-sub">
            {group.description || 'No description.'} · Created {fmtDate(group.createdAt)}
            {creator?.name ? ` by ${creator.name}` : ''}
          </div>
        </div>
        {canManage && (
          <div className="actions">
            <button
              className="btn btn-secondary"
              onClick={() => router.push(`/admin/user-groups/${groupId}/edit`)}
            >
              <Icon name="edit" size={14} /> Edit
            </button>
            <button
              className={`btn ${group.isActive ? 'btn-secondary' : 'btn-primary'}`}
              onClick={toggleActive}
              disabled={updateGroup.isPending}
            >
              {group.isActive ? 'Deactivate' : 'Reactivate'}
            </button>
          </div>
        )}
      </div>

      {!canManage && (
        <div className="banner info mb-4">
          Only the person who created this group, or an admin with global scope, can change it.
        </div>
      )}
      {group.isActive && activeMembers === 0 && (
        <div className="banner warning mb-4">
          No active members: a document routed to a stage assigned to this group is refused until
          someone active is added. Members also need permission to act on tasks.
        </div>
      )}

      {canManage && group.isActive && (
        <div className="card mb-4">
          <div className="card-head">
            <span className="h3">Add members</span>
          </div>
          <div className="card-body">
            <div className="flex gap-2 items-start flex-wrap">
              <div style={{ flex: '1 1 320px' }}>
                <UserMultiPicker
                  key={pickerKey}
                  value={toAdd}
                  onChange={(ids) => setToAdd(ids.slice(0, MAX_ADD))}
                  filters={{ status: 'active' }}
                  excludeIds={group.members.map((m) => m.id)}
                  ariaLabel="People to add"
                />
              </div>
              <button
                className="btn btn-primary"
                onClick={handleAdd}
                disabled={!toAdd.length || addMembers.isPending}
              >
                {addMembers.isPending && <span className="btn-spinner" aria-hidden="true" />}
                Add{toAdd.length ? ` ${toAdd.length}` : ''}
              </button>
            </div>
            <div className="help">
              Active users only. Only members whose role can act on tasks receive the group’s work.
            </div>
          </div>
        </div>
      )}

      <div className="card">
        <div className="card-head">
          <span className="h3">
            {group.members.length} member{group.members.length === 1 ? '' : 's'}
          </span>
        </div>
        {group.members.length ? (
          <Table cols={cols} rows={group.members} />
        ) : (
          <div className="empty-state" style={{ padding: '32px' }}>
            Nobody is in this group yet.
          </div>
        )}
      </div>
    </div>
  );
}
