'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { SkeletonPage } from '@/components/common/Skeleton';

/** The fixture findings tracker gave way to control exceptions; keeps old links working. */
export default function ManagementFindingsRedirect() {
  const router = useRouter();

  useEffect(() => {
    router.replace('/control-exceptions');
  }, [router]);

  return <SkeletonPage columns={['Exception', 'Severity', 'Status', 'Department']} rows={6} />;
}
