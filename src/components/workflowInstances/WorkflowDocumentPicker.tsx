'use client';

import React, { useEffect, useRef, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useCabinets } from '@/apis/hooks/useCabinets';
import { useCabinetFolders } from '@/apis/hooks/useFolders';
import { useDocumentSearch } from '@/apis/hooks/useDocuments';
import { useMultipartUploader } from '@/apis/hooks/useMultipartUploader';
import { documentsService } from '@/apis/services/documents.service';
import { calculateChecksum } from '@/apis/services/s3.service';
import { DOCUMENT_TYPES } from '@/constants/documentTypes';
import { UPLOAD_ACCEPT, UPLOAD_TYPES_LABEL, resolveUploadMimeType } from '@/constants/uploadTypes';
import { ConfBadge } from '@/components/ui/Badges';
import { Icon } from '@/components/ui/Icons';
import { useUIStore } from '@/store/useUIStore';

export interface PickedDocument {
  id: string;
  title: string;
  /** Created from an upload in this picker (it now exists in its cabinet). */
  uploaded?: boolean;
}

/** Starting values for the upload form — the workflow's primary document's. */
export interface UploadDefaults {
  cabinetId?: string;
  confidentiality?: string;
  urgency?: string;
}

export interface WorkflowDocumentPickerProps {
  /** Documents already in the workflow — not offered again (the backend 409s). */
  excludeIds: string[];
  /** Restores a selection, e.g. when stepping back to this picker. */
  initialSelected?: PickedDocument[];
  uploadDefaults?: UploadDefaults;
  onChange: (documents: PickedDocument[]) => void;
}

const CONF_LEVELS = ['public', 'internal', 'confidential', 'restricted'];
const URG_LEVELS = ['low', 'normal', 'high', 'critical'];
const SEARCH_DEBOUNCE_MS = 350;
const MIN_QUERY = 2;

/**
 * Chooses documents to attach to a workflow — either existing ones, found by
 * title, or a file from the user's computer, which is filed as a new document
 * and queued. Both tabs feed one selection list.
 */
