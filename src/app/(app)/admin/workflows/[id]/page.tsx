'use client';

import React, { useState, useEffect, use } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useStore } from '@/store/useStore';
import { useUIStore } from '@/store/useUIStore';
import {
  useWorkflow,
  useUpdateWorkflow,
  usePublishWorkflow,
  useWorkflowVersions,
} from '@/apis/hooks/useWorkflows';
import { useRoles } from '@/apis/hooks/useRoles';
import { useAllUsers } from '@/apis/hooks/useUsers';
import { useDepartments } from '@/apis/hooks/useDepartments';
import { departmentOptions, departmentParents } from '@/apis/utils/managementAggregation';
import { usePermissions } from '@/hooks/usePermissions';
import { Icon } from '@/components/ui/Icons';
import { WorkflowToolbar } from '@/components/workflows/WorkflowToolbar';
import { WorkflowCanvas } from '@/components/workflows/WorkflowCanvas';
import { useAllMetadataFields } from '@/apis/hooks/useMetadataFields';
import { StagePanel, type StageTab } from '@/components/workflows/StagePanel';
import type { AssigneeMode } from '@/components/workflows/StagePropertiesPanel';
import { WorkflowDesignerGuide } from '@/components/workflows/WorkflowDesignerGuide';
import {
  unarchiveBlockedReason,
  useWorkflowActions,
} from '@/components/workflows/useWorkflowActions';
import {
  indexGraph,
  isParallelFork,
  moveStage,
  normalizeJoins,
  reconcileTransitions,
  validateDefinition,
  type MoveDirection,
} from '@/components/workflows/workflowGraph';
import { SkeletonPage } from '@/components/common/Skeleton';
import type {
  WorkflowDefinition,
  WorkflowDefinitionJson,
  WorkflowStage,
  WorkflowStageAction,
} from '@/types/models';

