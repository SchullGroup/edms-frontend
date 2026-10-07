'use client';

import React from 'react';
import { DateField } from '@/components/ui/DatePicker';
import type { CabinetMetadataFieldType } from '@/types/models';

export interface MetadataFieldLike {
  name: string;
  fieldType: CabinetMetadataFieldType;
  isRequired: boolean;
  options?: string[] | null;
}

/**
 * One input for a cabinet metadata field, shared by the upload form and the
 * document page so both render a field type the same way. Values are the
 * strings `PUT /documents/:id/metadata` accepts: booleans as "true"/"false",
 * dates as "YYYY-MM-DD" (the API stores an ISO timestamp — `toInputValue`
 * trims one back down for display).
 */
export function MetadataFieldInput({
  field,
  value,
  onChange,
  invalid = false,
}: {
  field: MetadataFieldLike;
  value: string;
  onChange: (value: string) => void;
  invalid?: boolean;
}) {
  const cls = `input ${invalid ? 'invalid' : ''}`;

  switch (field.fieldType) {
    case 'select':
      // Cabinet Designer has no way to set options yet, so a select field can
      // arrive with none — nothing could pass the API's allowlist check.
      if (!field.options?.length) {
        return (
          <select className={cls} disabled aria-label={field.name}>
            <option>No options defined for this field</option>
          </select>
        );
      }
      return (
        <select
          className={cls}
          value={value}
          aria-label={field.name}
          onChange={(e) => onChange(e.target.value)}
        >
          <option value="">—</option>
          {field.options.map((o) => (
            <option key={o} value={o}>
              {o}
            </option>
          ))}
        </select>
      );
    case 'boolean':
      return (
        <label className="check">
          <input
            type="checkbox"
            checked={value === 'true'}
            onChange={(e) => onChange(e.target.checked ? 'true' : 'false')}
          />{' '}
          {value === 'true' ? 'Yes' : 'No'}
        </label>
      );
    case 'date':
      return (
        <DateField
          value={toInputValue(field, value)}
          onChange={onChange}
          clearable={!field.isRequired}
          aria-label={field.name}
        />
      );
    default:
      return (
        <input
          className={cls}
          type={field.fieldType === 'number' ? 'number' : 'text'}
          value={value}
          aria-label={field.name}
          onChange={(e) => onChange(e.target.value)}
        />
      );
  }
}

/** A stored value as the matching input expects it: dates come back from the API
 *  as full ISO timestamps, which a date picker can't read. */
export function toInputValue(field: Pick<MetadataFieldLike, 'fieldType'>, value?: string | null) {
  if (!value) return '';
  return field.fieldType === 'date' ? value.slice(0, 10) : value;
}

/** Whether a required field has been filled in. An unticked boolean is a real
 *  answer ("No"), so a boolean always counts. */
export function isMetadataValueMissing(field: MetadataFieldLike, value: string | undefined) {
  if (!field.isRequired || field.fieldType === 'boolean') return false;
  return !value?.trim();
}
