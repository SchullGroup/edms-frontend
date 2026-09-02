'use client';

export interface DocumentDetailsPanelProps {
  documentId: string;
  documentType?: string | null;
  cabinetId: string;
  ownerName: string;
  assigneeName: string;
  createdAtLabel: string;
  metadata: { fieldId: string; name: string; value?: string | null }[];
}

export function DocumentDetailsPanel({
  documentId,
  documentType,
  cabinetId,
  ownerName,
  assigneeName,
  createdAtLabel,
  metadata,
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
        {metadata.map((f) => (
          <div key={f.fieldId} className="meta-row">
            <span className="k">{f.name}</span>
            <span className="v">{f.value ?? '—'}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
