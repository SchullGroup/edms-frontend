// @ts-nocheck
'use client';

import React, { useState, useEffect } from 'react';
import { useStore } from '@/store/useStore';
import { useUIStore } from '@/store/useUIStore';
import {
  useWorkflows,
  useUpdateWorkflow,
  useCreateWorkflow,
  usePublishWorkflow,
  useArchiveWorkflow,
} from '@/apis/hooks/useWorkflows';
import { useRoles } from '@/apis/hooks/useRoles';
import { useAllUsers } from '@/apis/hooks/useUsers';
import { useDebouncedCallback } from '@/hooks/useDebouncedCallback';
import { Icon } from '@/components/ui/Icons';
import { WorkflowToolbar } from '@/components/workflows/WorkflowToolbar';
import { WorkflowCanvas } from '@/components/workflows/WorkflowCanvas';
import { StagePropertiesPanel } from '@/components/workflows/StagePropertiesPanel';
import { DEFAULT_WORKFLOW_DEFINITION, rebuildTransitions } from '@/components/workflows/constants';

const SAVE_DEBOUNCE_MS = 500;

export default function WorkflowDesignerPage() {
  const { auditAction } = useStore();
  const { setPageTitle, openConfirm, addToast } = useUIStore();

  const { data: workflowsData, isLoading, error } = useWorkflows();
  const workflows = workflowsData?.data || [];
  const { data: roles } = useRoles();
  const { data: usersResult } = useAllUsers();
  const users = usersResult?.items || [];

  const updateWfMutation = useUpdateWorkflow();
  const createWfMutation = useCreateWorkflow();
  const publishWfMutation = usePublishWorkflow();
  const archiveWfMutation = useArchiveWorkflow();

  const [wfId, setWfId] = useState(null);
  const [selectedStageId, setSelectedStageId] = useState(null);
  // There's no real delete-workflow endpoint on the backend — only archive.
  // Archived workflows drop out of the switcher by default so archiving
  // reads as "gone" day-to-day, without pretending it's actually deleted.
  const [showArchived, setShowArchived] = useState(false);

  // Local drafts decouple typing from the network round-trip: they update
  // instantly on every keystroke, but nothing is written back until an
  // explicit Save. They only resync from server data when the *selection*
  // changes or a save actually lands, never on every keystroke.
  const [nameDraft, setNameDraft] = useState('');
  const [stageNameDraft, setStageNameDraft] = useState('');
  const [assigneeMode, setAssigneeMode] = useState('role');
  const [roleDraft, setRoleDraft] = useState('');
  const [userDraft, setUserDraft] = useState('');
  const [slaDraft, setSlaDraft] = useState(48);
  const [actionsDraft, setActionsDraft] = useState([]);

  useEffect(() => {
    if (workflows.length > 0 && !wfId) {
      setWfId(workflows[0].id);
    }
  }, [workflows, wfId]);

  const wf = workflows?.find((w) => w.id === wfId) || workflows?.[0];
  const stages = wf?.definition?.stages || [];
  const switcherWorkflows = showArchived ? workflows : workflows.filter((w) => w.status !== 'archived' || w.id === wf?.id);
  const archivedCount = workflows.filter((w) => w.status === 'archived').length;

  useEffect(() => {
    setNameDraft(wf?.name || '');
  }, [wf?.id, wf?.name]);

  const selectedStage = stages.find((s) => s.id === selectedStageId);

  const resetStageDrafts = (stage) => {
    setStageNameDraft(stage?.name || '');
    setAssigneeMode(stage?.user_id ? 'person' : 'role');
    setRoleDraft(stage?.role || '');
    setUserDraft(stage?.user_id || '');
    setSlaDraft(stage?.sla_hours ?? 48);
    setActionsDraft(stage?.actions || []);
  };

  useEffect(() => {
    resetStageDrafts(selectedStage);
  }, [selectedStageId]);

  const updateWorkflow = (id, updates) => {
    updateWfMutation.mutate({ id, updates });
  };

  // Editing a name or a stage's properties never saves on its own — only an
  // explicit Save commits it. The one thing that still saves automatically
  // is dragging a stage to reorder it, and even that is debounced so a
  // flurry of quick drags collapses into one write instead of one per drop.
  const debouncedReorder = useDebouncedCallback((id, updates) => {
    updateWorkflow(id, updates);
  }, SAVE_DEBOUNCE_MS);

  const nameDirty = nameDraft !== (wf?.name || '');
  const stageDirty =
    !!selectedStage &&
    (stageNameDraft !== (selectedStage.name || '') ||
      JSON.stringify(actionsDraft) !== JSON.stringify(selectedStage.actions || []) ||
      slaDraft !== (selectedStage.sla_hours ?? 48) ||
      (assigneeMode === 'role'
        ? roleDraft !== (selectedStage.role || '') || !!selectedStage.user_id
        : userDraft !== (selectedStage.user_id || '') || !!selectedStage.role));

  useEffect(() => {
    setPageTitle('Workflow Designer');
  }, [setPageTitle]);

  if (isLoading) {
    return <div className="p-8 text-center muted">Loading workflow designer...</div>;
  }

  if (error) {
    return (
      <div className="p-8 text-center" style={{ color: 'var(--status-overdue)' }}>
        Failed to load workflows. Please try again.
      </div>
    );
  }

  const handleCreateWorkflow = () => {
    createWfMutation.mutate(
      { name: 'New workflow', description: 'A new sequential workflow', definition: DEFAULT_WORKFLOW_DEFINITION },
      {
        onSuccess: (data) => {
          setWfId(data.id);
          setSelectedStageId(null);
          addToast('Workflow created', 'success');
        },
      },
    );
  };

  if (!wf && workflows.length === 0) {
    return (
      <div className="p-8">
        <div className="card card-pad text-center">
          <div className="h3 mb8">No workflows yet</div>
          <div className="caption mb16">Create your first workflow to get started.</div>
          <button className="btn btn-primary" onClick={handleCreateWorkflow}>
            Create workflow
          </button>
        </div>
      </div>
    );
  }

  if (!wf) return null;

  const handlePublish = () => {
    publishWfMutation.mutate(wf.id, {
      onSuccess: () => {
        auditAction('WORKFLOW_PUBLISH', wf.id, `Published ${wf.name}`);
      },
    });
  };

  // There's no real delete endpoint for a workflow — archive is the closest
  // the API has, so it's framed here as the practical "remove this" action:
  // archived workflows drop out of the switcher (see switcherWorkflows) and
  // can no longer be routed to, but stay reversible and auditable rather
  // than gone.
  const handleArchive = () => {
    openConfirm({
      title: `Archive "${wf.name}"?`,
      message:
        "There's no permanent delete for a workflow — archive is the closest thing. It'll drop out of this list and can no longer be routed to for new documents. Files already in flight are unaffected, and it can be found again via \"Show archived\".",
      confirmLabel: 'Archive',
      danger: true,
      onConfirm: () =>
        archiveWfMutation.mutateAsync(wf.id).then(() => {
          auditAction('WORKFLOW_ARCHIVE', wf.id, `Archived ${wf.name}`);
        }),
    });
  };

  const handleClone = () => {
    const copy = { name: wf.name + ' (copy)', description: 'Cloned from ' + wf.name, definition: wf.definition };
    createWfMutation.mutate(copy, {
      onSuccess: (data) => {
        setWfId(data.id);
        setSelectedStageId(null);
        auditAction('WORKFLOW_CLONE', data.id, 'Cloned from ' + wf.name);
      },
    });
  };

  const handleAddStage = () => {
    if (updateWfMutation.isPending) return;
    const newStage = {
      id: `stage_${Date.now()}`,
      name: 'New stage',
      role: roles?.[0]?.name || 'staff',
      sla_hours: 48,
      actions: ['review'],
    };
    const updatedStages = [...stages, newStage];
    updateWorkflow(wf.id, { definition: { stages: updatedStages, transitions: rebuildTransitions(updatedStages) } });
    setSelectedStageId(newStage.id);
    addToast('Stage added — configure it on the right', 'success');
  };

  const handleReorderStages = (updatedStages) => {
    debouncedReorder(wf.id, { definition: { stages: updatedStages, transitions: rebuildTransitions(updatedStages) } });
  };

  const handleDeleteStage = (stage) => {
    openConfirm({
      title: `Delete stage "${stage.name}"?`,
      message: 'This stage will be removed. The remaining sequence will be reconnected.',
      confirmLabel: 'Delete stage',
      danger: true,
      onConfirm: () => {
        const updatedStages = stages.filter((s) => s.id !== stage.id);
        // Returning the mutation promise lets the confirm button show a
        // loading state and keeps the modal open until the delete actually
        // completes (or failed and can be retried).
        return updateWfMutation
          .mutateAsync({
            id: wf.id,
            updates: { definition: { stages: updatedStages, transitions: rebuildTransitions(updatedStages) } },
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
  const selectStage = (id) => {
    if (id === selectedStageId) return;
    if (stageDirty && !window.confirm('Discard unsaved changes to this stage?')) return;
    setSelectedStageId(id);
  };

  const toggleAction = (action) => {
    if (!selectedStage) return;
    setActionsDraft((prev) => (prev.includes(action) ? prev.filter((a) => a !== action) : [...prev, action]));
  };

  const handleAssigneeModeChange = (mode) => {
    if (!selectedStage) return;
    setAssigneeMode(mode);
    if (mode === 'role') {
      setRoleDraft(roleDraft || roles?.[0]?.name || 'staff');
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
    const patch =
      assigneeMode === 'role'
        ? { name: stageNameDraft, actions: actionsDraft, sla_hours: slaDraft, role: roleDraft, user_id: undefined }
        : { name: stageNameDraft, actions: actionsDraft, sla_hours: slaDraft, user_id: userDraft, role: undefined };
    const updatedStages = stages.map((s) => (s.id === selectedStage.id ? { ...s, ...patch } : s));
    updateWorkflow(wf.id, { definition: { ...wf.definition, stages: updatedStages } });
  };

  const handleDiscardStage = () => {
    resetStageDrafts(selectedStage);
  };

  const assigneeSummary = (s) => {
    if (s.user_id) {
      const u = users.find((u) => u.id === s.user_id);
      return u ? u.name : 'Assigned person';
    }
    return s.role ? s.role.replace(/_/g, ' ') : 'Unassigned';
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
        switcherWorkflows={switcherWorkflows}
        archivedCount={archivedCount}
        showArchived={showArchived}
        onToggleShowArchived={() => setShowArchived((v) => !v)}
        onSwitchWorkflow={(id) => {
          if ((nameDirty || stageDirty) && !window.confirm('You have unsaved changes. Switch workflow anyway?')) return;
          setWfId(id);
          setSelectedStageId(null);
        }}
        onCreateNew={handleCreateWorkflow}
        onClone={handleClone}
        onArchive={handleArchive}
        onPublish={handlePublish}
        creating={createWfMutation.isPending}
        archiving={archiveWfMutation.isPending}
        publishing={publishWfMutation.isPending}
      />

      <div className="wfd-layout">
        <div className="card">
          <div className="card-head">
            <span className="h3">Stages</span>
            <button className="btn btn-secondary btn-sm" onClick={handleAddStage} disabled={updateWfMutation.isPending}>
              <Icon name="plus" size={14} /> Add stage
            </button>
          </div>
          <div className="card-body" style={{ padding: 0 }}>
            <WorkflowCanvas
              stages={stages}
              selectedStageId={selectedStageId}
              onSelect={selectStage}
              onReorder={handleReorderStages}
              assigneeSummary={assigneeSummary}
              disabled={updateWfMutation.isPending}
            />
          </div>
        </div>

        <StagePropertiesPanel
          selectedStage={selectedStage}
          saving={updateWfMutation.isPending}
          dirty={stageDirty}
          nameDraft={stageNameDraft}
          onNameChange={setStageNameDraft}
          actionsDraft={actionsDraft}
          onToggleAction={toggleAction}
          assigneeMode={assigneeMode}
          onAssigneeModeChange={handleAssigneeModeChange}
          roles={roles || []}
          roleDraft={roleDraft}
          onRoleChange={setRoleDraft}
          users={users}
          userDraft={userDraft}
          onUserChange={setUserDraft}
          slaDraft={slaDraft}
          onSlaChange={setSlaDraft}
          onSave={handleSaveStage}
          onDiscard={handleDiscardStage}
          onDelete={() => handleDeleteStage(selectedStage)}
        />
      </div>
    </div>
  );
}
