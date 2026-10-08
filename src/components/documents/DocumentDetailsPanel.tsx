'use client';

import React, { useState } from 'react';
import { useDocumentMetadata, useUpdateDocumentMetadata } from '@/apis/hooks/useDocuments';
import { useUIStore } from '@/store/useUIStore';
import { Icon } from '@/components/ui/Icons';
import { SkeletonText } from '@/components/common/Skeleton';
import { fmtDate } from '@/utils/helpers';
import type { DocumentMetadataField } from '@/types/models';
import { MetadataFieldInput, isMetadataValueMissing, toInputValue } from './MetadataFieldInput';

export interface DocumentDetailsPanelProps {
  documentId: string;
  documentType?: string | null;
  cabinetId: string;
  ownerName: string;
  /** Omitted on the view-only document page, which has no task context. */
  assigneeName?: string;
  createdAtLabel: string;
  /** The values embedded on the document — a fallback for anyone who can't
   *  read `GET /documents/:id/metadata` (it needs `document_metadata:view`). */
  metadata: { fieldId: string; name: string; value?: string | null }[];
  /** Shows "Edit metadata", which opens the editor in a dialog. */
  canEditMetadata?: boolean;
}

/** A stored value as people read it: dates and numbers formatted, yes/no in words. */
function displayValue(field: Pick<DocumentMetadataField, 'fieldType'>, value?: string | null) {
  if (value === null || value === undefined || value === '') return '—';
  switch (field.fieldType) {
    case 'date':
      return fmtDate(value);
    case 'boolean':
      return value === 'true' ? 'Yes' : 'No';
    case 'number': {
      const n = Number(value);
      return Number.isFinite(n) ? n.toLocaleString('en-GB') : value;
    }
    default:
      return value;
  }
}

export function DocumentDetailsPanel({
  documentId,
  documentType,
  cabinetId,
  ownerName,
  assigneeName,
  createdAtLabel,
  metadata,
  canEditMetadata = false,
}: DocumentDetailsPanelProps) {
  // Every field on the document's cabinet, set or not — the document itself
  // only embeds the ones that have a value.
  const { data: fields, isLoading, isError } = useDocumentMetadata(documentId);
  const { openModal } = useUIStore();
  const updateMetadata = useUpdateDocumentMetadata();

  const sorted = (fields ?? []).slice().sort((a, b) => a.displayOrder - b.displayOrder);
  const canEdit = canEditMetadata && sorted.length > 0;

  const openEditor = () => {
    // The dialog's body owns the draft; the Save action reads it from here.
    const form: { values: Record<string, string>; showErrors: () => void } = {
      values: {},
      showErrors: () => {},
    };
    openModal({
      title: 'Edit metadata',
      body: <MetadataEditor fields={sorted} form={form} />,
      actions: [
        { label: 'Cancel' },
        {
          label: 'Save changes',
          kind: 'btn-primary',
          onClick: () => {
            if (sorted.some((f) => isMetadataValueMissing(f, form.values[f.fieldId]))) {
              form.showErrors();
              return false;
            }
            // Only what changed. A field cleared back to empty is left out:
            // the API keeps a saved value rather than removing it.
            const changed = sorted
              .map((f) => ({ fieldId: f.fieldId, value: form.values[f.fieldId] ?? '' }))
              .filter(
                (v, i) => v.value !== '' && v.value !== toInputValue(sorted[i], sorted[i].value),
              );
            if (changed.length === 0) return;
            return updateMetadata
              .mutateAsync({ id: documentId, values: changed })
              .then(() => undefined)
              .catch(() => false);
          },
        },
      ],
    });
  };

  return (
    <div className="card">
      <div className="card-head">
        <span className="h3">Details</span>
        {canEdit && (
          <button className="btn btn-secondary btn-sm" onClick={openEditor}>
            <Icon name="edit" size={13} /> Edit metadata
          </button>
        )}
      </div>
      <div className="card-body" style={{ paddingTop: '6px' }}>
        <div className="meta-row">
          <span className="k">Document ID</span>
          <span className="v">{documentId.substring(0, 8).toUpperCase()}</span>
        </div>
        <div className="meta-row">
          <span className="k">Type</span>
          <span className="v">{documentType || '—'}</span>
        </div>
        <div className="meta-row">
          <span className="k">Cabinet</span>
          <span className="v">{cabinetId ? cabinetId.substring(0, 8) : 'Unknown'}</span>
        </div>
        <div className="meta-row">
          <span className="k">Owner</span>
          <span className="v">{ownerName}</span>
        </div>
        {assigneeName !== undefined && (
          <div className="meta-row">
            <span className="k">Assignee</span>
            <span className="v">{assigneeName}</span>
          </div>
        )}
        <div className="meta-row">
          <span className="k">Created</span>
          <span className="v">{createdAtLabel}</span>
        </div>

        {isLoading ? (
          <SkeletonText lines={2} />
        ) : !isError && fields ? (
          sorted.map((f) => (
            <div key={f.fieldId} className="meta-row">
              <span className="k">{f.name}</span>
              <span className="v">{displayValue(f, f.value)}</span>
            </div>
          ))
        ) : (
          metadata.map((f) => (
            <div key={f.fieldId} className="meta-row">
              <span className="k">{f.name}</span>
              <span className="v">{f.value || '—'}</span>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

/** The dialog body: one input per metadata field, typed to the field. */
function MetadataEditor({
  fields,
  form,
}: {
  fields: DocumentMetadataField[];
  form: { values: Record<string, string>; showErrors: () => void };
}) {
  const [values, setValues] = useState<Record<string, string>>(() => {
    const initial: Record<string, string> = {};
    // An unset yes/no shows as an unticked "No", so it starts as "false".
    for (const f of fields) {
      initial[f.fieldId] = toInputValue(f, f.value) || (f.fieldType === 'boolean' ? 'false' : '');
    }
    form.values = initial;
    return initial;
  });
  const [showErrors, setShowErrors] = useState(false);
  form.showErrors = () => setShowErrors(true);

  const set = (fieldId: string, value: string) =>
    setValues((current) => {
      const next = { ...current, [fieldId]: value };
      form.values = next;
      return next;
    });

  return (
    <div className="grid" style={{ gap: '12px' }}>
      {fields.map((f) => {
        const missing = showErrors && isMetadataValueMissing(f, values[f.fieldId]);
        return (
          <div key={f.fieldId} className="field" style={{ marginBottom: 0 }}>
            <label>
              {f.name} {f.isRequired && <span className="req">*</span>}
            </label>
            <MetadataFieldInput
              field={f}
              value={values[f.fieldId] ?? ''}
              invalid={missing}
              onChange={(v) => set(f.fieldId, v)}
            />
            {missing && (
              <div className="err" style={{ display: 'block' }}>
                Enter {f.name} — it&rsquo;s required.
              </div>
            )}
          </div>
        );
      })}
      <div className="help">Saved values can be changed, but not cleared.</div>
    </div>
  );
}
