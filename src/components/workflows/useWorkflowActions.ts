'use client';

import { useStore } from '@/store/useStore';
import { useUIStore } from '@/store/useUIStore';
import {
  useArchiveWorkflow,
  useCreateWorkflow,
  useCreateWorkflowVersion,
  useDeleteWorkflow,
  useUnarchiveWorkflow,
} from '@/apis/hooks/useWorkflows';
import type { WorkflowDefinition } from '@/types/models';

/** Why Unarchive would 409: the backend reactivates only the family's latest version, and
 *  only while none is published. Null when it's allowed or the versions aren't known yet. */
export function unarchiveBlockedReason(
  wf: WorkflowDefinition,
  latestVersion: number | undefined,
  publishedVersion: number | null | undefined,
): string | null {
  if (wf.status !== 'archived') return null;
  if (latestVersion !== undefined && latestVersion > wf.version)
    return `Only the latest version can be unarchived — v${latestVersion} is newer`;
  if (publishedVersion != null) return `v${publishedVersion} is already active`;
  return null;
}

/** Clone, new version, archive, unarchive and delete for one workflow, with their confirms;
 *  shared by the workflow list and the designer. */
export function useWorkflowActions() {
  const { auditAction } = useStore();
  const { openConfirm } = useUIStore();
  const createMutation = useCreateWorkflow();
  const versionMutation = useCreateWorkflowVersion();
  const archiveMutation = useArchiveWorkflow();
  const unarchiveMutation = useUnarchiveWorkflow();
  const deleteMutation = useDeleteWorkflow();

  const clone = (wf: WorkflowDefinition, onCloned?: (id: string) => void) => {
    const copy = {
      name: wf.name + ' (copy)',
      description: 'Cloned from ' + wf.name,
      definition: wf.definition,
    };
    createMutation.mutate(copy, {
      onSuccess: (data) => {
        auditAction('WORKFLOW_CLONE', data.id, 'Cloned from ' + wf.name);
        onCloned?.(data.id);
      },
    });
  };

  // Only from the latest version, and only a published one (409 otherwise).
  const newVersion = (wf: WorkflowDefinition, onCreated?: (id: string) => void) => {
    versionMutation.mutate(wf.id, {
      onSuccess: (data) => {
        auditAction('WORKFLOW_VERSION', data.id, `Created v${data.version} of ${wf.name}`);
        onCreated?.(data.id);
      },
    });
  };

  // Only a published workflow can be archived; it stays reversible with Unarchive.
  const archive = (wf: WorkflowDefinition) => {
    openConfirm({
      title: `Archive "${wf.name}"?`,
      message:
        'It can no longer be routed to for new documents. Files already in flight are unaffected. You can unarchive it later from the Archived tab.',
      confirmLabel: 'Archive',
      danger: true,
      onConfirm: () =>
        archiveMutation.mutateAsync(wf.id).then(() => {
          auditAction('WORKFLOW_ARCHIVE', wf.id, `Archived ${wf.name}`);
        }),
    });
  };

  const unarchive = (wf: WorkflowDefinition) => unarchiveMutation.mutate(wf.id);

  // Only a draft can be deleted, and the backend also refuses one that was ever started (409).
  const remove = (wf: WorkflowDefinition, onDeleted?: () => void) => {
    openConfirm({
      title: `Delete "${wf.name}"?`,
      message:
        "This draft has never been published, so it's deleted for good. This can't be undone.",
      confirmLabel: 'Delete draft',
      danger: true,
      onConfirm: () => deleteMutation.mutateAsync(wf.id).then(() => onDeleted?.()),
    });
  };

  return {
    clone,
    newVersion,
    archive,
    unarchive,
    remove,
    cloning: createMutation.isPending,
    versioning: versionMutation.isPending,
    archiving: archiveMutation.isPending,
    unarchiving: unarchiveMutation.isPending,
    deleting: deleteMutation.isPending,
  };
}
