'use client';

import React, { useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useUIStore } from '@/store/useUIStore';
import { usePermissions } from '@/hooks/usePermissions';
import { useUserGroups } from '@/apis/hooks/useUserGroups';
import { useUsersByIds } from '@/apis/hooks/useUsers';
import { Table, Column } from '@/components/ui/Table';
import { Icon } from '@/components/ui/Icons';
import { SkeletonTable } from '@/components/common/Skeleton';
import { ErrorMessage } from '@/components/common/ErrorMessage';
import type { UserGroup } from '@/types/models';
import { fmtDate } from '@/utils/helpers';

/** User groups (`/user-groups`): named sets of people a workflow stage can be assigned to. */
export default function UserGroupsPage() {
  const router = useRouter();
  const { setPageTitle } = useUIStore();
  const { can } = usePermissions();
  const canCreate = can('workflow', 'create');

  const { data: groups = [], isLoading, isError, error, refetch } = useUserGroups();
  const { users } = useUsersByIds(groups.map((g) => g.createdBy));

  useEffect(() => {
    setPageTitle('User Groups');
  }, [setPageTitle]);

  const cols: Column<UserGroup>[] = [
    {
      key: 'name',
      label: 'Group',
      render: (g) => (
        <div>
          <Link
            href={`/admin/user-groups/${g.id}`}
            style={{ fontWeight: 600 }}
            onClick={(e) => e.stopPropagation()}
          >
            {g.name}
          </Link>
          {g.description && (
            <div className="caption" style={{ marginTop: 2 }}>
              {g.description}
            </div>
          )}
        </div>
      ),
    },
    {
      key: 'isActive',
      label: 'Status',
      render: (g) => (
        <span className={`badge ${g.isActive ? 'b-status-closed' : 'b-status-pending'}`}>
          {g.isActive ? 'Active' : 'Inactive'}
        </span>
      ),
    },
    {
      key: '_count',
      label: 'Members',
      render: (g) => g._count.members,
    },
    {
      key: 'createdBy',
      label: 'Created by',
      render: (g) => users.get(g.createdBy)?.name ?? '—',
    },
    { key: 'createdAt', label: 'Created', render: (g) => fmtDate(g.createdAt) },
  ];

  const status = (error as any)?.response?.status;

  return (
    <div>
      <div className="page-head">
        <div>
          <div className="page-title">User Groups</div>
          <div className="page-sub">
            A workflow stage assigned to a group goes to every active member, and whoever acts first
            handles it. Assign stages to a group in the Workflow Designer.
          </div>
        </div>
        {canCreate && (
          <div className="actions">
            <button
              className="btn btn-primary"
              onClick={() => router.push('/admin/user-groups/new')}
            >
              <Icon name="plus" size={14} /> New group
            </button>
          </div>
        )}
      </div>

      <div className="card">
        <div className="card-head">
          <span className="h3">
            {groups.length} group{groups.length === 1 ? '' : 's'}
          </span>
        </div>
        {isLoading ? (
          <SkeletonTable
            columns={['Group', 'Status', 'Members', 'Created by', 'Created']}
            rows={3}
          />
        ) : isError ? (
          <ErrorMessage
            message={
              status === 403
                ? "You don't have permission to view user groups."
                : 'Failed to load user groups.'
            }
            retry={status === 403 ? undefined : refetch}
          />
        ) : groups.length === 0 ? (
          <div className="empty-state" style={{ padding: '32px' }}>
            No groups yet.{canCreate && ' Create one, add people to it, then assign a stage to it.'}
          </div>
        ) : (
          <Table
            cols={cols}
            rows={groups}
            onRow={(g) => router.push(`/admin/user-groups/${g.id}`)}
          />
        )}
        {groups.length >= 100 && (
          <p className="caption" style={{ padding: '0 20px 12px' }}>
            Only the 100 newest groups are listed.
          </p>
        )}
      </div>
    </div>
  );
}
