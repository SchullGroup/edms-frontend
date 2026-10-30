'use client';

import React, { use, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useUIStore } from '@/store/useUIStore';
import { usePermissions } from '@/hooks/usePermissions';
import { useControlException, useUpdateControlException } from '@/apis/hooks/useControlExceptions';
import { ErrorMessage } from '@/components/common/ErrorMessage';
import { SkeletonPage } from '@/components/common/Skeleton';
import { ControlExceptionForm } from '@/components/controlExceptions/ControlExceptionForm';

/** Edits an exception while it is still `open`; once reported it is read-only. */
export default function EditControlExceptionPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const { setPageTitle } = useUIStore();
  const { hasPermission } = usePermissions();
  const { data: ce, isLoading, isError, refetch } = useControlException(id);
  const updateException = useUpdateControlException();

  useEffect(() => {
    setPageTitle('Edit exception');
  }, [setPageTitle]);

  if (isLoading) return <SkeletonPage columns={['Field', 'Value']} rows={6} />;
  if (isError || !ce) {
    return <ErrorMessage message="Failed to load this exception." retry={() => refetch()} />;
  }

  const back = `/control-exceptions/${id}`;
  if (ce.status !== 'open' || !hasPermission('control_exception', 'edit')) {
    return (
      <div className="card">
        <div className="card-body">
          <p>
            {ce.status !== 'open'
              ? 'This exception has been reported to the permanent secretary, so it can no longer be edited.'
              : "You don't have permission to edit control exceptions."}
          </p>
          <Link href={back} className="btn btn-secondary btn-sm mt-2">
            Back to the exception
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div>
      <div className="page-head">
        <div>
          <div className="page-title">Edit exception</div>
          <div className="page-sub">{ce.title}</div>
        </div>
      </div>
      <ControlExceptionForm
        initial={ce}
        submitLabel="Save changes"
        onCancel={() => router.push(back)}
        onSubmit={async (values) => {
          await updateException.mutateAsync({ id, data: values });
          router.push(back);
        }}
      />
    </div>
  );
}
