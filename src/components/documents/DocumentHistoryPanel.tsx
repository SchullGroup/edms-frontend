'use client';

import React from 'react';
import { useDocumentHistory, useDocumentVersions } from '@/apis/hooks/useDocuments';
import { useCabinets } from '@/apis/hooks/useCabinets';
import { useCabinetFolders } from '@/apis/hooks/useFolders';
import { workstreamLabel } from '@/constants/documentWorkstreams';
import { documentStatusLabel, fmtDateTime, titleCase } from '@/utils/helpers';
import { folderPathLabel } from '@/utils/folders';
import { SkeletonText } from '@/components/common/Skeleton';
import type { DocumentHistoryEntry, DocumentVersion } from '@/types/models';

interface Props {
  documentId: string;
  /** The document's cabinet, to name folders in folder moves. */
  cabinetId: string;
  /** `document_version:view` — needed to name the version an entry refers to. */
  canViewVersions: boolean;
}

const ACTION_LABEL: Record<string, string> = {
  'document.uploaded': 'Uploaded the document',
  'document.edited': 'Changed details',
  'document.metadata_updated': 'Changed metadata',
  'document.version_created': 'Uploaded a new version',
  'document.version_restored': 'Restored a version',
  'document.deleted': 'Archived the document',
};

const ACTION_TONE: Record<string, string> = {
  'document.uploaded': 'var(--status-progress)',
  'document.version_created': 'var(--status-progress)',
  'document.version_restored': 'var(--status-pending)',
  'document.deleted': 'var(--status-overdue)',
};

/** Labels for `PATCH /documents/:id` fields; metadata changes are already keyed by field name. */
const FIELD_LABEL: Record<string, string> = {
  title: 'Title',
  documentType: 'Type',
  workstream: 'Workstream',
  cabinetId: 'Cabinet',
  folderId: 'Folder',
  confidentiality: 'Confidentiality',
  urgency: 'Urgency',
  status: 'Status',
};

interface Change {
  field: string;
  before: string;
  after: string;
}

/** Field-level history of a document (who changed what, and when), newest first. */
export function DocumentHistoryPanel({ documentId, cabinetId, canViewVersions }: Props) {
  const history = useDocumentHistory(documentId);
  const { data: versions } = useDocumentVersions(canViewVersions ? documentId : '');
  const { data: cabinetsData } = useCabinets();
  const { data: foldersData } = useCabinetFolders(cabinetId);

  const cabinets = cabinetsData?.data || [];
  const folders = foldersData?.data || [];
  const versionById = new Map<string, DocumentVersion>((versions || []).map((v) => [v.id, v]));

  const show = (field: string, value: unknown, isDocumentField: boolean): string => {
    if (value === null || value === undefined || value === '') return 'none';
    const text = String(value);
    if (!isDocumentField) return text;
    switch (field) {
      case 'confidentiality':
      case 'urgency':
        return titleCase(text);
      case 'status':
        return documentStatusLabel({ status: text });
      case 'workstream':
        return workstreamLabel(text) ?? text;
      case 'cabinetId':
        return cabinets.find((c) => c.id === text)?.name ?? 'another cabinet';
      case 'folderId':
        return folderPathLabel(folders, text) || 'a folder in another cabinet';
      default:
        return text;
    }
  };

  const changesOf = (entry: DocumentHistoryEntry): Change[] => {
    const { before = {}, after = {} } = entry.details;
    const isDocumentField = entry.action === 'document.edited';
    return Object.keys(after).map((field) => ({
      field: isDocumentField ? (FIELD_LABEL[field] ?? field) : field,
      before: show(field, before[field], isDocumentField),
      after: show(field, after[field], isDocumentField),
    }));
  };

  const labelOf = (entry: DocumentHistoryEntry): string => {
    const version = entry.objectId ? versionById.get(entry.objectId) : undefined;
    if (version && entry.action === 'document.version_created') {
      return `Uploaded version ${version.versionNumber}`;
    }
    if (version && entry.action === 'document.version_restored') {
      return `Restored version ${version.versionNumber}`;
    }
    const label = ACTION_LABEL[entry.action] ?? titleCase(entry.action.replace(/^document\./, ''));
    const count = entry.details.documentCount;
    return entry.details.batch && count && count > 1 ? `${label} (batch of ${count})` : label;
  };

  const entries = history.data?.pages.flatMap((p) => p.data) ?? [];

  return (
    <div className="card">
      <div className="card-head">
        <span className="h3">History</span>
      </div>
      <div className="card-body" style={{ paddingTop: '6px' }}>
        {history.isLoading && <SkeletonText lines={3} />}
        {history.isError && (
          <div className="caption">Couldn&apos;t load this document&apos;s history.</div>
        )}
        {!history.isLoading && !history.isError && entries.length === 0 && (
          <div className="caption">No changes recorded yet.</div>
        )}
        {/* Scrolls on its own, like the workflow activity trail. */}
        <div
          tabIndex={entries.length > 0 ? 0 : undefined}
          aria-label="Document history"
          style={{ maxHeight: 360, overflowY: 'auto', paddingRight: 4 }}
        >
          {entries.map((entry) => {
            const tone = ACTION_TONE[entry.action] || 'var(--border-strong)';
            const changes = changesOf(entry);
            const version = entry.objectId ? versionById.get(entry.objectId) : undefined;
            const note = entry.action === 'document.version_created' ? version?.changeNote : null;
            return (
              <div key={entry.id} className="wf-stage" style={{ cursor: 'default' }}>
                <div
                  className="wf-dot"
                  style={{ background: tone, borderColor: tone }}
                  aria-hidden="true"
                />
                <div className="wf-info" style={{ flex: 1, minWidth: 0 }}>
                  <div className="nm">{labelOf(entry)}</div>
                  <div className="who">
                    {entry.actor?.name || 'System'} · {fmtDateTime(entry.occurredAt)}
                  </div>
                  {changes.map((c) => (
                    <div key={c.field} className="caption" style={{ wordBreak: 'break-word' }}>
                      {c.field}: {c.before} → {c.after}
                    </div>
                  ))}
                  {note && <div className="wf-detail">{note}</div>}
                </div>
              </div>
            );
          })}
        </div>
        {history.hasNextPage && (
          <button
            className="btn btn-ghost btn-sm mt-2"
            onClick={() => history.fetchNextPage()}
            disabled={history.isFetchingNextPage}
          >
            {history.isFetchingNextPage ? 'Loading…' : 'Load more'}
          </button>
        )}
      </div>
    </div>
  );
}
