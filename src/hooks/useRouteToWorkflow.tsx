'use client';

import { useWorkflows } from '@/apis/hooks/useWorkflows';
import { useStartWorkflowInstance } from '@/apis/hooks/useWorkflowInstances';
import { useCreateAuditLog } from '@/apis/hooks/useAudit';
import { useUIStore } from '@/store/useUIStore';
import { usePermissions } from '@/hooks/usePermissions';

export interface RoutableDocument {
  id: string;
  title?: string;
}

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

  const routeDocuments = (docs: RoutableDocument[], opts?: { onSuccess?: () => void }) => {
    if (docs.length === 0) return;
    if (!canRoute) {
      addToast("You don't have permission to route documents to a workflow", 'error');
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
