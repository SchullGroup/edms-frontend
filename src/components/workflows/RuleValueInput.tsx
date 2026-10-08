'use client';

import { useEffect, useState } from 'react';
import { DateField } from '@/components/ui/DatePicker';
import { isListOperator, valueOptionsForField } from './constants';
import type {
  CabinetMetadataField,
  WorkflowConditionRule,
  WorkflowConditionValue,
} from '@/types/models';

const CONTROL_STYLE = { fontSize: '12px', padding: '4px 6px' } as const;
/** Takes what's left of the rule row. */
const FILL = { flex: '1 1 120px', width: 'auto', minWidth: 0 } as const;

/**
 * The value side of a branch rule, shaped by what it's compared against: the
 * fixed list for urgency/confidentiality, and for a metadata field its own
 * type — a number box, a date picker, Yes/No, the field's dropdown options,
 * or plain text. `in` / `not_in` take several values: tick-boxes for a fixed
 * list, a comma-separated box for typed values. Values are stored the way the
 * backend compares them: numbers as numbers, yes/no as booleans, dates as
 * "YYYY-MM-DD".
 */
export function RuleValueInput({
  rule,
  metadataField,
  invalid,
  disabled,
  onChange,
}: {
  rule: WorkflowConditionRule;
  metadataField?: Pick<CabinetMetadataField, 'fieldType' | 'options'>;
  invalid: boolean;
  disabled: boolean;
  onChange: (value: WorkflowConditionRule['value']) => void;
}) {
  const list = isListOperator(rule.operator);
  const type = rule.field === 'metadata' ? metadataField?.fieldType : undefined;
  const cls = `input ${invalid ? 'invalid' : ''}`;

  // A fixed set of choices: urgency, confidentiality, a dropdown field, yes/no.
  const fixed =
    valueOptionsForField(rule.field) ??
    (type === 'select'
      ? (metadataField?.options ?? []).map((o) => ({ value: o, label: o }))
      : type === 'boolean'
        ? [
            { value: 'true', label: 'Yes' },
            { value: 'false', label: 'No' },
          ]
        : null);
  // Yes/no is offered as strings in the control but stored as booleans.
  const toStored = (v: string): WorkflowConditionValue => (type === 'boolean' ? v === 'true' : v);

  if (fixed) {
    if (fixed.length === 0) {
      return (
        <select className={cls} style={{ ...CONTROL_STYLE, ...FILL }} disabled>
          <option>No options defined for this field</option>
        </select>
      );
    }
    if (list) {
      const chosen = new Set((Array.isArray(rule.value) ? rule.value : []).map(String));
      return (
        <div className="flex gap-1 flex-wrap" style={FILL} role="group" aria-label="Values">
          {fixed.map((o) => {
            const on = chosen.has(o.value);
            return (
              <button
                key={o.value}
                type="button"
                className="tag"
                aria-pressed={on}
                disabled={disabled}
                style={{
                  cursor: disabled ? 'default' : 'pointer',
                  ...(on
                    ? { borderColor: 'var(--focus)', color: 'var(--focus)', fontWeight: 700 }
                    : {}),
                }}
                onClick={() => {
                  const next = new Set(chosen);
                  if (on) next.delete(o.value);
                  else next.add(o.value);
                  onChange(fixed.filter((f) => next.has(f.value)).map((f) => toStored(f.value)));
                }}
              >
                {o.label}
              </button>
            );
          })}
        </div>
      );
    }
    return (
      <select
        className={cls}
        style={{ ...CONTROL_STYLE, ...FILL }}
        value={String(rule.value)}
        disabled={disabled}
        onChange={(e) => onChange(toStored(e.target.value))}
      >
        {type === 'select' && !fixed.some((o) => o.value === String(rule.value)) && (
          <option value={String(rule.value)} disabled>
            Choose…
          </option>
        )}
        {fixed.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    );
  }

  if (list) {
    return (
      <ListValueInput
        rule={rule}
        type={type}
        className={cls}
        disabled={disabled}
        onChange={onChange}
      />
    );
  }

  if (type === 'date') {
    return (
      <div style={FILL}>
        <DateField
          compact
          value={typeof rule.value === 'string' ? rule.value : ''}
          onChange={(v) => onChange(v)}
          disabled={disabled}
          aria-label="Value"
        />
      </div>
    );
  }

  if (type === 'number') {
    return (
      <input
        className={cls}
        style={{ ...CONTROL_STYLE, ...FILL }}
        type="number"
        step="any"
        inputMode="decimal"
        placeholder="number"
        aria-label="Value"
        value={rule.value === '' ? '' : String(rule.value)}
        disabled={disabled}
        // Stored as a number; an empty box stays '' so validation flags it.
        onChange={(e) => onChange(e.target.value === '' ? '' : Number(e.target.value))}
      />
    );
  }

  return (
    <input
      className={cls}
      style={{ ...CONTROL_STYLE, ...FILL }}
      type="text"
      placeholder="value"
      aria-label="Value"
      value={String(rule.value)}
      disabled={disabled}
      onChange={(e) => onChange(e.target.value)}
    />
  );
}

/** Several typed values, comma-separated. Numbers are stored as numbers;
 *  anything that doesn't parse is kept as typed so validation can flag it. */
function ListValueInput({
  rule,
  type,
  className,
  disabled,
  onChange,
}: {
  rule: WorkflowConditionRule;
  type?: CabinetMetadataField['fieldType'];
  className: string;
  disabled: boolean;
  onChange: (value: WorkflowConditionRule['value']) => void;
}) {
  const stored = Array.isArray(rule.value) ? rule.value : [];
  const [text, setText] = useState(stored.join(', '));
  // Re-sync when the rule changes from outside (field or operator switched).
  useEffect(() => {
    setText(stored.join(', '));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rule.metadata_field_id, rule.operator, rule.field]);

  return (
    <input
      className={className}
      style={{ ...CONTROL_STYLE, ...FILL }}
      type="text"
      placeholder={
        type === 'number'
          ? 'e.g. 100, 250'
          : type === 'date'
            ? 'e.g. 2026-01-31, 2026-02-28'
            : 'a, b, c'
      }
      aria-label="Values, comma-separated"
      value={text}
      disabled={disabled}
      onChange={(e) => {
        setText(e.target.value);
        const parts = e.target.value
          .split(',')
          .map((p) => p.trim())
          .filter(Boolean);
        onChange(
          parts.map((p) => (type === 'number' && Number.isFinite(Number(p)) ? Number(p) : p)),
        );
      }}
    />
  );
}
