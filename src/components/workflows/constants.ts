import type {
  CabinetMetadataField,
  CabinetMetadataFieldType,
  WorkflowCondition,
  WorkflowConditionField,
  WorkflowConditionOperator,
  WorkflowConditionRule,
  WorkflowConditionValue,
  WorkflowStageAction,
} from '@/types/models';

// Real WorkflowStageAction values, no cosmetic "stage type" on top. A stage can
// allow several (a decision stage usually wants approve and reject).
export const STAGE_ACTIONS: { value: WorkflowStageAction; label: string; hint: string }[] = [
  { value: 'review', label: 'Review', hint: 'Marks it reviewed and advances to the next stage' },
  { value: 'approve', label: 'Approve', hint: 'Advances to the next stage' },
  { value: 'reject', label: 'Reject', hint: 'Ends the workflow' },
  { value: 'request_changes', label: 'Request changes', hint: 'Sends the file back to the previous stage' },
  { value: 'delegate', label: 'Delegate', hint: "Hands this stage off to someone else, without advancing it" },
  { value: 'close', label: 'Close', hint: 'Ends the workflow' },
];

export const actionLabel = (a: string) => STAGE_ACTIONS.find((x) => x.value === a)?.label || a;

export const DEFAULT_WORKFLOW_DEFINITION = {
  stages: [{ id: 'start', name: 'Start stage', role: 'staff', sla_hours: 24, actions: ['review'] }],
  transitions: [],
};

// --- Conditional routing -------------------------------------------------
// The backend's `workflow.constants.ts` and per-field rules, restated: its Zod schema enforces them.

export const CONDITION_FIELDS: { value: WorkflowConditionField; label: string }[] = [
  { value: 'urgency', label: 'Urgency' },
  { value: 'confidentiality', label: 'Confidentiality' },
  { value: 'metadata', label: 'Metadata field' },
];

const COMPARISON_OPERATORS: WorkflowConditionOperator[] = [
  'greater_than',
  'greater_than_or_equal',
  'less_than',
  'less_than_or_equal',
];

const OPERATOR_LABELS: Record<WorkflowConditionOperator, string> = {
  equals: 'equals',
  not_equals: 'does not equal',
  in: 'is one of',
  not_in: 'is not one of',
  greater_than: 'is greater than',
  greater_than_or_equal: 'is at least',
  less_than: 'is less than',
  less_than_or_equal: 'is at most',
};

/** The operators a rule may use: comparisons only on number/date metadata (else a 422,
 *  maybe mid-workflow), yes/no only equals/not. Unknown metadata type: all. */
export function operatorsForField(
  field: WorkflowConditionField,
  metadataFieldType?: CabinetMetadataFieldType,
) {
  const base: WorkflowConditionOperator[] = ['equals', 'not_equals', 'in', 'not_in'];
  let values = base;
  if (field === 'metadata') {
    if (metadataFieldType === 'boolean') values = ['equals', 'not_equals'];
    else if (metadataFieldType === 'text' || metadataFieldType === 'select') values = base;
    else values = [...base, ...COMPARISON_OPERATORS];
  }
  return values.map((value) => ({ value, label: OPERATOR_LABELS[value] }));
}

/** `in` / `not_in` take a list of values; every other operator takes one. */
export const isListOperator = (operator: WorkflowConditionOperator) =>
  operator === 'in' || operator === 'not_in';

/** A sensible starting value for a rule — a list for list operators. Free-form
 *  types start empty, so the author has to type a real value before saving. */
export function defaultRuleValue(
  field: WorkflowConditionField,
  operator: WorkflowConditionOperator,
  metadataField?: Pick<CabinetMetadataField, 'fieldType' | 'options'>,
): WorkflowConditionRule['value'] {
  const fixed = valueOptionsForField(field);
  let single: WorkflowConditionValue = '';
  if (fixed) single = fixed[0].value;
  else if (metadataField?.fieldType === 'boolean') single = true;
  else if (metadataField?.fieldType === 'select') single = metadataField.options?.[0] ?? '';
  if (!isListOperator(operator)) return single;
  return single === '' ? [] : [single];
}

/** Carries a rule's value across an operator change: one value becomes a
 *  one-item list and a list keeps its first item. */
export function coerceRuleValue(
  value: WorkflowConditionRule['value'],
  operator: WorkflowConditionOperator,
): WorkflowConditionRule['value'] {
  if (isListOperator(operator)) {
    if (Array.isArray(value)) return value;
    return value === '' ? [] : [value];
  }
  return Array.isArray(value) ? (value[0] ?? '') : value;
}

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

