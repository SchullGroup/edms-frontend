'use client';

import React, { useState } from 'react';
import { useWorkflows } from '@/apis/hooks/useWorkflows';
import { usersService } from '@/apis/services/users.service';
import { UserPicker } from '@/components/common/UserPicker';
import { useMyDepartmentId } from '@/hooks/useMyDepartmentId';
import type { WorkflowDefinition, WorkflowDefinitionJson } from '@/types/models';
import { useStartWorkflowInstance } from '@/apis/hooks/useWorkflowInstances';
import { useCreateAuditLog } from '@/apis/hooks/useAudit';
import { useUIStore } from '@/store/useUIStore';
import { usePermissions } from '@/hooks/usePermissions';
import { useStore } from '@/store/useStore';

export interface RoutableDocument {
  id: string;
  title?: string;
  /** The document's own status, when the caller has it. `in_progress` and
   *  `on_hold` mean it's already in a running workflow (the backend keeps the
   *  two in step), possibly one the user can't see. */
  status?: string | null;
  /** Who uploaded it, when the caller has it: at `own` scope only the uploader
   *  may route a document. */
  createdBy?: string | null;
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
  const { scopeFor } = usePermissions();
  const { currentUser } = useStore();
  const createScope = scopeFor('workflow_instance', 'create');
  const { departmentId: myDepartmentId } = useMyDepartmentId();
  // The backend accepts anyone at `global` scope, the same department at
  // `department`, and only yourself at `own`; a picker also needs `user:view`.
  const canViewUsers = can('user', 'view');
  const canPickSubmitter = createScope !== 'own' && canViewUsers;

  /**
   * Whether the backend lets the caller start a workflow on this document
   * (`instances.service.ts` `create`): any document at `global` scope, only
   * documents they uploaded at `own` (staff, management, auditors). At
   * `department` scope it wants the document's cabinet in the caller's
   * department; that's left to the backend. Unknown uploader: allowed.
   */
  const mayRouteDocument = (doc: Pick<RoutableDocument, 'createdBy'>) =>
    canRoute &&
    (createScope !== 'own' || !doc.createdBy || doc.createdBy === currentUser?.id);
  // Ask for published ones: the first default page mixes in archived and drafts.
  const { data, isLoading } = useWorkflows({ status: 'published', limit: 100 });
  const { mutateAsync: startWorkflow } = useStartWorkflowInstance();
  const createAuditLog = useCreateAuditLog();
  const { openModal, addToast } = useUIStore();

  const publishedWorkflows = data?.data || [];

  const routeDocuments = (requested: RoutableDocument[], opts?: { onSuccess?: () => void }) => {
    if (requested.length === 0) return;
    if (!canRoute) {
      addToast("You don't have permission to route documents to a workflow", 'error');
      return;
    }
    // A document already moving through a workflow isn't routed into another,
    // and at `own` scope one someone else uploaded can't be routed at all.
    const alreadyRouted = requested.filter((d) => IN_WORKFLOW_STATUSES.includes(d.status ?? ''));
    const notMine = requested.filter((d) => !alreadyRouted.includes(d) && !mayRouteDocument(d));
    const docs = requested.filter((d) => !alreadyRouted.includes(d) && !notMine.includes(d));
    if (docs.length === 0) {
      addToast(
        notMine.length > 0
          ? notMine.length === 1 && alreadyRouted.length === 0
            ? 'You can only route documents you uploaded'
            : 'None of these can be routed: you can only route documents you uploaded, and not ones already in a workflow'
          : alreadyRouted.length === 1
            ? 'That document is already in a workflow'
            : 'Those documents are already in workflows',
        'error',
      );
      return;
    }

    const choice: RouteChoice = {
      workflowId: publishedWorkflows[0]?.id || '',
      submitterId: currentUser?.id || '',
    };
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
            <RouteWorkflowFields
              workflows={publishedWorkflows}
              initial={choice}
              meName={currentUser?.name || 'You'}
              canPickSubmitter={canPickSubmitter}
              submitterDepartmentId={createScope === 'department' ? myDepartmentId : null}
              onChange={(next) => Object.assign(choice, next)}
            >
              {alreadyRouted.length > 0 && (
                <div className="banner info" style={{ marginBottom: 10 }}>
                  {alreadyRouted.length === 1
                    ? '1 selected document is already in a workflow and is left out.'
                    : `${alreadyRouted.length} selected documents are already in workflows and are left out.`}
                </div>
              )}
              {notMine.length > 0 && (
                <div className="banner info" style={{ marginBottom: 10 }}>
                  {notMine.length === 1
                    ? '1 selected document was uploaded by someone else and is left out: you can only route documents you uploaded.'
                    : `${notMine.length} selected documents were uploaded by someone else and are left out: you can only route documents you uploaded.`}
                </div>
              )}
              <div className="help">
                {docs.length > 1 ? `All ${docs.length} documents go into one workflow. ` : ''}
                The first stage opens immediately and a task is raised for whoever that stage is
                assigned to.
              </div>
            </RouteWorkflowFields>
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
            const selected = choice.workflowId;
            if (!selected) {
              addToast('Select a workflow first', 'error');
              return false;
            }
            const workflow = publishedWorkflows.find((w) => w.id === selected);
            const wfName = workflow?.name || 'workflow';
            const submitterId = needsSubmitter(workflow) ? choice.submitterId : undefined;
            if (needsSubmitter(workflow) && !submitterId) {
              addToast('Pick who this is submitted for', 'error');
              return false;
            }
            const isMe = submitterId === currentUser?.id;
            // Checked first where we can: a failed start leaves a pending workflow behind.
            if (submitterId && canViewUsers) {
              const submitter = await usersService.getById(submitterId).catch(() => null);
              if (submitter && !submitter.managerId) {
                addToast(noManagerMessage(isMe ? null : submitter.name, wfName), 'error');
                return false;
              }
            }
            try {
              await startWorkflow({
                workflowId: selected,
                documentIds: docs.map((d) => d.id),
                submitterId,
              });
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
              const { code, message } = err?.response?.data ?? {};
              addToast(
                code === 'WORKFLOW_ASSIGNEE_INVALID' && /manager/i.test(message ?? '')
                  ? noManagerMessage(isMe ? null : 'The person it is submitted for', wfName)
                  : message || 'Failed to route',
                'error',
              );
              return false;
            }
          },
        },
      ],
    });
  };

  return { routeDocuments, canRoute, mayRouteDocument, publishedWorkflows, isLoading };
}

