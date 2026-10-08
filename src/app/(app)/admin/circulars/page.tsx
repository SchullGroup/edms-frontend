'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { SkeletonPage } from '@/components/common/Skeleton';

/**
 * Circular management moved to `/circulars/manage`: supervisors and
 * management author and publish circulars too, and they can't enter the admin
 * portal. This keeps old links and bookmarks working.
 */
export default function AdminCircularsRedirect() {
  const router = useRouter();

  useEffect(() => {
    router.replace('/circulars/manage');
  }, [router]);

  return <SkeletonPage columns={['Circular', 'Status', 'When', 'Recipients']} rows={6} />;
}
