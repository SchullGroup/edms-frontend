'use client';

import { STAGE_ACTIONS } from './constants';
import { Combobox } from '@/components/ui/Combobox';
import { StageDepartmentPicker } from './StageDepartmentPicker';
import type { Department, WorkflowStageAction } from '@/types/models';

export type AssigneeMode = 'role' | 'person' | 'department';

export interface StagePropertiesPanelProps {
  selectedStage: any | null;
  saving: boolean;
  dirty: boolean;
  nameDraft: string;
  onNameChange: (name: string) => void;
  actionsDraft: WorkflowStageAction[];
  onToggleAction: (action: WorkflowStageAction) => void;
  assigneeMode: AssigneeMode;
  onAssigneeModeChange: (mode: AssigneeMode) => void;
  roles: { id: string; name: string }[];
  roleDraft: string;
  onRoleChange: (role: string) => void;
  /** `GET /departments` as returned: top-level departments with `children`. */
  departments: Department[];
  /** A top-level department; '' on a role stage means any department. */
  departmentDraft: string;
  /** One of its sub-departments, or '' for the department itself. */
  subDepartmentDraft: string;
  onDepartmentChange: (departmentId: string, subDepartmentId: string) => void;
  users: { id: string; name: string; email?: string }[];
  userDraft: string;
  onUserChange: (userId: string) => void;
  slaDraft: number;
  onSlaChange: (hours: number) => void;
  onSave: () => void;
  onDiscard: () => void;
  onDelete: () => void;
  canEdit: boolean;
  /** The workflow's first stage — it has no earlier stage to send work back
   *  to, so "Request changes" can't apply (the backend rejects it with 409). */
  isFirstStage?: boolean;
  /** Renders just the body, no card/header — used when a parent (StagePanel)
   *  already supplies the shared card shell and tab switcher. */
  bare?: boolean;
}