interface RouteChoice {
  workflowId: string;
  submitterId: string;
}

/** A stage goes to the submitter's manager, so routing must name a submitter (PR #62). */
export const needsSubmitter = (workflow?: { definition?: WorkflowDefinitionJson | null }) =>
  !!workflow?.definition?.stages?.some((s) => s.dynamic_assignee === 'submitter_manager');

/** `name` null means the person routing it. */
const noManagerMessage = (name: string | null, workflowName: string) =>
  `${name ? `${name} has` : 'You have'} no manager set, so ${workflowName} has no one to send ` +
  `the submitter's-manager stage to. Ask an administrator to set who ${name ? 'they report' : 'you report'} to in Users.`;

/** The modal's fields. Holds its own state because `openModal` freezes its body. */
function RouteWorkflowFields({
  workflows,
  initial,
  meName,
  canPickSubmitter,
  submitterDepartmentId,
  onChange,
  children,
}: {
  workflows: WorkflowDefinition[];
  initial: RouteChoice;
  meName: string;
  canPickSubmitter: boolean;
  submitterDepartmentId: string | null;
  onChange: (choice: RouteChoice) => void;
  children?: React.ReactNode;
}) {
  const [choice, setChoice] = useState(initial);
  const update = (patch: Partial<RouteChoice>) => {
    const next = { ...choice, ...patch };
    setChoice(next);
    onChange(next);
  };
  const workflow = workflows.find((w) => w.id === choice.workflowId);

  return (
    <>
      <div className="field">
        <label>Workflow</label>
        <select
          className="input"
          value={choice.workflowId}
          onChange={(e) => update({ workflowId: e.target.value })}
        >
          {workflows.map((w) => (
            <option key={w.id} value={w.id}>
              {w.name}
            </option>
          ))}
        </select>
        {children}
      </div>
      {needsSubmitter(workflow) && (
        <div className="field">
          <label>Submitted for</label>
          {canPickSubmitter ? (
            <UserPicker
              value={choice.submitterId}
              onChange={(submitterId) => update({ submitterId })}
              filters={{
                status: 'active',
                ...(submitterDepartmentId ? { departmentId: submitterDepartmentId } : {}),
              }}
              ariaLabel="Submitted for"
            />
          ) : (
            <div style={{ fontWeight: 600 }}>{meName} (you)</div>
          )}
          <div className="help">
            {canPickSubmitter
              ? "A stage in this workflow goes to this person's manager."
              : 'A stage in this workflow goes to your manager.'}
          </div>
        </div>
      )}
    </>
  );
}
