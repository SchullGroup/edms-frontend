'use client';

import React, { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useUIStore } from '@/store/useUIStore';
import { useCreateControlException } from '@/apis/hooks/useControlExceptions';
import { ControlExceptionForm } from '@/components/controlExceptions/ControlExceptionForm';

/** Raises an exception as `open`; reporting it to the permanent secretary is a step on its page. */
export default function NewControlExceptionPage() {
  const router = useRouter();
  const { setPageTitle } = useUIStore();
  const createException = useCreateControlException();

  useEffect(() => {
    setPageTitle('Raise exception');
  }, [setPageTitle]);

  return (
    <div>
      <div className="page-head">
        <div>
          <div className="page-title">Raise a control exception</div>
          <div className="page-sub">
            Saved as open. You can still edit it until you report it to the permanent secretary.
          </div>
        </div>
      </div>
      <ControlExceptionForm
        submitLabel="Raise exception"
        onCancel={() => router.push('/control-exceptions')}
        onSubmit={async (values) => {
          const created = await createException.mutateAsync(values);
          router.push(`/control-exceptions/${created.id}`);
        }}
      />
    </div>
  );
}