export function StagePropertiesPanel({
  selectedStage,
  saving,
  dirty,
  nameDraft,
  onNameChange,
  actionsDraft,
  onToggleAction,
  assigneeMode,
  onAssigneeModeChange,
  roles,
  roleDraft,
  onRoleChange,
  departments,
  departmentDraft,
  subDepartmentDraft,
  onDepartmentChange,
  users,
  userDraft,
  onUserChange,
  slaDraft,
  onSlaChange,
  onSave,
  onDiscard,
  onDelete,
  canEdit,
  isFirstStage = false,
  bare,
}: StagePropertiesPanelProps) {
  const parent = departments.find((d) => d.id === departmentDraft);
  const sub = parent?.children?.find((c) => c.id === subDepartmentDraft);
  const departmentLabel = parent ? (sub ? `${parent.name} › ${sub.name}` : parent.name) : null;
  const departmentPicker = (allowAny: boolean) => (
    <StageDepartmentPicker
      departments={departments}
      departmentId={departmentDraft}
      subDepartmentId={subDepartmentDraft}
      onChange={onDepartmentChange}
      allowAny={allowAny}
    />
  );

  const body = !selectedStage ? (
    <div className="card-body">
      <p className="muted" style={{ lineHeight: 1.6, fontSize: '12.5px' }}>
        Select a stage on the left to configure it, or add a new one.
      </p>
      <div className="divider"></div>
      <div className="banner success" style={{ marginBottom: 0 }}>
        On a stage&rsquo;s Transitions tab you can send documents down different branches
        depending on conditions, or down several branches at once in parallel.
      </div>
    </div>
  ) : (
    <div className="card-body">
          <div className="field">
            <label>Stage name</label>
            <input className="input" value={nameDraft} onChange={(e) => onNameChange(e.target.value)} />
          </div>

          {selectedStage.join === 'all' && (
            <div className="banner info" style={{ marginBottom: '14px' }}>
              Parallel branches meet here: a document waits at this stage until every branch has
              arrived, then one task opens. Change it from the Transitions tab of the stage where
              the branches start.
            </div>
          )}

          <div className="field">
            <label>Allowed actions</label>
            <div className="flex gap-2 flex-wrap">
              {STAGE_ACTIONS.map((a) => {
                const unavailable = isFirstStage && a.value === 'request_changes';
                const active = actionsDraft.includes(a.value) && !unavailable;
                return (
                  <button
                    key={a.value}
                    type="button"
                    title={unavailable ? 'Not available on the first stage — there is no earlier stage to send it back to' : a.hint}
                    className="tag"
                    disabled={unavailable}
                    style={
                      active
                        ? { background: 'var(--focus)', color: '#fff', borderColor: 'var(--focus)' }
                        : unavailable
                          ? { opacity: 0.45, cursor: 'not-allowed', textDecoration: 'line-through' }
                          : { cursor: 'pointer' }
                    }
                    onClick={() => onToggleAction(a.value)}
                  >
                    {a.label}
                  </button>
                );
              })}
            </div>
            <div className="help">
              What whoever's assigned this stage can do with it.
              {isFirstStage &&
                ' "Request changes" isn’t available on the first stage — use "Reject" to stop a submission instead.'}
            </div>
          </div>

          <div className="field">
            <label>Assign to</label>
            <div className="seg" role="group" aria-label="Assign by role, person or department" style={{ marginBottom: '8px' }}>
              <button type="button" className={assigneeMode === 'role' ? 'active' : ''} onClick={() => onAssigneeModeChange('role')}>
                Role
              </button>
              <button type="button" className={assigneeMode === 'person' ? 'active' : ''} onClick={() => onAssigneeModeChange('person')}>
                Person
              </button>
              <button type="button" className={assigneeMode === 'department' ? 'active' : ''} onClick={() => onAssigneeModeChange('department')}>
                Department
              </button>
            </div>
            {assigneeMode === 'role' ? (
              <>
                <select className="input" value={roleDraft} onChange={(e) => onRoleChange(e.target.value)}>
                  {(roles || []).map((r) => (
                    <option key={r.id} value={r.name}>
                      {r.name.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())}
                    </option>
                  ))}
                </select>
                <div className="mt-2">{departmentPicker(true)}</div>
                <div className="help">
                  {departmentLabel
                    ? `Only people with this role in ${departmentLabel}.`
                    : 'Anyone with this role, in any department.'}
                </div>
              </>
            ) : assigneeMode === 'department' ? (
              <>
                {departmentPicker(false)}
                {parent && (
                  <div className="help">
                    Anyone in {departmentLabel} can pick the task up, whatever their role.{' '}
                    {sub
                      ? `People directly in ${parent.name} or in its other sub-departments don't get it.`
                      : (parent.children?.length ?? 0) > 0
                        ? 'Only people directly in it: its sub-departments aren’t included.'
                        : ''}
                  </div>
                )}
              </>
            ) : (
              <Combobox
                options={users.map((u) => ({ value: u.id, label: u.name, hint: u.email }))}
                value={userDraft}
                onChange={(v) => onUserChange(v as string)}
                placeholder="Select a person…"
                searchPlaceholder="Search people…"
                emptyText="No people match"
              />
            )}
          </div>

          <div className="field">
            <label>SLA (hours)</label>
            <input
              className="input"
              type="number"
              min={1}
              max={8760}
              value={slaDraft}
              onChange={(e) => onSlaChange(+e.target.value)}
            />
          </div>

          <div className="flex gap-2" style={{ marginTop: '4px' }}>
            <button
              className="btn btn-primary btn-sm"
              onClick={onSave}
              disabled={!dirty || saving || !canEdit}
              title={!canEdit ? "You don't have permission to edit workflows" : undefined}
            >
              {saving ? 'Saving…' : 'Save changes'}
            </button>
            {dirty && (
              <button className="btn btn-secondary btn-sm" onClick={onDiscard} disabled={saving}>
                Discard
              </button>
            )}
          </div>

          <button
            className="btn btn-danger btn-sm mt-4"
            onClick={onDelete}
            disabled={!canEdit}
            title={!canEdit ? "You don't have permission to edit workflows" : undefined}
          >
            Delete stage
          </button>
        </div>
      );

  if (bare) return body;

  return (
    <div className="card wfd-props">
      <div className="card-head">
        <span className="h3">Stage properties</span>
        {saving && <span className="btn-spinner" aria-hidden="true" />}
      </div>
      {body}
    </div>
  );
}
