'use client';

import { use, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useTask } from '@/apis/hooks/useTasks';
import { SkeletonPage } from '@/components/common/Skeleton';
import { ErrorMessage } from '@/components/common/ErrorMessage';

/**
 * Landing point for the backend's `/tasks/:id` notification links (task
 * assigned, delegated, SLA warning/breach…). Tasks are worked on the workflow
 * page, so this resolves the task's workflow and forwards there, keeping the
 * task id so that page focuses on it.
 */
export default function TaskLink({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const { data: task, isError, refetch } = useTask(id);
  const instanceId = task?.workflowInstanceId;

  useEffect(() => {
    if (instanceId) router.replace(`/workflow-instances/${instanceId}?task=${id}`);
  }, [instanceId, id, router]);

  if (isError || (task && !instanceId)) {
    return (
      <ErrorMessage
        message="This task couldn't be opened — it may have been reassigned or you may no longer have access to it."
        retry={() => refetch()}
      />
    );
  }
  return <SkeletonPage charts={2} />;
}
