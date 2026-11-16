'use client';

import {
  useCloseWorkflowInstance,
  useHoldWorkflowInstance,
  useResumeWorkflowInstance,
} from '@/apis/hooks/useWorkflowInstances';
import { useUIStore } from '@/store/useUIStore';
import type { WorkflowInstance } from '@/types/models';
import { instanceTitle } from '@/utils/workflowDocuments';

type InstanceLike = Pick<WorkflowInstance, 'id' | 'documents'>;

const titleOf = (i: InstanceLike) => instanceTitle(i);

/** Hold / resume / close for a running instance, with their confirmations. Shared by
 *  the monitor's rows and the instance drawer; the backend audits each one. */
export function useWorkflowInstanceLifecycle() {
  const hold = useHoldWorkflowInstance();
  const resume = useResumeWorkflowInstance();
  const close = useCloseWorkflowInstance();
  const { openConfirm, addToast } = useUIStore();

  const isPending = hold.isPending || resume.isPending || close.isPending;

  const confirmHold = (instance: InstanceLike) =>
    openConfirm({
      title: 'Put this workflow on hold?',
      message: `“${titleOf(instance)}” stops advancing and its assignee can't act on it until someone resumes it. The stage SLA keeps its original due date.`,
      confirmLabel: 'Put on hold',
      onConfirm: async () => {
        await hold.mutateAsync({ id: instance.id });
        addToast('Workflow put on hold', 'warning');
      },
    });

  const confirmResume = (instance: InstanceLike) =>
    openConfirm({
      title: 'Resume this workflow?',
      message: `“${titleOf(instance)}” goes back to its current stage and the assignee can act on it again.`,
      confirmLabel: 'Resume',
      onConfirm: async () => {
        await resume.mutateAsync(instance.id);
        addToast('Workflow resumed', 'success');
      },
    });

  const confirmClose = (instance: InstanceLike) =>
    openConfirm({
      title: 'Close this workflow?',
      message: `Any remaining stages on “${titleOf(instance)}” are skipped and its documents are finalised. This can't be undone — the file would have to be routed again from scratch.`,
      confirmLabel: 'Close workflow',
      danger: true,
      onConfirm: async () => {
        await close.mutateAsync(instance.id);
        addToast('Workflow closed', 'success');
      },
    });

  return { confirmHold, confirmResume, confirmClose, isPending };
}
