'use client';

import {
  ACTIVITY_RECORD_TYPES,
  AUDIT_ACTIONS,
  CONFIG_RECORD_TYPES,
  auditRecordType,
} from '@/constants/auditVocabulary';

/**
 * Record-type and action pickers for `GET /audit`. Both only offer values the
 * backend accepts (it 400s on anything else), and the action list narrows to
 * the chosen record type. The "Configuration" group is the configuration
 * history (story 18.7).
 */
export function AuditTypeActionFilters({
  objectType,
  action,
  onChange,
}: {
  objectType: string;
  action: string;
  onChange: (next: { objectType: string; action: string }) => void;
}) {
  const recordType = auditRecordType(objectType);
  const actionOptions = recordType ? AUDIT_ACTIONS.filter(recordType.actions) : AUDIT_ACTIONS;

  return (
    <>
      <select
        className="input"
        style={{ width: 'auto', height: '32px' }}
        aria-label="Filter by record type"
        value={objectType}
        onChange={(e) => {
          const next = auditRecordType(e.target.value);
          // Drop an action that can't occur on the new record type.
          const keepAction = !action || !next || next.actions(action);
          onChange({ objectType: e.target.value, action: keepAction ? action : '' });
        }}
      >
        <option value="">All records</option>
        <optgroup label="Configuration">
          {CONFIG_RECORD_TYPES.map((t) => (
            <option key={t.value} value={t.value}>
              {t.label}
            </option>
          ))}
        </optgroup>
        <optgroup label="Activity">
          {ACTIVITY_RECORD_TYPES.map((t) => (
            <option key={t.value} value={t.value}>
              {t.label}
            </option>
          ))}
        </optgroup>
      </select>
      <select
        className="input"
        style={{ width: 'auto', height: '32px' }}
        aria-label="Filter by action"
        value={action}
        onChange={(e) => onChange({ objectType, action: e.target.value })}
      >
        <option value="">All actions</option>
        {actionOptions.map((a) => (
          <option key={a} value={a}>
            {a}
          </option>
        ))}
      </select>
    </>
  );
}
