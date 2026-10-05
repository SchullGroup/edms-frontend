'use client';

import {
  useCloseWorkflowInstance,
  useHoldWorkflowInstance,
  useResumeWorkflowInstance,
} from '@/apis/hooks/useWorkflowInstances';
import { useCreateAuditLog } from '@/apis/hooks/useAudit';
import { useUIStore } from '@/store/useUIStore';
import type { WorkflowInstance } from '@/types/models';

type InstanceLike = Pick<WorkflowInstance, 'id' | 'documentId'> & {
  document?: { title?: string } | null;
};

const titleOf = (i: InstanceLike) => i.document?.title || 'this document';

/**
 * Hold / resume / close for a running instance, with the confirmations and
 * audit entries attached. Shared by the monitor's row buttons and the instance
 * drawer so the two can never drift apart.
 *
 * None of these endpoints take a body — a reason can't be persisted against the
 * instance, so it only ever reaches the (tenant) audit log.
 */
export function useWorkflowInstanceLifecycle() {
  const hold = useHoldWorkflowInstance();
  const resume = useResumeWorkflowInstance();
  const close = useCloseWorkflowInstance();
  const createAuditLog = useCreateAuditLog();
  const { openConfirm, addToast } = useUIStore();

  const isPending = hold.isPending || resume.isPending || close.isPending;

  const confirmHold = (instance: InstanceLike) =>
    openConfirm({
      title: 'Put this workflow on hold?',
      message: `“${titleOf(instance)}” stops advancing and its assignee can't act on it until someone resumes it. The stage SLA keeps its original due date.`,
      confirmLabel: 'Put on hold',
      onConfirm: async () => {
        await hold.mutateAsync({ id: instance.id });
        createAuditLog.mutate({
          action: 'WORKFLOW_HOLD',
          target: instance.documentId,
          detail: 'Workflow put on hold',
        });
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
        createAuditLog.mutate({
          action: 'WORKFLOW_RESUME',
          target: instance.documentId,
          detail: 'Workflow resumed',
        });
        addToast('Workflow resumed', 'success');
      },
    });

  const confirmClose = (instance: InstanceLike) =>
    openConfirm({
      title: 'Close this workflow?',
      message: `Any remaining stages on “${titleOf(instance)}” are skipped and the document is finalised. This can't be undone — the file would have to be routed again from scratch.`,
      confirmLabel: 'Close workflow',
      danger: true,
      onConfirm: async () => {
        await close.mutateAsync(instance.id);
        createAuditLog.mutate({
          action: 'WORKFLOW_CLOSE',
          target: instance.documentId,
          detail: 'Workflow force-closed',
        });
        addToast('Workflow closed', 'success');
      },
    });

  return { confirmHold, confirmResume, confirmClose, isPending };
}