export default function WorkflowDesignerPage({ params }: { params: Promise<{ id: string }> }) {
  const workflowId = use(params).id;
  const router = useRouter();
  const { auditAction } = useStore();
  const { setPageTitle, openConfirm, addToast } = useUIStore();
  const { can } = usePermissions();
  const canCreateWorkflow = can('workflow', 'create');
  const canEditWorkflow = can('workflow', 'edit');
  const canPublishWorkflow = can('workflow', 'publish');
  const canArchiveWorkflow = can('workflow', 'archive');

  const { data: wf, isLoading, error } = useWorkflow(workflowId);
  const { data: versionsResult } = useWorkflowVersions(workflowId);
  const versions = versionsResult?.data || [];
  const { data: roles } = useRoles();
  const { data: usersResult } = useAllUsers();
  const users = usersResult?.items || [];

  const updateWfMutation = useUpdateWorkflow();
  const publishWfMutation = usePublishWorkflow();
  const actions = useWorkflowActions();

  const [selectedStageId, setSelectedStageId] = useState<string | null>(null);
  // Names metadata fields in the canvas's branch labels (same cached query
  // the Transitions tab's rule picker uses).
  const { data: metadataFields } = useAllMetadataFields();
  const [stagePanelTab, setStagePanelTab] = useState<StageTab>('properties');

  // Local drafts: typing is instant and nothing is written until Save. They
  // resync from the server only when the selection changes or a save lands.
  const [nameDraft, setNameDraft] = useState('');
  const [stageNameDraft, setStageNameDraft] = useState('');
  const [assigneeMode, setAssigneeMode] = useState<AssigneeMode>('role');
  const [roleDraft, setRoleDraft] = useState('');
  const [userDraft, setUserDraft] = useState('');
  // A stage's department: a top-level one, plus optionally one of its
  // sub-departments (edms-backend PR #52). '' on a role stage = any department.
  const [departmentDraft, setDepartmentDraft] = useState('');
  const [subDepartmentDraft, setSubDepartmentDraft] = useState('');
  const { data: departmentsData } = useDepartments();
  // `GET /departments` is a tree of top-level departments with `children`.
  const departmentTree = departmentsData?.data || [];
  const departments = departmentOptions(departmentTree);
  const parentOf = departmentParents(departmentTree);
  // Labelled with the path: sub-departments in different trees may share a name.
  const departmentName = (id?: string | null) =>
    (id && departments.find((d) => d.id === id)?.label) || null;

  // Stages saved before PR #52 hold a sub-department in `department_id` alone;
  // read them as the parent + sub-department pair the picker shows (and saves).
  const stageDepartment = (stage: WorkflowStage | null) => {
    if (!stage?.department_id) return { departmentId: '', subDepartmentId: '' };
    if (stage.sub_department_id)
      return { departmentId: stage.department_id, subDepartmentId: stage.sub_department_id };
    const parentId = parentOf.get(stage.department_id);
    return parentId
      ? { departmentId: parentId, subDepartmentId: stage.department_id }
      : { departmentId: stage.department_id, subDepartmentId: '' };
  };
  const [slaDraft, setSlaDraft] = useState(48);
  const [actionsDraft, setActionsDraft] = useState<WorkflowStageAction[]>([]);

  const stages = wf?.definition?.stages || [];

  useEffect(() => {
    setNameDraft(wf?.name || '');
  }, [wf?.id, wf?.name]);

  const selectedStage = stages.find((s) => s.id === selectedStageId) ?? null;

  const resetStageDrafts = (stage: WorkflowStage | null) => {
    setStageNameDraft(stage?.name || '');
    setAssigneeMode(
      stage?.user_id ? 'person' : !stage?.role && stage?.department_id ? 'department' : 'role',
    );
    setRoleDraft(stage?.role || '');
    setUserDraft(stage?.user_id || '');
    const { departmentId, subDepartmentId } = stageDepartment(stage);
    setDepartmentDraft(departmentId);
    setSubDepartmentDraft(subDepartmentId);
    setSlaDraft(stage?.sla_hours ?? 48);
    setActionsDraft(stage?.actions || []);
  };

  // Also reset once departments load (to recognise a sub-department) and once a
  // just-added stage arrives, or its drafts stay empty and read as unsaved.
  const selectedStageLoaded = !!selectedStage;
  useEffect(() => {
    resetStageDrafts(selectedStage);
  }, [selectedStageId, selectedStageLoaded, departmentsData]);

  const updateWorkflow = (id: string, updates: Partial<WorkflowDefinition>) => {
    updateWfMutation.mutate({ id, updates });
  };

  // The stage's assignment as the drafts would save it. A stage has exactly one
  // kind; the fields of the others are cleared.
  const assignmentDraft = (): Pick<
    WorkflowStage,
    'role' | 'user_id' | 'department_id' | 'sub_department_id'
  > => {
    const department = {
      department_id: departmentDraft || undefined,
      sub_department_id: (departmentDraft && subDepartmentDraft) || undefined,
    };
    if (assigneeMode === 'role') return { role: roleDraft, user_id: undefined, ...department };
    if (assigneeMode === 'department') return { role: undefined, user_id: undefined, ...department };
    return { role: undefined, user_id: userDraft, department_id: undefined, sub_department_id: undefined };
  };

  const nameDirty = nameDraft !== (wf?.name || '');
  const stageDirty =
    !!selectedStage &&
    (() => {
      const draft = assignmentDraft();
      const saved = stageDepartment(selectedStage);
      return (
        stageNameDraft !== (selectedStage.name || '') ||
        JSON.stringify(actionsDraft) !== JSON.stringify(selectedStage.actions || []) ||
        slaDraft !== (selectedStage.sla_hours ?? 48) ||
        (draft.role || '') !== (selectedStage.role || '') ||
        (draft.user_id || '') !== (selectedStage.user_id || '') ||
        (draft.department_id || '') !== saved.departmentId ||
        (draft.sub_department_id || '') !== saved.subDepartmentId
      );
    })();

  useEffect(() => {
    setPageTitle('Workflow Designer');
  }, [setPageTitle]);

  if (isLoading) {
    return <SkeletonPage columns={['Workflow', 'Stages', 'Status', '']} rows={5} />;
  }

  if (error || !wf) {
    const notFound = (error as any)?.response?.status === 404;
    return (
      <div className="p-8">
        <div className="card card-pad text-center">
          <div className="h3 mb-2">
            {notFound ? 'This workflow no longer exists' : "Couldn't load this workflow"}
          </div>
          <div className="caption mb-4">
            {notFound ? 'It may have been a draft that was deleted.' : 'Please try again.'}
          </div>
          <Link className="btn btn-secondary" href="/admin/workflows">
            Back to workflows
          </Link>
        </div>
      </div>
    );
  }

  // Leaving with unsaved name or stage edits asks first, as switching stages does.
  const leaveTo = (href: string) => {
    if (!nameDirty && !stageDirty) return router.push(href);
    openConfirm({
      title: 'Discard unsaved changes?',
      message: 'You have unsaved changes. Leave this workflow anyway?',
      confirmLabel: 'Discard changes',
      danger: true,
      onConfirm: () => router.push(href),
    });
  };

  const publish = () =>
    publishWfMutation.mutateAsync(wf.id).then(() => {
      auditAction('WORKFLOW_PUBLISH', wf.id, `Published ${wf.name}`);
    });

  // Publishing a version archives the active one (PR #59), so say so first.
  const activeVersion = versions.find((v) => v.status === 'published' && v.id !== wf.id);
  const handlePublish = () => {
    if (!activeVersion) {
      // The hook's onError already toasts the failure.
      publish().catch(() => {});
      return;
    }
    openConfirm({
      title: `Publish v${wf.version}?`,
      message: `v${activeVersion.version} is active now and will be archived. Documents already routed through it finish there; new documents route to v${wf.version}.`,
      confirmLabel: `Publish v${wf.version}`,
      onConfirm: publish,
    });
  };

  // Versions come only from the latest, published one; a newer draft is opened instead.
  const latestVersion = versions[0];
  const newerDraft = versions.find((v) => v.status === 'draft' && v.version > wf.version);
  const handleNewVersion = () =>
    newerDraft
      ? leaveTo(`/admin/workflows/${newerDraft.id}`)
      : actions.newVersion(wf, (id) => leaveTo(`/admin/workflows/${id}`));

  const unarchiveBlocked = unarchiveBlockedReason(
    wf,
    latestVersion?.version,
    activeVersion?.version ?? null,
  );

  const handleAddStage = () => {
    if (updateWfMutation.isPending) return;
    const newStage: WorkflowStage = {
      id: `stage_${Date.now()}`,
      name: 'New stage',
      role: roles?.[0]?.name || 'staff',
      sla_hours: 48,
      actions: ['review'],
    };
    const definition = relinkStages([...stages, newStage]);
    const problem = validateDefinition(definition)[0];
    if (problem) {
      addToast(`Can't add a stage here: ${problem}`, 'error');
      return;
    }
    updateWorkflow(wf.id, { definition });
    setSelectedStageId(newStage.id);
    addToast('Stage added — configure it on the right', 'success');
  };

  const handleDeleteStage = (stage: WorkflowStage) => {
    // A delete can break routing elsewhere (a join, a conditional stage's
    // fallback); say why here instead of letting the save 422.
    const definition = relinkStages(stages.filter((s) => s.id !== stage.id));
    const problem = validateDefinition(definition)[0];
    if (problem) {
      addToast(`Can't delete "${stage.name}": ${problem}`, 'error');
      return;
    }
    openConfirm({
      title: `Delete stage "${stage.name}"?`,
      message: 'This stage will be removed. The remaining sequence will be reconnected.',
      confirmLabel: 'Delete stage',
      danger: true,
      onConfirm: () => {
        // Returning the promise keeps the modal open, with the button loading,
        // until the delete completes or fails and can be retried.
        return updateWfMutation
          .mutateAsync({
            id: wf.id,
            updates: { definition },
          })
          .then(() => {
            if (selectedStageId === stage.id) setSelectedStageId(null);
            addToast('Stage deleted', 'info');
          });
      },
    });
  };

  // Selecting a different stage discards whatever's still sitting unsaved
  // in the properties panel — confirm first so that isn't a silent loss.
  const selectStage = (id: string) => {
    if (id === selectedStageId) return;
    if (stageDirty) {
      openConfirm({
        title: 'Discard unsaved changes?',
        message: 'You have unsaved changes to this stage. Discard them and switch stages?',
        confirmLabel: 'Discard changes',
        danger: true,
        onConfirm: () => setSelectedStageId(id),
      });
      return;
    }
    setSelectedStageId(id);
  };

  // A branch label (not a stage card) was clicked on the canvas: open that
  // stage's Transitions tab.
  const handleEditBranch = (id: string) => {
    selectStage(id);
    setStagePanelTab('transitions');
  };

  const toggleAction = (action: WorkflowStageAction) => {
    if (!selectedStage) return;
    setActionsDraft((prev) => (prev.includes(action) ? prev.filter((a) => a !== action) : [...prev, action]));
  };

  const handleAssigneeModeChange = (mode: AssigneeMode) => {
    if (!selectedStage) return;
    setAssigneeMode(mode);
    if (mode === 'role') {
      setRoleDraft(roleDraft || roles?.[0]?.name || 'staff');
    } else if (mode === 'department') {
      if (!departmentDraft) {
        setDepartmentDraft(departmentTree[0]?.id || '');
        setSubDepartmentDraft('');
      }
    } else {
      setUserDraft(userDraft || users[0]?.id || '');
    }
  };

  const handleSaveName = () => {
    if (!nameDirty) return;
    updateWorkflow(wf.id, { name: nameDraft });
  };

  const handleSaveStage = () => {
    if (!selectedStage || !stageDirty) return;
    // The first stage can't send work back — drop a stale "Request changes".
    const actions =
      stages[0]?.id === selectedStage.id
        ? actionsDraft.filter((a) => a !== 'request_changes')
        : actionsDraft;
    if (assigneeMode === 'department' && !departmentDraft) {
      addToast('Pick a department', 'error');
      return;
    }
    const patch = {
      name: stageNameDraft,
      actions,
      sla_hours: slaDraft,
      ...assignmentDraft(),
    };
    const updatedStages = stages.map((s) => (s.id === selectedStage.id ? { ...s, ...patch } : s));
    updateWorkflow(wf.id, { definition: { ...wf.definition, stages: updatedStages } });
  };

  // Reordering (removed with drag-and-drop when branching arrived): swap the
  // selected stage with its neighbour along the route, saved straight away.
  const stageMove = (direction: MoveDirection) =>
    selectedStage
      ? moveStage({ stages, transitions: wf.definition.transitions || [] }, selectedStage.id, direction)
      : { reason: 'Select a stage first.' };
  const blockedReason = (direction: MoveDirection) => {
    const result = stageMove(direction);
    return 'reason' in result ? result.reason : null;
  };
  const handleMoveStage = (direction: MoveDirection) => {
    const result = stageMove(direction);
    if ('reason' in result || updateWfMutation.isPending) return;
    // The first stage can't send work back, so a stage moved to the start
    // loses "Request changes" (same rule as saving the first stage).
    const [first, ...rest] = result.definition.stages;
    const lostSendBack = !!first?.actions?.includes('request_changes');
    const movedStages = lostSendBack
      ? [{ ...first, actions: first.actions!.filter((a) => a !== 'request_changes') }, ...rest]
      : result.definition.stages;
    updateWorkflow(wf.id, {
      definition: { ...wf.definition, stages: movedStages, transitions: result.definition.transitions },
    });
    if (lostSendBack) {
      // Keep the open form in step, or it reads as unsaved.
      if (first.id === selectedStage?.id) {
        setActionsDraft((prev) => prev.filter((a) => a !== 'request_changes'));
      }
      addToast(`${first.name} is now the first stage, so "Request changes" was removed from it`, 'info');
    }
  };

  const handleDiscardStage = () => {
    resetStageDrafts(selectedStage);
  };

  // The Transitions tab hands back the whole definition (`applyStageRouting`),
  // since a parallel fork also changes its branches' routes and the join.
  const handleSaveTransitions = (definition: WorkflowDefinitionJson) => {
    updateWorkflow(wf.id, { definition: { ...wf.definition, ...definition } });
  };

  // After adding or deleting a stage: re-link the chain, and drop a join flag
  // whose branches no longer meet there (the backend would 422 the save).
  const relinkStages = (updatedStages: WorkflowStage[]) => {
    const transitions = reconcileTransitions(updatedStages, wf.definition.transitions || []);
    return { stages: normalizeJoins(indexGraph({ stages: updatedStages, transitions })), transitions };
  };

  const assigneeSummary = (s: WorkflowStage) => {
    if (s.user_id) {
      const u = users.find((u) => u.id === s.user_id);
      return u ? u.name : 'Assigned person';
    }
    const departmentId = s.sub_department_id || s.department_id;
    const department = departmentId ? departmentName(departmentId) || 'A department' : null;
    const role = s.role ? s.role.replace(/_/g, ' ') : null;
    if (role && department) return `${role} · ${department}`;
    return role || department || 'Unassigned';
  };

  return (
    <div>
      <WorkflowToolbar
        workflow={wf}
        stageCount={stages.length}
        nameDraft={nameDraft}
        onNameChange={setNameDraft}
        nameDirty={nameDirty}
        onSaveName={handleSaveName}
        saving={updateWfMutation.isPending}
        onBack={() => leaveTo(`/admin/workflows?status=${wf.status}`)}
        onClone={() => actions.clone(wf, (id) => leaveTo(`/admin/workflows/${id}`))}
        onArchive={() => actions.archive(wf)}
        onUnarchive={() => actions.unarchive(wf)}
        onDelete={() => actions.remove(wf, () => router.replace('/admin/workflows?status=draft'))}
        onPublish={handlePublish}
        versions={versions}
        onOpenVersion={(id) => leaveTo(`/admin/workflows/${id}`)}
        onNewVersion={handleNewVersion}
        newVersionLabel={newerDraft ? `Open draft v${newerDraft.version}` : 'New version'}
        unarchiveBlocked={unarchiveBlocked}
        cloning={actions.cloning}
        versioning={actions.versioning}
        archiving={actions.archiving}
        unarchiving={actions.unarchiving}
        deleting={actions.deleting}
        publishing={publishWfMutation.isPending}
        canCreate={canCreateWorkflow}
        canArchive={canArchiveWorkflow}
        canDelete={canEditWorkflow}
        canPublish={canPublishWorkflow}
      />

      <WorkflowDesignerGuide />

      <div className="wfd-layout">
        <div className="card">
          <div className="card-head">
            <span className="h3">Stages</span>
            <button
              className="btn btn-secondary btn-sm"
              onClick={handleAddStage}
              disabled={updateWfMutation.isPending || !canEditWorkflow}
              title={!canEditWorkflow ? "You don't have permission to edit workflows" : undefined}
            >
              <Icon name="plus" size={14} /> Add stage
            </button>
          </div>
          <div className="card-body" style={{ padding: 0 }}>
            <WorkflowCanvas
              stages={stages}
              transitions={wf.definition.transitions || []}
              selectedStageId={selectedStageId}
              onSelect={selectStage}
              onEditBranch={handleEditBranch}
              assigneeSummary={assigneeSummary}
              metadataFieldName={(id) => metadataFields?.find((f) => f.id === id)?.name}
            />
          </div>
        </div>

        <StagePanel
          selectedStage={selectedStage}
          stages={stages}
          transitions={wf.definition.transitions || []}
          onSaveTransitions={handleSaveTransitions}
          saving={updateWfMutation.isPending}
          canEdit={canEditWorkflow}
          tab={stagePanelTab}
          onTabChange={setStagePanelTab}
          stageBranches={(() => {
            const outgoing = (wf.definition.transitions || []).filter((t) => t.from === selectedStage?.id);
            return outgoing.some((t) => !!t.condition) || isParallelFork(outgoing);
          })()}
          propertiesProps={{
            saving: updateWfMutation.isPending,
            dirty: stageDirty,
            nameDraft: stageNameDraft,
            onNameChange: setStageNameDraft,
            actionsDraft,
            onToggleAction: toggleAction,
            assigneeMode,
            onAssigneeModeChange: handleAssigneeModeChange,
            roles: roles || [],
            roleDraft,
            onRoleChange: setRoleDraft,
            departments: departmentTree,
            departmentDraft,
            subDepartmentDraft,
            onDepartmentChange: (departmentId: string, subDepartmentId: string) => {
              setDepartmentDraft(departmentId);
              setSubDepartmentDraft(subDepartmentId);
            },
            users,
            userDraft,
            onUserChange: setUserDraft,
            slaDraft,
            onSlaChange: setSlaDraft,
            onSave: handleSaveStage,
            onDiscard: handleDiscardStage,
            onDelete: () => selectedStage && handleDeleteStage(selectedStage),
            onMove: handleMoveStage,
            moveEarlierBlocked: blockedReason('earlier'),
            moveLaterBlocked: blockedReason('later'),
            canEdit: canEditWorkflow,
            isFirstStage: !!selectedStage && stages[0]?.id === selectedStage.id,
          }}
        />
      </div>
    </div>
  );
}
