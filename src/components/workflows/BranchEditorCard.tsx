'use client';

import { CONDITION_FIELDS, operatorsForField, valueOptionsForField } from './constants';
import { useBranchDraft } from '@/hooks/useBranchDraft';
import type { WorkflowConditionField, WorkflowStage, WorkflowTransition } from '@/types/models';

export interface BranchEditorCardProps {
  stage: WorkflowStage;
  stages: WorkflowStage[];
  transitions: WorkflowTransition[];
  onSave: (stageId: string, outgoing: WorkflowTransition[]) => void;
  saving: boolean;
  canEdit: boolean;
}

/**
 * The actual routing editor — every outgoing transition for one stage,
 * shown as a card per branch (target, and, for a conditional one, its rule
 * builder). Purely presentational: all state and validation come from
 * `useBranchDraft`, so this component itself has no business logic to keep
 * in sync anywhere else.
 */
export function BranchEditorCard({ stage, stages, transitions, onSave, saving, canEdit }: BranchEditorCardProps) {
  const {
    drafts,
    otherStages,
    isTerminal,
    dirty,
    issues,
    availableTargets,
    metadataFields,
    updateDraft,
    removeDraft,
    addConditionalBranch,
    addRule,
    removeRule,
    updateRule,
    setMode,
    handleFieldChange,
    handleSave,
    handleDiscard,
  } = useBranchDraft(stage, stages, transitions, onSave);

  return (
    <>
      {drafts.length === 0 ? (
        <p className="muted" style={{ lineHeight: 1.6, fontSize: '12.5px' }}>
          {isTerminal ? 'This is the last stage — nothing routes on from here.' : 'No outgoing transition yet.'}
        </p>
      ) : (
        <div className="flex flex-col gap-3">
          {drafts.map((d) => {
            const isConditional = !!d.condition;
            return (
              <div key={d._key} className="wfd-transition-card">
                <div className="flex items-center gap-2" style={{ marginBottom: isConditional ? '10px' : 0 }}>
                  <span className={`tag ${isConditional ? 'wfd-tag-conditional' : 'wfd-tag-fallback'}`}>
                    {isConditional ? `Priority ${d.priority ?? '?'}` : 'Fallback'}
                  </span>
                  <span className="muted" style={{ fontSize: '11px' }}>
                    →
                  </span>
                  <select
                    className="input"
                    style={{ flex: 1, fontSize: '12.5px', padding: '4px 8px' }}
                    value={d.to}
                    disabled={!canEdit}
                    onChange={(e) => updateDraft(d._key, { to: e.target.value })}
                  >
                    {otherStages.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.name || s.id}
                      </option>
                    ))}
                  </select>
                  {isConditional && (
                    <button
                      type="button"
                      className="icon-btn"
                      aria-label="Remove branch"
                      disabled={!canEdit}
                      onClick={() => removeDraft(d._key)}
                    >
                      ✕
                    </button>
                  )}
                </div>

                {isConditional && d.condition && (
                  <div className="flex flex-col gap-2">
                    {d.condition.rules.map((rule, idx) => {
                      const valueOptions = valueOptionsForField(rule.field);
                      return (
                        <div key={idx} className="wfd-rule-row">
                          <select
                            className="input"
                            style={{ fontSize: '12px', padding: '4px 6px' }}
                            value={rule.field}
                            disabled={!canEdit}
                            onChange={(e) => handleFieldChange(d._key, idx, e.target.value as WorkflowConditionField)}
                          >
                            {CONDITION_FIELDS.map((f) => (
                              <option key={f.value} value={f.value}>
                                {f.label}
                              </option>
                            ))}
                          </select>

                          <select
                            className="input"
                            style={{ fontSize: '12px', padding: '4px 6px' }}
                            value={rule.operator}
                            disabled={!canEdit}
                            onChange={(e) => updateRule(d._key, idx, { operator: e.target.value as any })}
                          >
                            {operatorsForField(rule.field).map((op) => (
                              <option key={op.value} value={op.value}>
                                {op.label}
                              </option>
                            ))}
                          </select>

                          {rule.field === 'metadata' ? (
                            <>
                              <select
                                className="input"
                                style={{ fontSize: '12px', padding: '4px 6px' }}
                                value={rule.metadata_field_id || ''}
                                disabled={!canEdit}
                                onChange={(e) => updateRule(d._key, idx, { metadata_field_id: e.target.value })}
                              >
                                <option value="" disabled>
                                  Field…
                                </option>
                                {(metadataFields || []).map((f) => (
                                  <option key={f.id} value={f.id}>
                                    {f.name} ({f.cabinetName})
                                  </option>
                                ))}
                              </select>
                              <input
                                className="input"
                                style={{ fontSize: '12px', padding: '4px 6px', width: '72px' }}
                                type="text"
                                placeholder="value"
                                value={String(rule.value)}
                                disabled={!canEdit}
                                onChange={(e) => updateRule(d._key, idx, { value: e.target.value })}
                              />
                            </>
                          ) : (
                            <select
                              className="input"
                              style={{ fontSize: '12px', padding: '4px 6px' }}
                              value={String(rule.value)}
                              disabled={!canEdit}
                              onChange={(e) => updateRule(d._key, idx, { value: e.target.value })}
                            >
                              {(valueOptions || []).map((v) => (
                                <option key={v.value} value={v.value}>
                                  {v.label}
                                </option>
                              ))}
                            </select>
                          )}

                          {d.condition!.rules.length > 1 && (
                            <button
                              type="button"
                              className="icon-btn"
                              aria-label="Remove rule"
                              disabled={!canEdit}
                              onClick={() => removeRule(d._key, idx)}
                            >
                              ✕
                            </button>
                          )}
                        </div>
                      );
                    })}

                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        className="btn btn-ghost btn-sm"
                        disabled={!canEdit || d.condition.rules.length >= 5}
                        onClick={() => addRule(d._key)}
                      >
                        + Add rule
                      </button>
                      {d.condition.rules.length > 1 && (
                        <div className="seg" role="group" aria-label="Match mode">
                          <button type="button" className={d.condition.mode === 'all' ? 'active' : ''} disabled={!canEdit} onClick={() => setMode(d._key, 'all')}>
                            All
                          </button>
                          <button type="button" className={d.condition.mode === 'any' ? 'active' : ''} disabled={!canEdit} onClick={() => setMode(d._key, 'any')}>
                            Any
                          </button>
                        </div>
                      )}
                    </div>

                    <label className="field" style={{ marginBottom: 0, maxWidth: '140px' }}>
                      <span style={{ fontSize: '11px', color: 'var(--muted)' }}>Priority</span>
                      <input
                        className="input"
                        type="number"
                        min={1}
                        style={{ fontSize: '12px', padding: '4px 6px' }}
                        value={d.priority ?? 1}
                        disabled={!canEdit}
                        onChange={(e) => updateDraft(d._key, { priority: Number(e.target.value) || 1 })}
                      />
                    </label>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      <button
        type="button"
        className="btn btn-secondary btn-sm mt-4"
        disabled={!canEdit || availableTargets.length === 0}
        title={availableTargets.length === 0 ? "Every other stage is already a target of one of this stage's branches" : undefined}
        onClick={addConditionalBranch}
      >
        + Add conditional branch
      </button>
      {availableTargets.length === 0 && otherStages.length > 0 && (
        <div className="help">
          Add another stage to route to before creating a conditional branch here — the backend
          won&apos;t allow two branches from the same stage to the same target.
        </div>
      )}

      {issues.length > 0 && (
        <div className="banner warning mt-4" style={{ marginBottom: 0 }}>
          {issues.map((issue, i) => (
            <div key={i}>{issue.message}</div>
          ))}
        </div>
      )}

      {drafts.some((d) => d.condition) && issues.length === 0 && (
        <div className="help mt-4">
          Documents take the first branch (in priority order) whose condition matches, or the
          fallback if none do.
        </div>
      )}

      <div className="flex gap-2 mt-4">
        <button
          className="btn btn-primary btn-sm"
          onClick={handleSave}
          disabled={!dirty || saving || !canEdit || issues.length > 0}
          title={!canEdit ? "You don't have permission to edit workflows" : undefined}
        >
          {saving ? 'Saving…' : 'Save transitions'}
        </button>
        {dirty && (
          <button className="btn btn-secondary btn-sm" onClick={handleDiscard} disabled={saving}>
            Discard
          </button>
        )}
      </div>
    </>
  );
}
