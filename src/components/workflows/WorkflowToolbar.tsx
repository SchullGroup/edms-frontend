'use client';

import { useEffect, useRef, useState } from 'react';
import { Icon } from '@/components/ui/Icons';
import { WorkflowActionsMenu } from '@/components/workflows/WorkflowActionsMenu';
import type { WorkflowDefinition } from '@/types/models';

export interface WorkflowToolbarProps {
  workflow: WorkflowDefinition;
  stageCount: number;
  nameDraft: string;
  onNameChange: (name: string) => void;
  nameDirty: boolean;
  onSaveName: () => void;
  saving: boolean;
  onBack: () => void;
  onClone: () => void;
  onArchive: () => void;
  onUnarchive: () => void;
  onDelete: () => void;
  onPublish: () => void;
  /** Every version of this workflow, newest first; the picker shows when there are 2+. */
  versions: WorkflowDefinition[];
  onOpenVersion: (id: string) => void;
  onNewVersion: () => void;
  newVersionLabel: string;
  /** Why Unarchive would 409 for this version, or null when it's allowed. */
  unarchiveBlocked: string | null;
  cloning: boolean;
  versioning: boolean;
  archiving: boolean;
  unarchiving: boolean;
  deleting: boolean;
  publishing: boolean;
  canCreate: boolean;
  canArchive: boolean;
  canDelete: boolean;
  canPublish: boolean;
}

/** A back link to the workflow list above this workflow's toolbar. The primary button
 *  follows the status (Publish a draft, Unarchive an archived one); the rest sit in ⋮. */
export function WorkflowToolbar({
  workflow,
  stageCount,
  nameDraft,
  onNameChange,
  nameDirty,
  onSaveName,
  saving,
  onBack,
  onClone,
  onArchive,
  onUnarchive,
  onDelete,
  onPublish,
  versions,
  onOpenVersion,
  onNewVersion,
  newVersionLabel,
  unarchiveBlocked,
  cloning,
  versioning,
  archiving,
  unarchiving,
  deleting,
  publishing,
  canCreate,
  canArchive,
  canDelete,
  canPublish,
}: WorkflowToolbarProps) {
  const statusBadgeClass =
    workflow.status === 'published'
      ? 'b-status-closed'
      : workflow.status === 'archived'
        ? 'b-status-overdue'
        : 'b-status-pending';
  const statusLabel = (status: WorkflowDefinition['status']) =>
    status === 'published' ? 'Active' : status === 'archived' ? 'Archived' : 'Draft';

  // Flashes a brief "Saved" confirmation whenever a save that was in flight
  // completes, rather than leaving success entirely silent.
  const [justSaved, setJustSaved] = useState(false);
  const wasSaving = useRef(false);
  useEffect(() => {
    if (wasSaving.current && !saving) {
      setJustSaved(true);
      const t = setTimeout(() => setJustSaved(false), 1600);
      return () => clearTimeout(t);
    }
    wasSaving.current = saving;
  }, [saving]);

  return (
    <div className="wfd-toolbar">
      <div className="wfd-crumbrow">
        <button type="button" className="caption font-semibold wfd-back" onClick={onBack}>
          Workflows
        </button>
        <Icon name="chevR" size={12} />
        <span className="caption">{workflow.name}</span>
      </div>

      <div className="wfd-toolrow">
        <div className="flex items-center gap-2 flex-wrap" style={{ minWidth: 0 }}>
          <input
            className="input"
            value={nameDraft}
            style={{ fontWeight: 700, width: '240px' }}
            onChange={(e) => onNameChange(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && nameDirty) onSaveName();
            }}
            aria-label="Workflow name"
          />
          <button
            type="button"
            className="btn btn-primary btn-sm"
            onClick={onSaveName}
            disabled={!nameDirty || saving}
          >
            {saving && nameDirty ? 'Saving…' : 'Save'}
          </button>
          <span className={`wfd-saved-pill ${justSaved ? 'show' : ''}`}>
            <Icon name="check" size={12} /> Saved
          </span>
          <span className={`badge ${statusBadgeClass}`}>{statusLabel(workflow.status)}</span>
          {versions.length > 1 ? (
            <select
              className="input"
              style={{ height: '32px', width: 'auto' }}
              value={workflow.id}
              onChange={(e) => onOpenVersion(e.target.value)}
              aria-label="Workflow version"
            >
              {versions.map((v) => (
                <option key={v.id} value={v.id}>
                  v{v.version} · {statusLabel(v.status)}
                </option>
              ))}
            </select>
          ) : (
            <span className="caption">v{workflow.version}</span>
          )}
          <span className="caption">
            {stageCount} stage{stageCount === 1 ? '' : 's'}
          </span>
        </div>

        <div className="flex items-center gap-2">
          {workflow.status === 'archived' ? (
            <button
              className="btn btn-primary btn-sm"
              onClick={onUnarchive}
              disabled={unarchiving || !canArchive || !!unarchiveBlocked}
              title={
                !canArchive
                  ? "You don't have permission to unarchive workflows"
                  : (unarchiveBlocked ?? undefined)
              }
            >
              {unarchiving ? 'Unarchiving…' : 'Unarchive'}
            </button>
          ) : (
            <button
              className="btn btn-primary btn-sm"
              onClick={onPublish}
              disabled={publishing || workflow.status === 'published' || !canPublish}
              title={!canPublish ? "You don't have permission to publish workflows" : undefined}
            >
              {workflow.status === 'published' ? 'Published' : 'Publish'}
            </button>
          )}
          <WorkflowActionsMenu
            status={workflow.status}
            ariaLabel="More workflow actions"
            onClone={onClone}
            onArchive={onArchive}
            onDelete={onDelete}
            onNewVersion={onNewVersion}
            newVersionLabel={newVersionLabel}
            busy={{ cloning, versioning, archiving, unarchiving, deleting }}
            can={{ create: canCreate, archive: canArchive, delete: canDelete }}
          />
        </div>
      </div>
    </div>
  );
}
