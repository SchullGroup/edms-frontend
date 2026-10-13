'use client';

import { useWorkflows } from '@/apis/hooks/useWorkflows';
import { useStartWorkflowInstance } from '@/apis/hooks/useWorkflowInstances';
import { useCreateAuditLog } from '@/apis/hooks/useAudit';
import { useUIStore } from '@/store/useUIStore';
import { usePermissions } from '@/hooks/usePermissions';

export interface RoutableDocument {
  id: string;
  title?: string;
  /** The document's own status, when the caller has it. `in_progress` and
   *  `on_hold` mean it's already in a running workflow (the backend keeps the
   *  two in step), possibly one the user can't see. */
  status?: string | null;
}

const IN_WORKFLOW_STATUSES = ['in_progress', 'on_hold'];

/**
 * The single "put this document into a workflow" entry point, shared by the
 * cabinet browser, the document workspace and the upload screen. Documents
 * routed together go into ONE workflow, each with its own progress through it.
 *
 * Only *published* definitions are offered — a draft has no runnable stages and
 * an archived one is deliberately out of circulation, so routing to either is a
 * guaranteed backend rejection.
 */
export function useRouteToWorkflow() {
  const { can } = usePermissions();
  // Routing is two calls: create the workflow (`workflow_instance:create`), then
  // start it (`workflow_instance:route`). Holding only the first would leave a
  // workflow stuck in "pending" with no task, so every entry point needs both.
  const canRoute = can('workflow_instance', 'create') && can('workflow_instance', 'route');
  const { data, isLoading } = useWorkflows();
  const { mutateAsync: startWorkflow } = useStartWorkflowInstance();
  const createAuditLog = useCreateAuditLog();
  const { openModal, addToast } = useUIStore();

  const publishedWorkflows = (data?.data || []).filter((w) => w.status === 'published');

  const routeDocuments = (requested: RoutableDocument[], opts?: { onSuccess?: () => void }) => {
    if (requested.length === 0) return;
    if (!canRoute) {
      addToast("You don't have permission to route documents to a workflow", 'error');
      return;
    }
    // A document already moving through a workflow isn't routed into another.
    const alreadyRouted = requested.filter((d) => IN_WORKFLOW_STATUSES.includes(d.status ?? ''));
    const docs = requested.filter((d) => !alreadyRouted.includes(d));
    if (docs.length === 0) {
      addToast(
        alreadyRouted.length === 1
          ? 'That document is already in a workflow'
          : 'Those documents are already in workflows',
        'error',
      );
      return;
    }

    let selected = publishedWorkflows[0]?.id || '';
    const label =
      docs.length === 1
        ? `“${(docs[0].title || docs[0].id).slice(0, 44)}”`
        : `${docs.length} documents`;

    openModal({
      title: `Route ${label} to a workflow`,
      body: (
        <div>
          {publishedWorkflows.length === 0 ? (
            <div className="banner warning" style={{ marginBottom: 0 }}>
              No published workflows. A workflow has to be published in the Workflow Designer
              before anything can be routed to it.
            </div>
          ) : (
            <>
              <div className="field">
                <label>Workflow</label>
                <select
                  className="input"
                  defaultValue={selected}
                  onChange={(e) => (selected = e.target.value)}
                >
                  {publishedWorkflows.map((w) => (
                    <option key={w.id} value={w.id}>
                      {w.name} (v{w.version})
                    </option>
                  ))}
                </select>
                {alreadyRouted.length > 0 && (
                  <div className="banner info" style={{ marginBottom: 10 }}>
                    {alreadyRouted.length === 1
                      ? '1 selected document is already in a workflow and is left out.'
                      : `${alreadyRouted.length} selected documents are already in workflows and are left out.`}
                  </div>
                )}
                <div className="help">
                  {docs.length > 1 ? `All ${docs.length} documents go into one workflow. ` : ''}
                  The first stage opens immediately and a task is raised for whoever that stage is
                  assigned to.
                </div>
              </div>
            </>
          )}
        </div>
      ),
      actions: [
        { label: 'Cancel' },
        {
          label: docs.length > 1 ? `Route ${docs.length} documents` : 'Route',
          kind: 'btn-primary',
          disabled: publishedWorkflows.length === 0,
          onClick: async () => {
            if (!selected) {
              addToast('Select a workflow first', 'error');
              return false;
            }
            const wfName = publishedWorkflows.find((w) => w.id === selected)?.name || 'workflow';
            try {
              await startWorkflow({ workflowId: selected, documentIds: docs.map((d) => d.id) });
              docs.forEach((d) =>
                createAuditLog.mutate({
                  action: 'WORKFLOW_START',
                  target: d.id,
                  detail: `Routed to “${wfName}”`,
                }),
              );
              addToast(
                docs.length > 1
                  ? `${docs.length} documents routed to ${wfName} as one workflow`
                  : `Routed to ${wfName}`,
                'success',
              );
              opts?.onSuccess?.();
            } catch (err: any) {
              addToast(err?.response?.data?.message || 'Failed to route', 'error');
              return false;
            }
          },
        },
      ],
    });
  };

  return { routeDocuments, canRoute, publishedWorkflows, isLoading };
}
