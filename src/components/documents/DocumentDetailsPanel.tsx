'use client';

import React, { useState } from 'react';
import {
  useDocumentMetadata,
  useUpdateDocument,
  useUpdateDocumentMetadata,
} from '@/apis/hooks/useDocuments';
import { useConfidentialityClearance } from '@/hooks/useConfidentialityClearance';
import { useUIStore } from '@/store/useUIStore';
import { ConfBadge, UrgBadge } from '@/components/ui/Badges';
import { Icon } from '@/components/ui/Icons';
import { SkeletonText } from '@/components/common/Skeleton';
import { fmtDate } from '@/utils/helpers';
import type {
  DocumentConfidentiality,
  DocumentMetadataField,
  DocumentUrgency,
} from '@/types/models';
import { CONF_LEVELS, TOP_SECRET_LEVEL, URG_LEVELS } from '@/constants/documentLevels';
import { MetadataFieldInput, isMetadataValueMissing, toInputValue } from './MetadataFieldInput';

export interface DocumentDetailsPanelProps {
  documentId: string;
  documentType?: string | null;
  cabinetId: string;
  /** The uploader; an `own`-scoped clearance covers only their documents. */
  createdBy?: string | null;
  ownerName: string;
  /** Omitted on the view-only document page, which has no task context. */
  assigneeName?: string;
  createdAtLabel: string;
  /** The values embedded on the document — a fallback for anyone who can't
   *  read `GET /documents/:id/metadata` (it needs `document_metadata:view`). */
  metadata: { fieldId: string; name: string; value?: string | null }[];
  /** Shows "Edit metadata", which opens the editor in a dialog. */
  canEditMetadata?: boolean;
  confidentiality: string;
  urgency: string;
  /** Shows "Change" on the classification rows (`PATCH /documents/:id`). */
  canEditClassification?: boolean;
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
  createdBy,
  ownerName,
  assigneeName,
  createdAtLabel,
  metadata,
  canEditMetadata = false,
  confidentiality,
  urgency,
  canEditClassification = false,
}: DocumentDetailsPanelProps) {
  // Every field on the document's cabinet, set or not — the document itself
  // only embeds the ones that have a value.
  const { data: fields, isLoading, isError } = useDocumentMetadata(documentId);
  const { openModal } = useUIStore();
  const updateMetadata = useUpdateDocumentMetadata();
  const updateDocument = useUpdateDocument();
  const { allows } = useConfidentialityClearance();

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

  const openClassificationEditor = () => {
    const form = {
      confidentiality: confidentiality as DocumentConfidentiality,
      urgency: urgency as DocumentUrgency,
    };
    // A level the caller couldn't open the document at is offered but disabled:
    // saving it would lock them out. Top Secret is listed only for someone cleared.
    const levels = [...CONF_LEVELS, TOP_SECRET_LEVEL]
      .map((l) => ({
        ...l,
        cleared: allows({ confidentiality: l.value, createdBy, cabinetId }, 'view'),
      }))
      .filter((l) => l.value !== 'top_secret' || l.cleared || confidentiality === 'top_secret');
    openModal({
      title: 'Change classification',
      body: (
        <ClassificationEditor
          initial={form}
          levels={levels}
          onChange={(next) => Object.assign(form, next)}
        />
      ),
      actions: [
        { label: 'Cancel' },
        {
          label: 'Save changes',
          kind: 'btn-primary',
          onClick: () => {
            const updates: {
              confidentiality?: DocumentConfidentiality;
              urgency?: DocumentUrgency;
            } = {};
            if (form.confidentiality !== confidentiality)
              updates.confidentiality = form.confidentiality;
            if (form.urgency !== urgency) updates.urgency = form.urgency;
            if (Object.keys(updates).length === 0) return;
            return updateDocument
              .mutateAsync({ id: documentId, updates })
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
        <div className="meta-row">
          <span className="k">Classification</span>
          <span className="v flex items-center gap-2">
            <ConfBadge level={confidentiality} />
            <UrgBadge level={urgency} />
            {canEditClassification && (
              <button className="btn btn-ghost btn-sm" onClick={openClassificationEditor}>
                Change
              </button>
            )}
          </span>
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

/** The classification dialog body. A confidentiality level the user isn't cleared
 *  to view is disabled: saving it would lock them out of the document. */
function ClassificationEditor({
  initial,
  levels,
  onChange,
}: {
  initial: { confidentiality: DocumentConfidentiality; urgency: DocumentUrgency };
  levels: { label: string; value: DocumentConfidentiality; cleared: boolean }[];
  onChange: (next: { confidentiality: DocumentConfidentiality; urgency: DocumentUrgency }) => void;
}) {
  const [value, setValue] = useState(initial);
  const set = (patch: Partial<typeof value>) => {
    const next = { ...value, ...patch };
    setValue(next);
    onChange(next);
  };

  return (
    <div className="grid" style={{ gap: '12px' }}>
      <div className="field" style={{ marginBottom: 0 }}>
        <label htmlFor="doc-confidentiality">Confidentiality</label>
        <select
          id="doc-confidentiality"
          className="input"
          value={value.confidentiality}
          onChange={(e) => set({ confidentiality: e.target.value as DocumentConfidentiality })}
        >
          {levels.map((l) => (
            <option key={l.value} value={l.value} disabled={!l.cleared}>
              {l.label}
              {l.cleared ? '' : ' (above your clearance)'}
            </option>
          ))}
        </select>
        <div className="help">
          Drives watermarking, download and print, and who can open the document.
        </div>
      </div>
      <div className="field" style={{ marginBottom: 0 }}>
        <label htmlFor="doc-urgency">Urgency</label>
        <select
          id="doc-urgency"
          className="input"
          value={value.urgency}
          onChange={(e) => set({ urgency: e.target.value as DocumentUrgency })}
        >
          {URG_LEVELS.map((l) => (
            <option key={l.value} value={l.value}>
              {l.label}
            </option>
          ))}
        </select>
        <div className="help">
          Sets the deadline of each workflow stage the document enters from now on. A stage already
          under way keeps its deadline.
        </div>
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
