'use client';

import { useEffect, useState } from 'react';
import { useCabinet } from '@/apis/hooks/useCabinets';
import { isMetadataValueMissing } from '@/components/documents/MetadataFieldInput';
import type { CabinetMetadataField, DocumentMetadataValueInput } from '@/types/models';

/**
 * The metadata half of an upload form: the chosen cabinet's fields, the values
 * typed into them, and the `metadata` array for `POST /documents` (or each item
 * of `/batch`). The backend saves it with the document and refuses the upload
 * when a required field is missing (edms-backend `dd10017`), so a form must not
 * file while `missing` is non-empty or `loading` is true.
 *
 * Values start empty whenever the cabinet changes.
 */
export function useUploadMetadata(cabinetId: string | undefined) {
  // Only the single-cabinet GET carries the field schema.
  const { data: cabinet, isLoading } = useCabinet(cabinetId);
  const fields: CabinetMetadataField[] = (cabinet?.metadataFields ?? [])
    .slice()
    .sort((a, b) => a.displayOrder - b.displayOrder);

  const [values, setValues] = useState<Record<string, string>>({});
  useEffect(() => {
    setValues({});
  }, [cabinetId]);

  // An untouched checkbox reads "No", so a boolean starts as "false".
  const valueOf = (f: { id: string; fieldType: string }) =>
    values[f.id] ?? (f.fieldType === 'boolean' ? 'false' : '');
  const setValue = (fieldId: string, value: string) =>
    setValues((current) => ({ ...current, [fieldId]: value }));

  const missing = fields.filter((f) => isMetadataValueMissing(f, valueOf(f)));

  // Blank optional fields are left out; the backend stores no value for them.
  const toPayload = (): DocumentMetadataValueInput[] =>
    fields.map((f) => ({ fieldId: f.id, value: valueOf(f) })).filter((m) => m.value !== '');

  return { fields, loading: !!cabinetId && isLoading, valueOf, setValue, missing, toPayload };
}