export function WorkflowDocumentPicker({
  excludeIds,
  initialSelected = [],
  uploadDefaults = {},
  onChange,
}: WorkflowDocumentPickerProps) {
  const [mode, setMode] = useState<'existing' | 'upload'>('existing');
  const [selected, setSelected] = useState<PickedDocument[]>(initialSelected);

  const update = (next: PickedDocument[]) => {
    setSelected(next);
    onChange(next);
  };
  const toggle = (doc: PickedDocument) =>
    update(
      selected.some((d) => d.id === doc.id)
        ? selected.filter((d) => d.id !== doc.id)
        : [...selected, doc],
    );

  const excluded = new Set(excludeIds);

  return (
    <div>
      <div className="seg mb-4" role="tablist" aria-label="Where the document comes from">
        <button
          type="button"
          role="tab"
          aria-selected={mode === 'existing'}
          className={mode === 'existing' ? 'active' : ''}
          onClick={() => setMode('existing')}
        >
          From a cabinet
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={mode === 'upload'}
          className={mode === 'upload' ? 'active' : ''}
          onClick={() => setMode('upload')}
        >
          Upload from computer
        </button>
      </div>

      {mode === 'existing' ? (
        <ExistingDocumentSearch
          excluded={excluded}
          selectedIds={new Set(selected.map((d) => d.id))}
          onToggle={toggle}
        />
      ) : (
        <UploadNewDocument
          defaults={uploadDefaults}
          onCreated={(doc) => update([...selected, doc])}
        />
      )}

      <div className="field mt-4" style={{ marginBottom: 0 }}>
        <label>To attach ({selected.length})</label>
        {selected.length === 0 ? (
          <div className="caption">Nothing chosen yet.</div>
        ) : (
          <div className="flex gap-2 flex-wrap">
            {selected.map((d) => (
              <span key={d.id} className="tag" style={{ display: 'inline-flex', gap: 6 }}>
                {d.title}
                {d.uploaded && <span className="caption">· new</span>}
                <button
                  type="button"
                  aria-label={`Remove ${d.title}`}
                  onClick={() => toggle(d)}
                  style={{ border: 0, background: 'none', cursor: 'pointer', padding: 0 }}
                >
                  ×
                </button>
              </span>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

/** Debounced title search over `GET /documents/search?q=&cabinetId=`. */
function ExistingDocumentSearch({
  excluded,
  selectedIds,
  onToggle,
}: {
  excluded: Set<string>;
  selectedIds: Set<string>;
  onToggle: (doc: PickedDocument) => void;
}) {
  const [cabinetId, setCabinetId] = useState('');
  const [query, setQuery] = useState('');
  const [debounced, setDebounced] = useState('');

  useEffect(() => {
    const t = window.setTimeout(() => setDebounced(query.trim()), SEARCH_DEBOUNCE_MS);
    return () => window.clearTimeout(t);
  }, [query]);

  const { data: cabinetsData } = useCabinets();
  const cabinets = cabinetsData?.data || [];
  const searchTerm = debounced.length >= MIN_QUERY ? debounced : '';
  const { data, isFetching } = useDocumentSearch(searchTerm, {
    ...(cabinetId ? { cabinetId } : {}),
    limit: 20,
  });
  // The backend refuses a document with no current version.
  const results = (data?.data || []).filter((d) => !excluded.has(d.id) && !!d.currentVersionId);
  const typing = query.trim() !== debounced;

  return (
    <div>
      <div className="flex gap-2 mb-2 flex-wrap">
        <input
          className="input"
          style={{ flex: '2 1 200px' }}
          placeholder="Search documents by title…"
          aria-label="Search documents by title"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          autoFocus
        />
        <select
          className="input"
          style={{ flex: '1 1 140px' }}
          aria-label="Limit to a cabinet"
          value={cabinetId}
          onChange={(e) => setCabinetId(e.target.value)}
        >
          <option value="">All cabinets</option>
          {cabinets.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
      </div>

      <div
        style={{
          maxHeight: 220,
          overflowY: 'auto',
          border: '1px solid var(--border)',
          borderRadius: 9,
          padding: '6px 10px',
        }}
        aria-live="polite"
      >
        {query.trim().length < MIN_QUERY ? (
          <div className="caption" style={{ padding: '8px 0' }}>
            Type at least {MIN_QUERY} characters of a title to search.
          </div>
        ) : typing || isFetching ? (
          <div className="caption" style={{ padding: '8px 0' }}>
            Searching…
          </div>
        ) : results.length === 0 ? (
          <div className="caption" style={{ padding: '8px 0' }}>
            No documents match. Newly uploaded files can take a moment to become searchable.
          </div>
        ) : (
          results.map((d) => (
            <label
              key={d.id}
              className="flex items-center gap-2"
              style={{ padding: '6px 0', fontWeight: 500, cursor: 'pointer' }}
            >
              <input
                type="checkbox"
                checked={selectedIds.has(d.id)}
                onChange={() => onToggle({ id: d.id, title: d.title })}
              />
              <span style={{ flex: 1, minWidth: 0 }}>{d.title}</span>
              <ConfBadge level={d.confidentiality} />
            </label>
          ))
        )}
      </div>
    </div>
  );
}

/**
 * Files a document from the user's computer — upload, then `POST /documents` —
 * and queues it. It exists in its cabinet from that moment, whether or not the
 * review is completed.
 */
function UploadNewDocument({
  defaults,
  onCreated,
}: {
  defaults: UploadDefaults;
  onCreated: (doc: PickedDocument) => void;
}) {
  const { addToast } = useUIStore();
  const queryClient = useQueryClient();
  const { startUpload, uploadProgress } = useMultipartUploader();

  const [file, setFile] = useState<File | null>(null);
  const [dragging, setDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [title, setTitle] = useState('');
  const [documentType, setDocumentType] = useState<string>(DOCUMENT_TYPES[0]);
  const [cabinetId, setCabinetId] = useState(defaults.cabinetId ?? '');
  const [folderId, setFolderId] = useState('');
  const [confidentiality, setConfidentiality] = useState(defaults.confidentiality ?? 'internal');
  const [urgency, setUrgency] = useState(defaults.urgency ?? 'normal');
  const [busy, setBusy] = useState(false);

  const { data: cabinetsData } = useCabinets();
  const cabinets = cabinetsData?.data || [];
  const { data: foldersData } = useCabinetFolders(cabinetId || undefined);
  const folders = foldersData?.data || [];

  const pickFile = (f: File | null) => {
    setFile(f);
    if (f && !title) setTitle(f.name.replace(/\.[^.]+$/, ''));
  };

  // A document must land in a folder — same rule as the Upload page.
  const ready = !!file && !!title.trim() && !!cabinetId && !!folderId;

  const upload = async () => {
    if (!file || !ready) return;
    setBusy(true);
    try {
      const checksum = await calculateChecksum(file);
      const fileUrl = await startUpload({ file, fileName: file.name, folderName: 'edmsDocuments' });
      const created = await documentsService.create({
        title: title.trim(),
        documentType,
        cabinetId,
        folderId,
        confidentiality,
        urgency,
        fileUrl,
        mimeType: resolveUploadMimeType(file) ?? file.type,
        fileSize: file.size,
        checksum,
      });
      queryClient.invalidateQueries({ queryKey: ['documents'] });
      onCreated({ id: created.id, title: created.title, uploaded: true });
      addToast(`“${created.title}” uploaded and added to the list`, 'success');
      setFile(null);
      setTitle('');
    } catch (err: any) {
      addToast(err?.response?.data?.message || err?.message || 'Upload failed', 'error');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div>
      <div className="field">
        <label>
          File <span className="req">*</span>
        </label>
        {/* Same `.dropzone` as the Upload page, compacted for a modal. One file
            at a time — each becomes its own document. */}
        <div
          className={`dropzone ${dragging ? 'over' : ''}`}
          style={{ padding: '18px 16px', borderRadius: 12, opacity: busy ? 0.6 : 1 }}
          tabIndex={busy ? -1 : 0}
          role="button"
          aria-label={file ? `Selected file ${file.name}. Choose a different file` : 'Choose a file to upload'}
          aria-disabled={busy}
          onClick={() => !busy && fileInputRef.current?.click()}
          onKeyDown={(e) => {
            if (!busy && (e.key === 'Enter' || e.key === ' ')) {
              e.preventDefault();
              fileInputRef.current?.click();
            }
          }}
          onDragOver={(e) => {
            e.preventDefault();
            if (!busy) setDragging(true);
          }}
          onDragLeave={() => setDragging(false)}
          onDrop={(e) => {
            e.preventDefault();
            setDragging(false);
            if (busy) return;
            const dropped = e.dataTransfer.files?.[0];
            if (dropped) pickFile(dropped);
          }}
        >
          {busy ? (
            <div style={{ textAlign: 'left' }}>
              <div style={{ fontWeight: 600, fontSize: '12.5px' }}>{file?.name}</div>
              <div className="up-prog" style={{ marginTop: 8 }}>
                <i style={{ width: `${uploadProgress}%` }}></i>
              </div>
              <div className="caption" style={{ marginTop: 4 }}>
                Uploading… {uploadProgress}%
              </div>
            </div>
          ) : file ? (
            <div className="flex items-center gap-2" style={{ textAlign: 'left' }}>
              <Icon name="doc" size={20} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontWeight: 600, fontSize: '12.5px' }}>{file.name}</div>
                <div className="caption">{(file.size / 1024 / 1024).toFixed(2)} MB</div>
              </div>
              <span className="caption">Drop or click to change</span>
            </div>
          ) : (
            <>
              <div style={{ fontWeight: 700, fontSize: '13px' }}>
                Drag &amp; drop a file here
              </div>
              <div className="muted" style={{ marginTop: 4, fontSize: '12px' }}>
                or click to browse · {UPLOAD_TYPES_LABEL}
              </div>
            </>
          )}
        </div>
        <input
          ref={fileInputRef}
          type="file"
          accept={UPLOAD_ACCEPT}
          style={{ display: 'none' }}
          onChange={(e) => {
            pickFile(e.target.files?.[0] ?? null);
            e.target.value = '';
          }}
        />
      </div>
      <div className="field">
        <label>
          Title <span className="req">*</span>
        </label>
        <input
          className="input"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          disabled={busy}
        />
      </div>
      <div className="flex gap-2 flex-wrap">
        <div className="field" style={{ flex: '1 1 140px' }}>
          <label>
            Cabinet <span className="req">*</span>
          </label>
          <select
            className="input"
            value={cabinetId}
            onChange={(e) => {
              setCabinetId(e.target.value);
              setFolderId('');
            }}
            disabled={busy}
          >
            <option value="">Choose…</option>
            {cabinets.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </div>
        <div className="field" style={{ flex: '1 1 140px' }}>
          <label>
            Folder <span className="req">*</span>
          </label>
          <select
            className="input"
            value={folderId}
            onChange={(e) => setFolderId(e.target.value)}
            disabled={busy || !cabinetId}
          >
            <option value="">{cabinetId ? 'Choose…' : 'Pick a cabinet first'}</option>
            {folders.map((f) => (
              <option key={f.id} value={f.id}>
                {f.name}
              </option>
            ))}
          </select>
        </div>
      </div>
      <div className="flex gap-2 flex-wrap">
        <div className="field" style={{ flex: '1 1 110px' }}>
          <label>Type</label>
          <select
            className="input"
            value={documentType}
            onChange={(e) => setDocumentType(e.target.value)}
            disabled={busy}
          >
            {DOCUMENT_TYPES.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>
        </div>
        <div className="field" style={{ flex: '1 1 110px' }}>
          <label>Confidentiality</label>
          <select
            className="input"
            value={confidentiality}
            onChange={(e) => setConfidentiality(e.target.value)}
            disabled={busy}
          >
            {CONF_LEVELS.map((l) => (
              <option key={l} value={l}>
                {l[0].toUpperCase() + l.slice(1)}
              </option>
            ))}
          </select>
        </div>
        <div className="field" style={{ flex: '1 1 110px' }}>
          <label>Urgency</label>
          <select
            className="input"
            value={urgency}
            onChange={(e) => setUrgency(e.target.value)}
            disabled={busy}
          >
            {URG_LEVELS.map((l) => (
              <option key={l} value={l}>
                {l[0].toUpperCase() + l.slice(1)}
              </option>
            ))}
          </select>
        </div>
      </div>
      <div className="flex items-center gap-2 flex-wrap">
        <button
          type="button"
          className="btn btn-secondary"
          onClick={upload}
          disabled={!ready || busy}
        >
          {busy ? 'Uploading…' : 'Upload & add to list'}
        </button>
        <span className="caption">
          The file is filed in the cabinet straight away; it joins the workflow when you finish.
        </span>
      </div>
    </div>
  );
}
