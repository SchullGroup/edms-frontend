'use client';

import React, { use, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useUIStore } from '@/store/useUIStore';
import {
  useUpdateUserGroup,
  useUserGroup,
  userGroupErrorMessage,
} from '@/apis/hooks/useUserGroups';
import { UserGroupForm } from '@/components/userGroups/UserGroupForm';
import { useCanManageUserGroup } from '@/components/userGroups/useCanManageUserGroup';
import { SkeletonPage } from '@/components/common/Skeleton';
import type { UserGroupInput } from '@/types/models';
import { ErrorMessage } from '@/components/common/ErrorMessage';

/** Renames a user group or changes its description. Its own page, not a modal. */
export default function EditUserGroupPage({ params }: { params: Promise<{ groupId: string }> }) {
  const { groupId } = use(params);
  const router = useRouter();
  const { setPageTitle, addToast } = useUIStore();
  const { data: group, isLoading, isError, error, refetch } = useUserGroup(groupId);
  const updateGroup = useUpdateUserGroup();
  const canManage = useCanManageUserGroup(group);
  const back = () => router.push(`/admin/user-groups/${groupId}`);

  useEffect(() => {
    setPageTitle('Edit user group');
  }, [setPageTitle]);

  if (isLoading) return <SkeletonPage />;
  if (isError || !group) {
    const notFound = (error as any)?.response?.status === 404;
    return (
      <ErrorMessage
        message={notFound ? 'This group no longer exists.' : 'Failed to load the group.'}
        retry={notFound ? undefined : refetch}
      />
    );
  }

  return (
    <div>
      <div className="page-head">
        <div>
          <div className="page-title">Edit {group.name}</div>
          <div className="page-sub">Workflow stages keep pointing at the group after a rename.</div>
        </div>
      </div>
      {canManage ? (
        <UserGroupForm
          initial={{ name: group.name, description: group.description }}
          submitLabel="Save changes"
          pending={updateGroup.isPending}
          onSubmit={async (input) => {
            const changes: Partial<UserGroupInput> = {};
            if (input.name !== group.name) changes.name = input.name;
            if (
              (input.description ?? null) !== group.description &&
              input.description !== undefined
            )
              changes.description = input.description;
            if (Object.keys(changes).length) {
              await updateGroup.mutateAsync({ groupId, input: changes });
              addToast('Group updated', 'success');
            }
            back();
          }}
          onCancel={back}
          errorMessage={(err) => userGroupErrorMessage(err, 'The group could not be saved.')}
        />
      ) : (
        <div className="banner warning" style={{ maxWidth: 640 }}>
          Only the person who created this group, or an admin with global scope, can change it.
        </div>
      )}
    </div>
  );
}
