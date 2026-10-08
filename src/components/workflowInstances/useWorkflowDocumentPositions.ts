'use client';

import { useMemo } from 'react';
import { useWorkflowHistory } from '@/apis/hooks/useWorkflowHistory';
import type { WorkflowDocumentExecution, WorkflowInstance } from '@/types/models';
import { executionsByDocumentFromHistory, isActiveExecution } from '@/utils/workflowDocuments';

export interface WorkflowDocumentPosition {
  /** The workflow-instance-document id. */
  id: string;
  documentId: string;
  title: string;
  urgency?: string;
  /** Still-moving executions — more than one while the document is in parallel branches. */
  active: WorkflowDocumentExecution[];
}

/**
 * Where each of a workflow's documents stands. `GET /workflow-instances/{id}`
 * doesn't return executions, but every workflow-history event about a document
 * embeds that document's execution as it stands now — so the newest events
 * give each document's current stage and deadline. Executions on the instance
 * itself (once the backend returns them) are used as they are.
 *
 * Reads the newest 100 events; a document with no event among them (idle a long
 * time on a busy workflow) comes back with no active position and shows "—".
 */
export function useWorkflowDocumentPositions(
  instance: Pick<WorkflowInstance, 'id' | 'documents'> | undefined,
  scope?: 'mine' | 'all',
) {
  const { data, isLoading } = useWorkflowHistory(
    { workflowInstanceId: instance?.id, limit: 100, order: 'desc', ...(scope ? { scope } : {}) },
    { enabled: !!instance?.id },
  );

  const positions = useMemo<WorkflowDocumentPosition[]>(() => {
    if (!instance) return [];
    const fromHistory = executionsByDocumentFromHistory(data?.data ?? []);
    return (instance.documents ?? []).map((d) => ({
      id: d.id,
      documentId: d.documentId ?? d.document.id,
      title: d.document.title,
      urgency: d.document.urgency,
      active: (d.executions?.length ? d.executions : (fromHistory.get(d.id) ?? [])).filter(
        isActiveExecution,
      ),
    }));
  }, [instance, data]);

  return { positions, isLoading };
}
