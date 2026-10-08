'use client';

import React, { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useUIStore } from '@/store/useUIStore';
import { useCreateCircular } from '@/apis/hooks/useCirculars';
import { CircularForm } from '@/components/circulars/CircularForm';
import type { CreateCircularRequest } from '@/types/models';

/** Writes a new circular as a draft; publishing is a separate step on its page. */
export default function NewCircularPage() {
  const router = useRouter();
  const { setPageTitle } = useUIStore();
  const createCircular = useCreateCircular();

  useEffect(() => {
    setPageTitle('New circular');
  }, [setPageTitle]);

  return (
    <div>
      <div className="page-head">
        <div>
          <div className="page-title">New circular</div>
          <div className="page-sub">
            Saved as a draft. You can review it and publish or schedule it on the next screen.
          </div>
        </div>
      </div>
      <CircularForm
        submitLabel="Save draft"
        onCancel={() => router.push('/circulars/manage')}
        onSubmit={async (values) => {
          // The form only emits null dates when editing, so this is a valid create body.
          const created = await createCircular.mutateAsync(values as CreateCircularRequest);
          router.push(`/circulars/manage/${created.id}`);
        }}
      />
    </div>
  );
}
