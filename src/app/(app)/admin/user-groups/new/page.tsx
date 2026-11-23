'use client';

import React, { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useUIStore } from '@/store/useUIStore';
import { useCreateUserGroup, userGroupErrorMessage } from '@/apis/hooks/useUserGroups';
import { UserGroupForm } from '@/components/userGroups/UserGroupForm';

/** Creates a user group, then opens it to add members. Its own page, not a modal. */
export default function NewUserGroupPage() {
  const router = useRouter();
  const { setPageTitle } = useUIStore();
  const createGroup = useCreateUserGroup();

  useEffect(() => {
    setPageTitle('New user group');
  }, [setPageTitle]);

  return (
    <div>
      <div className="page-head">
        <div>
          <div className="page-title">New user group</div>
          <div className="page-sub">
            Add members on the next page. A workflow stage assigned to the group goes to all of
            them, and whoever acts first handles it.
          </div>
        </div>
      </div>
      <UserGroupForm
        submitLabel="Create group"
        pending={createGroup.isPending}
        onSubmit={async (input) => {
          const group = await createGroup.mutateAsync(input);
          router.push(`/admin/user-groups/${group.id}`);
        }}
        onCancel={() => router.push('/admin/user-groups')}
        errorMessage={(err) => userGroupErrorMessage(err, 'The group could not be created.')}
      />
    </div>
  );
}
