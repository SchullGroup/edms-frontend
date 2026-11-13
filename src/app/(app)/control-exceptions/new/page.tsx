'use client';

import React, { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useUIStore } from '@/store/useUIStore';
import { useCreateControlException } from '@/apis/hooks/useControlExceptions';
import { ControlExceptionForm } from '@/components/controlExceptions/ControlExceptionForm';

/** Raises an exception as `open`; reporting it to management is a step on its page. */
export default function NewControlExceptionPage() {
  const router = useRouter();
  const { setPageTitle } = useUIStore();
  const createException = useCreateControlException();

  useEffect(() => {
    setPageTitle('Raise finding');
  }, [setPageTitle]);

  return (
    <div>
      <div className="page-head">
        <div>
          <div className="page-title">Raise an audit finding</div>
          <div className="page-sub">Saved as open. You can still edit it until you report it.</div>
        </div>
      </div>
      <ControlExceptionForm
        submitLabel="Raise finding"
        onCancel={() => router.push('/control-exceptions')}
        onSubmit={async (values) => {
          const created = await createException.mutateAsync(values);
          router.push(`/control-exceptions/${created.id}`);
        }}
      />
    </div>
  );
}
