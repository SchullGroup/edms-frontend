'use client';

import { CONDITION_FIELDS, operatorsForField } from './constants';
import { RuleValueInput } from './RuleValueInput';
import { useBranchDraft } from '@/hooks/useBranchDraft';
import type { WorkflowConditionField, WorkflowStage, WorkflowTransition } from '@/types/models';

export interface BranchEditorCardProps {
  stage: WorkflowStage;
  stages: WorkflowStage[];
  transitions: WorkflowTransition[];
  /** The whole definition, since a parallel branch can change other stages. */
  onSave: (definition: { stages: WorkflowStage[]; transitions: WorkflowTransition[] }) => void;
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
    parallel,
    joinStageId,
    joinOptions,
    setJoinStageId,
    sideEffects,
    updateDraft,
    removeDraft,
    addConditionalBranch,
    addParallelBranch,
    addRule,
    removeRule,
    updateRule,
    setMode,
    handleFieldChange,
    handleMetadataFieldChange,
    handleOperatorChange,
    fieldById,
    ruleIssue,
    handleSave,
    handleDiscard,
  } = useBranchDraft(stage, stages, transitions, onSave);

  const hasConditional = drafts.some((d) => d.condition);
  const hasUnconditional = drafts.some((d) => !d.condition);
  const tagFor = (isConditional: boolean, priority?: number) =>
    isConditional
      ? { className: 'wfd-tag-conditional', text: `Priority ${priority ?? '?'}` }
      : parallel
        ? { className: 'wfd-tag-parallel', text: 'Parallel' }
        : hasConditional
          ? { className: 'wfd-tag-fallback', text: 'Fallback' }
          : { className: 'wfd-tag-fallback', text: 'Next' };

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
            const tag = tagFor(isConditional, d.priority);
            return (
              <div key={d._key} className="wfd-transition-card">
                <div className="flex items-center gap-2" style={{ marginBottom: isConditional ? '10px' : 0 }}>
                  <span className={`tag ${tag.className}`}>{tag.text}</span>
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
                  {(isConditional || parallel) && (
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
                      const metadataField =
                        rule.field === 'metadata' ? fieldById(rule.metadata_field_id) : undefined;
                      const issue = ruleIssue(rule);
                      return (
                        <div key={idx}>
                          {/* Reads as a sentence: field · (which field) · operator · value. */}
                          <div className="wfd-rule-row">
                            <select
                              className="input"
                              style={{ fontSize: '12px', padding: '4px 6px' }}
                              value={rule.field}
                              disabled={!canEdit}
                              onChange={(e) =>
                                handleFieldChange(
                                  d._key,
                                  idx,
                                  e.target.value as WorkflowConditionField,
                                )
                              }
                            >
                              {CONDITION_FIELDS.map((f) => (
                                <option key={f.value} value={f.value}>
                                  {f.label}
                                </option>
                              ))}
                            </select>

                            {rule.field === 'metadata' && (
                              <select
                                className="input"
                                style={{ fontSize: '12px', padding: '4px 6px' }}
                                value={rule.metadata_field_id || ''}
                                disabled={!canEdit}
                                onChange={(e) =>
                                  handleMetadataFieldChange(d._key, idx, rule, e.target.value)
                                }
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
                            )}

                            <select
                              className="input"
                              style={{ fontSize: '12px', padding: '4px 6px' }}
                              value={rule.operator}
                              disabled={!canEdit}
                              onChange={(e) =>
                                handleOperatorChange(d._key, idx, rule, e.target.value as any)
                              }
                            >
                              {operatorsForField(rule.field, metadataField?.fieldType).map((op) => (
                                <option key={op.value} value={op.value}>
                                  {op.label}
                                </option>
                              ))}
                            </select>

                            <RuleValueInput
                              rule={rule}
                              metadataField={metadataField}
                              invalid={!!issue}
                              disabled={!canEdit}
                              onChange={(value) => updateRule(d._key, idx, { value })}
                            />

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
                          {issue && (
                            <div className="err" style={{ display: 'block', marginTop: '4px' }}>
                              {issue}
                            </div>
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

      {parallel && (
        <label className="field mt-4" style={{ marginBottom: 0 }}>
          <span>Branches meet at</span>
          <select
            className="input"
            style={{ fontSize: '12.5px', padding: '4px 8px' }}
            value={joinStageId ?? ''}
            disabled={!canEdit}
            onChange={(e) => setJoinStageId(e.target.value || null)}
          >
            <option value="">Nowhere — each branch finishes on its own</option>
            {joinOptions.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name || s.id}
              </option>
            ))}
          </select>
          <div className="help">
            {joinStageId
              ? `Every branch runs at once, each with its own task and SLA. ${
                  joinOptions.find((s) => s.id === joinStageId)?.name || 'That stage'
                } opens only once all of them reach it.`
              : 'Every branch runs at once, each with its own task and SLA. The workflow closes once every branch has finished.'}
          </div>
        </label>
      )}

      <div className="flex gap-2 flex-wrap mt-4">
        <button
          type="button"
          className="btn btn-secondary btn-sm"
          disabled={!canEdit || availableTargets.length === 0 || parallel}
          title={
            parallel
              ? 'Parallel branches all run, so they can’t also be chosen by a condition — remove branches until one is left first'
              : availableTargets.length === 0
                ? "Every other stage is already a target of one of this stage's branches"
                : undefined
          }
          onClick={addConditionalBranch}
        >
          + Add conditional branch
        </button>
        {hasUnconditional && (
          <button
            type="button"
            className="btn btn-secondary btn-sm"
            disabled={!canEdit || availableTargets.length === 0 || hasConditional}
            title={
              hasConditional
                ? 'A stage with conditional branches sends each document down one of them — remove the conditions to run branches in parallel'
                : availableTargets.length === 0
                  ? "Every other stage is already a target of one of this stage's branches"
                  : 'Send documents down another branch at the same time'
            }
            onClick={addParallelBranch}
          >
            + Add parallel branch
          </button>
        )}
      </div>
      {availableTargets.length === 0 && otherStages.length > 0 && (
        <div className="help">
          Add another stage to route to before adding a branch here — the backend won&apos;t allow
          two branches from the same stage to the same target.
        </div>
      )}

      {dirty && sideEffects.length > 0 && issues.length === 0 && (
        <div className="help mt-4">
          Saving also changes:
          <ul style={{ margin: '4px 0 0', paddingLeft: '18px' }}>
            {sideEffects.map((note) => (
              <li key={note}>{note}</li>
            ))}
          </ul>
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
