'use client';

import React, { useEffect, useState } from 'react';
import { useDocumentMetadata, useUpdateDocumentMetadata } from '@/apis/hooks/useDocuments';
import { Icon } from '@/components/ui/Icons';

export interface DocumentDetailsPanelProps {
  documentId: string;
  documentType?: string | null;
  cabinetId: string;
  ownerName: string;
  assigneeName: string;
  createdAtLabel: string;
  metadata: { fieldId: string; name: string; value?: string | null }[];
  /** When true, custom metadata fields become editable with a Save action. */
  canEditMetadata?: boolean;
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
  return (
    <div className="card">
      <div className="card-head">
        <span className="h3">Details</span>
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
        <div className="meta-row">
          <span className="k">Assignee</span>
          <span className="v">{assigneeName}</span>
        </div>
        <div className="meta-row">
          <span className="k">Created</span>
          <span className="v">{createdAtLabel}</span>
        </div>

        {canEditMetadata ? (
          <MetadataEditor documentId={documentId} />
        ) : (
          metadata.map((f) => (
            <div key={f.fieldId} className="meta-row">
              <span className="k">{f.name}</span>
              <span className="v">{f.value ?? '—'}</span>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

function MetadataEditor({ documentId }: { documentId: string }) {
  const { data: fields, isLoading } = useDocumentMetadata(documentId);
  const updateMetadata = useUpdateDocumentMetadata();
  const [draft, setDraft] = useState<Record<string, string>>({});
  const [dirty, setDirty] = useState(false);

  useEffect(() => {
    if (!fields) return;
    const next: Record<string, string> = {};
    for (const f of fields) next[f.fieldId] = f.value ?? '';
    setDraft(next);
    setDirty(false);
  }, [fields]);

  if (isLoading) return <div className="meta-row caption">Loading metadata…</div>;
  if (!fields || fields.length === 0) {
    return <div className="meta-row caption">No custom metadata fields on this cabinet.</div>;
  }

  const set = (fieldId: string, value: string) => {
    setDraft((d) => ({ ...d, [fieldId]: value }));
    setDirty(true);
  };

  const save = () => {
    updateMetadata.mutate(
      {
        id: documentId,
        values: fields.map((f) => ({ fieldId: f.fieldId, value: draft[f.fieldId] ?? '' })),
      },
      { onSuccess: () => setDirty(false) },
    );
  };

  return (
    <>
      {fields
        .slice()
        .sort((a, b) => a.displayOrder - b.displayOrder)
        .map((f) => (
          <div key={f.fieldId} className="meta-row" style={{ alignItems: 'center' }}>
            <span className="k">
              {f.name}
              {f.isRequired ? ' *' : ''}
            </span>
            <span className="v" style={{ maxWidth: '60%' }}>
              {f.fieldType === 'select' && f.options?.length ? (
                <select
                  className="input"
                  value={draft[f.fieldId] ?? ''}
                  onChange={(e) => set(f.fieldId, e.target.value)}
                >
                  <option value="">—</option>
                  {f.options.map((o) => (
                    <option key={o} value={o}>
                      {o}
                    </option>
                  ))}
                </select>
              ) : f.fieldType === 'boolean' ? (
                <input
                  type="checkbox"
                  checked={draft[f.fieldId] === 'true'}
                  onChange={(e) => set(f.fieldId, e.target.checked ? 'true' : 'false')}
                />
              ) : (
                <input
                  className="input"
                  type={
                    f.fieldType === 'number' ? 'number' : f.fieldType === 'date' ? 'date' : 'text'
                  }
                  value={draft[f.fieldId] ?? ''}
                  onChange={(e) => set(f.fieldId, e.target.value)}
                />
              )}
            </span>
          </div>
        ))}
      <div className="flex justify-end mt-2">
        <button
          className="btn btn-primary btn-sm"
          disabled={!dirty || updateMetadata.isPending}
          onClick={save}
        >
          <Icon name="save" size={13} /> {updateMetadata.isPending ? 'Saving…' : 'Save metadata'}
        </button>
      </div>
    </>
  );
}