/** What's wrong with a rule's value for its field, or null, by the backend's rules
 *  for that field type (number, date, option, yes/no, a non-empty list). */
export function ruleValueIssue(
  rule: WorkflowConditionRule,
  metadataField?: Pick<CabinetMetadataField, 'name' | 'fieldType' | 'options'>,
): string | null {
  if (rule.field === 'metadata' && !rule.metadata_field_id) return 'Choose a metadata field.';
  const list = isListOperator(rule.operator);
  if (list && (!Array.isArray(rule.value) || rule.value.length === 0)) {
    return 'Add at least one value.';
  }
  const values = Array.isArray(rule.value) ? rule.value : [rule.value];

  const fixed = valueOptionsForField(rule.field);
  if (fixed) {
    return values.every((v) => fixed.some((o) => o.value === v)) ? null : 'Pick a value.';
  }
  if (!metadataField) return values.every((v) => String(v).trim()) ? null : 'Enter a value.';

  const name = metadataField.name;
  switch (metadataField.fieldType) {
    case 'number':
      return values.every((v) => String(v).trim() !== '' && Number.isFinite(Number(v)))
        ? null
        : `${name} is a number field — enter a number.`;
    case 'date':
      return values.every(
        (v) => typeof v === 'string' && DATE_RE.test(v) && !Number.isNaN(Date.parse(v)),
      )
        ? null
        : `${name} is a date field — pick a date.`;
    case 'boolean':
      return values.every((v) => v === true || v === false || v === 'true' || v === 'false')
        ? null
        : `${name} is a yes/no field — choose Yes or No.`;
    case 'select':
      return values.every((v) => metadataField.options?.includes(String(v)))
        ? null
        : `Choose from ${name}'s options.`;
    default:
      return values.every((v) => String(v).trim()) ? null : 'Enter a value.';
  }
}

export const URGENCY_VALUES = [
  { value: 'low', label: 'Low' },
  { value: 'normal', label: 'Normal' },
  { value: 'high', label: 'High' },
  { value: 'critical', label: 'Critical' },
];

export const CONFIDENTIALITY_VALUES = [
  { value: 'public', label: 'Public' },
  { value: 'internal', label: 'Internal' },
  { value: 'confidential', label: 'Confidential' },
  { value: 'restricted', label: 'Restricted' },
  { value: 'top_secret', label: 'Top secret' },
];

/** Fixed value choices for a field, or `null` when it's a free-form value
 *  (metadata — compared against whatever that field actually stores). */
export function valueOptionsForField(field: WorkflowConditionField) {
  if (field === 'urgency') return URGENCY_VALUES;
  if (field === 'confidentiality') return CONFIDENTIALITY_VALUES;
  return null;
}

export function defaultRule(): WorkflowConditionRule {
  return { field: 'urgency', operator: 'equals', value: 'critical' };
}

/** A branch's canvas label, e.g. "urgency = critical" or "2 rules (any)"; metadata
 *  rules use `fieldName` when it resolves. Display only. */
export function describeCondition(
  condition: WorkflowCondition | undefined,
  fieldName?: (metadataFieldId: string) => string | undefined,
): string {
  if (!condition) return 'Fallback';
  if (condition.rules.length === 1) {
    const rule = condition.rules[0];
    const label = OPERATOR_LABELS[rule.operator];
    const shown = (v: WorkflowConditionValue) =>
      v === true ? 'Yes' : v === false ? 'No' : String(v);
    const value = Array.isArray(rule.value) ? rule.value.map(shown).join(', ') : shown(rule.value);
    const fieldLabel =
      rule.field === 'metadata'
        ? (rule.metadata_field_id && fieldName?.(rule.metadata_field_id)) || 'metadata'
        : rule.field;
    // Symbols keep the canvas pill short enough to read without truncating.
    const symbol: Partial<Record<WorkflowConditionOperator, string>> = {
      equals: '=',
      not_equals: '≠',
      greater_than: '>',
      greater_than_or_equal: '≥',
      less_than: '<',
      less_than_or_equal: '≤',
    };
    return `${fieldLabel} ${symbol[rule.operator] ?? label} ${value}`;
  }
  return `${condition.rules.length} rules (${condition.mode})`;
}

/** A rule with its text values trimmed, as the backend stores them. */
export function trimRuleValues(rule: WorkflowConditionRule): WorkflowConditionRule {
  const trim = (v: WorkflowConditionValue) => (typeof v === 'string' ? v.trim() : v);
  return { ...rule, value: Array.isArray(rule.value) ? rule.value.map(trim) : trim(rule.value) };
}
