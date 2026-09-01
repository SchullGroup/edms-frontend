'use client';

import React from 'react';
import { STAGE_ACTIONS } from './constants';
import { Combobox } from '@/components/ui/Combobox';

export interface StagePropertiesPanelProps {
  selectedStage: any | null;
  saving: boolean;
  dirty: boolean;
  nameDraft: string;
  onNameChange: (name: string) => void;
  actionsDraft: string[];
  onToggleAction: (action: string) => void;
  assigneeMode: 'role' | 'person';
  onAssigneeModeChange: (mode: 'role' | 'person') => void;
  roles: { id: string; name: string }[];
  roleDraft: string;
  onRoleChange: (role: string) => void;
  users: { id: string; name: string; email?: string }[];
  userDraft: string;
  onUserChange: (userId: string) => void;
  slaDraft: number;
  onSlaChange: (hours: number) => void;
  onSave: () => void;
  onDiscard: () => void;
  onDelete: () => void;
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
  users,
  userDraft,
  onUserChange,
  slaDraft,
  onSlaChange,
  onSave,
  onDiscard,
  onDelete,
}: StagePropertiesPanelProps) {
  return (
    <div className="card wfd-props">
      <div className="card-head">
        <span className="h3">Stage properties</span>
        {saving && <span className="btn-spinner" aria-hidden="true" />}
      </div>
      {!selectedStage ? (
        <div className="card-body">
          <p className="muted" style={{ lineHeight: 1.6, fontSize: '12.5px' }}>
            Select a stage on the left to configure it, or add a new one.
          </p>
          <div className="divider"></div>
          <div className="banner success" style={{ marginBottom: 0 }}>
            This workflow is strictly sequential — one stage runs at a time, in this order.
          </div>
        </div>
      ) : (
        <div className="card-body">
          <div className="field">
            <label>Stage name</label>
            <input className="input" value={nameDraft} onChange={(e) => onNameChange(e.target.value)} />
          </div>

          <div className="field">
            <label>Allowed actions</label>
            <div className="flex g8 wrap">
              {STAGE_ACTIONS.map((a) => {
                const active = actionsDraft.includes(a.value);
                return (
                  <button
                    key={a.value}
                    type="button"
                    title={a.hint}
                    className="tag"
                    style={active ? { background: 'var(--focus)', color: '#fff', borderColor: 'var(--focus)' } : { cursor: 'pointer' }}
                    onClick={() => onToggleAction(a.value)}
                  >
                    {a.label}
                  </button>
                );
              })}
            </div>
            <div className="help">What whoever's assigned this stage can do with it.</div>
          </div>

          <div className="field">
            <label>Assign to</label>
            <div className="seg" role="group" aria-label="Assign by role or person" style={{ marginBottom: '8px' }}>
              <button type="button" className={assigneeMode === 'role' ? 'active' : ''} onClick={() => onAssigneeModeChange('role')}>
                A role
              </button>
              <button type="button" className={assigneeMode === 'person' ? 'active' : ''} onClick={() => onAssigneeModeChange('person')}>
                A specific person
              </button>
            </div>
            {assigneeMode === 'role' ? (
              <select className="input" value={roleDraft} onChange={(e) => onRoleChange(e.target.value)}>
                {(roles || []).map((r) => (
                  <option key={r.id} value={r.name}>
                    {r.name.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())}
                  </option>
                ))}
              </select>
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

          <div className="flex g8" style={{ marginTop: '4px' }}>
            <button className="btn btn-primary btn-sm" onClick={onSave} disabled={!dirty || saving}>
              {saving ? 'Saving…' : 'Save changes'}
            </button>
            {dirty && (
              <button className="btn btn-secondary btn-sm" onClick={onDiscard} disabled={saving}>
                Discard
              </button>
            )}
          </div>

          <button className="btn btn-danger btn-sm mt16" onClick={onDelete}>
            Delete stage
          </button>
        </div>
      )}
    </div>
  );
}
