'use client';

import React, { useState, useRef, useEffect, useCallback } from 'react';
import { UPLOAD_ACCEPT, UPLOAD_TYPES_LABEL, resolveUploadMimeType } from '@/constants/uploadTypes';
import { useRouter } from 'next/navigation';
import { useUIStore } from '@/store/useUIStore';
import { Icon } from '@/components/ui/Icons';
import { useRouteToWorkflow } from '@/hooks/useRouteToWorkflow';
import { DOCUMENT_TYPES } from '@/constants/documentTypes';
import type { UploadDocumentRequest } from '@/types/models';

const IDU_GUESSES = [
  {
    type: 'Invoice',
    cab: 'cab-fin',
    folder: 'f-fin-inv',
    conf: 94,
    fields: {
      Vendor: 'Meridian Interiors Ltd',
      Amount: '₦12,750,000',
      'Invoice No.': 'INV-2026-0912',
    },
  },
  {
    type: 'Contract',
    cab: 'cab-legal',
    folder: 'f-legal-contracts',
    conf: 88,
    fields: { Counterparty: 'BlueRiver Consulting', Term: '12 months' },
  },
  {
    type: 'Memo',
    cab: 'cab-ops',
    folder: 'f-ops-memos',
    conf: 76,
    fields: { Subject: 'Facilities notice' },
  },
  {
    type: 'Purchase Order',
    cab: 'cab-proc',
    folder: 'f-proc-po',
    conf: 91,
    fields: { 'PO Number': 'PO-2026-0401', Vendor: 'TechHub Distribution' },
  },
  { type: 'Report', cab: 'cab-fin', folder: 'f-fin-audit', conf: 58, fields: {} },
];

type FileStatus = 'uploading' | 'processing' | 'ready' | 'filed' | 'discarded';

interface UploadItem {
  id: string;
  name: string;
  file: File;
  status: FileStatus;
  progress: number;
  guess?: any;
  docId?: string;
  abortUpload?: () => void;
  /** Why the last upload or filing attempt failed; cleared on the next try. */
  error?: string;
  /** Set when the document filed but its metadata save failed. */
  metadataError?: string;
}

/** Fields "Apply to all" can set on every waiting file. Blank = leave as is. */
interface BatchDefaults {
  cabinetId?: string;
  folderId?: string;
  confidentiality?: string;
  urgency?: string;
}

/** What a card hands the page so "File all" can file it alongside the others. */
interface CardHandle {
  /** Flags the card's missing fields; true when it's ready to file. */
  validate: () => boolean;
  /** Uploads the file — once; a retry reuses it — and returns the create body. */
  prepare: () => Promise<UploadDocumentRequest>;
  /** Once the document exists: saves its metadata and marks the card filed.
   *  Resolves to why the metadata didn't save, if it didn't. */
  finish: (doc: { id: string }) => Promise<string | undefined>;
  /** The upload or the filing failed: back to editable, showing why. */
  fail: (message: string) => void;
  apply: (defaults: BatchDefaults) => void;
}

/** `POST /documents/batch` takes at most 20 documents per call. */
const BATCH_LIMIT = 20;
/** Files uploaded to storage at the same time during "File all". */
const UPLOAD_CONCURRENCY = 3;

/** Runs `worker` over `items`, at most `size` at a time. */
async function runPool<T>(items: T[], size: number, worker: (item: T) => Promise<void>) {
  let next = 0;
  await Promise.all(
    Array.from({ length: Math.min(size, items.length) }, async () => {
      while (next < items.length) await worker(items[next++]);
    }),
  );
}

export default function UploadCapturePage() {
  const router = useRouter();
  const { setPageTitle, addToast } = useUIStore();
  const { routeDocuments, canRoute } = useRouteToWorkflow();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [files, setFiles] = useState<UploadItem[]>([]);
  const [batchBusy, setBatchBusy] = useState(false);
  // What the last "File all" filed — offered as one workflow to route together.
  const [lastBatch, setLastBatch] = useState<{ id: string; title: string }[]>([]);

  // Each waiting card registers how to file it, so "File all" can drive them.
  const cardsRef = useRef(new Map<string, CardHandle>());
  const register = useCallback((id: string, handle: CardHandle | null) => {
    if (handle) cardsRef.current.set(id, handle);
    else cardsRef.current.delete(id);
  }, []);

  useEffect(() => {
    setPageTitle('Upload & Capture');
  }, [setPageTitle]);

  const ingest = (selectedFiles: File[]) => {
    const newFiles = selectedFiles.map((file, i) => {
      const id = 'f-' + Date.now() + '-' + i;
      const guessIdx = (file.name.length + i) % IDU_GUESSES.length;
      return {
        id,
        name: file.name,
        file,
        status: 'ready' as const,
        progress: 0,
        guess: IDU_GUESSES[guessIdx],
      };
    });
    setFiles((prev) => [...newFiles, ...prev]);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const filesArray = Array.from(e.dataTransfer.files);
    if (filesArray.length) {
      ingest(filesArray);
    }
  };

  const waiting = files.filter((f) => f.status === 'ready');

  const applyToAll = (defaults: BatchDefaults) => {
    waiting.forEach((f) => cardsRef.current.get(f.id)?.apply(defaults));
    addToast(`Applied to ${waiting.length} file${waiting.length === 1 ? '' : 's'}`, 'success');
  };

  /**
   * Files every waiting card together: checks them all first (nothing uploads
   * while any card has a missing field), uploads to storage a few at a time,
   * then creates the documents in batches of up to 20. A batch is one
   * transaction, so if it fails none of its documents exist and those cards
   * go back to editable; their uploads are kept, so a retry doesn't re-upload.
   * Metadata is saved per document afterwards — the batch call doesn't take it.
   */
  const fileAll = async () => {
    const handles = waiting
      .map((f) => cardsRef.current.get(f.id))
      .filter((h): h is CardHandle => !!h);
    // `filter`, not `some`: every card gets to flag its own missing fields.
    const needAttention = handles.filter((h) => !h.validate()).length;
    if (needAttention > 0) {
      addToast(
        `${needAttention} file${needAttention === 1 ? ' needs' : 's need'} attention before filing — see the highlighted fields.`,
        'error',
      );
      return;
    }

    setBatchBusy(true);
    setLastBatch([]);
    const filedDocs: { id: string; title: string }[] = [];
    let filed = 0;
    let notFiled = 0;
    let metadataFailed = 0;
    try {
      const prepared: { handle: CardHandle; body: UploadDocumentRequest }[] = [];
      await runPool(handles, UPLOAD_CONCURRENCY, async (handle) => {
        try {
          prepared.push({ handle, body: await handle.prepare() });
        } catch (err: any) {
          notFiled++;
          handle.fail(
            err?.message === 'Upload aborted' ? 'Upload canceled' : err?.message || 'Upload failed',
          );
        }
      });

      for (let i = 0; i < prepared.length; i += BATCH_LIMIT) {
        const chunk = prepared.slice(i, i + BATCH_LIMIT);
        try {
          const docs = await documentsService.createBatch(chunk.map((c) => c.body));
          const metadataErrors = await Promise.all(docs.map((d, j) => chunk[j].handle.finish(d)));
          filed += docs.length;
          docs.forEach((d, j) => filedDocs.push({ id: d.id, title: chunk[j].body.title }));
          metadataFailed += metadataErrors.filter(Boolean).length;
        } catch (err: any) {
          notFiled += chunk.length;
          const message = err?.response?.data?.message || err?.message || 'Filing failed';
          chunk.forEach((c) => c.handle.fail(message));
        }
      }
    } finally {
      setBatchBusy(false);
      // Routing one document is already a link on its own banner.
      if (filedDocs.length > 1) setLastBatch(filedDocs);
    }

    const parts = [`${filed} filed`];
    if (notFiled) parts.push(`${notFiled} not filed`);
    if (metadataFailed) parts.push(`${metadataFailed} without their metadata`);
    addToast(
      notFiled || metadataFailed
        ? `${parts.join(', ')} — see the highlighted files.`
        : `${filed} document${filed === 1 ? '' : 's'} filed`,
      notFiled ? 'error' : metadataFailed ? 'warning' : 'success',
    );
  };

  return (
    <div>
      <div className="page-head">
        <div>
          <div className="page-title">Upload & Capture</div>
          <div className="page-sub">
            Ingest → OCR → IDU classification → review suggestions → file.
          </div>
        </div>
      </div>

      <div
        className="dropzone"
        tabIndex={0}
        role="button"
        aria-label="Upload documents"
        onClick={() => fileInputRef.current?.click()}
        onKeyDown={(e) => {
          if (e.key === 'Enter') fileInputRef.current?.click();
        }}
        onDragOver={(e) => {
          e.preventDefault();
          e.currentTarget.classList.add('over');
        }}
        onDragLeave={(e) => e.currentTarget.classList.remove('over')}
        onDrop={handleDrop}
      >
        <div className="dz-ico">
          <Icon name="upload" size={26} />
        </div>
        <div style={{ fontWeight: 700, fontSize: '14px' }}>Drag & drop documents here</div>
        <div className="muted" style={{ marginTop: '5px', fontSize: '12.5px' }}>
          or click to browse · {UPLOAD_TYPES_LABEL}
        </div>
      </div>
      <input
        type="file"
        multiple
        accept={UPLOAD_ACCEPT}
        style={{ display: 'none' }}
        ref={fileInputRef}
        onChange={(e) => {
          if (e.target.files) ingest(Array.from(e.target.files));
          e.target.value = '';
        }}
      />

      {lastBatch.length > 1 && canRoute && (
        <div className="banner success mt-4">
          <span>
            <Icon name="check" size={15} />
          </span>{' '}
          {lastBatch.length} documents filed together.{' '}
          <a
            onClick={() => routeDocuments(lastBatch, { onSuccess: () => setLastBatch([]) })}
            style={{ fontWeight: 700, cursor: 'pointer' }}
          >
            Route them to one workflow
          </a>
          {' · '}
          <a onClick={() => setLastBatch([])} style={{ cursor: 'pointer' }}>
            Dismiss
          </a>
        </div>
      )}

      {(waiting.length > 1 || batchBusy) && (
        <BatchBar
          waitingCount={waiting.length}
          busy={batchBusy}
          onApply={applyToAll}
          onFileAll={fileAll}
        />
      )}

      <div className="mt-4">
        {files.map((file) => {
          if (
            file.status === 'ready' ||
            file.status === 'uploading' ||
            file.status === 'processing'
          ) {
            return (
              <IDUCard
                key={file.id}
                file={file}
                setFiles={setFiles}
                register={register}
                batchBusy={batchBusy}
              />
            );
          }
          if (file.status === 'filed') {
            return (
              <div
                key={file.id}
                className={`banner ${file.metadataError ? 'warning' : 'success'} mt-4`}
              >
                <span>
                  <Icon name={file.metadataError ? 'alert' : 'check'} size={15} />
                </span>{' '}
                {file.metadataError ? (
                  <>
                    “{file.name}” is filed, but its metadata wasn’t saved: {file.metadataError}.
                    Open the document to add it.{' '}
                  </>
                ) : (
                  <>Filed successfully — “{file.name}” is now filed. </>
                )}
                <a
                  onClick={() => router.push(`/doc/${file.docId}`)}
                  style={{ fontWeight: 700, cursor: 'pointer' }}
                >
                  Open document
                </a>
                {canRoute && (
                  <>
                    {' · '}
                    <a
                      onClick={() =>
                        file.docId && routeDocuments([{ id: file.docId, title: file.name }])
                      }
                      style={{ fontWeight: 700, cursor: 'pointer' }}
                    >
                      Route to workflow
                    </a>
                  </>
                )}
              </div>
            );
          }
          return null; // discarded
        })}
      </div>
    </div>
  );
}

import { useCabinets, useCabinet } from '@/apis/hooks/useCabinets';
import { useCabinetFolders } from '@/apis/hooks/useFolders';
import { usePermissions } from '@/hooks/usePermissions';
import { cabinetAllows, useMyCabinetAccess } from '@/components/cabinets/cabinetAccess';
import {
  MetadataFieldInput,
  isMetadataValueMissing,
} from '@/components/documents/MetadataFieldInput';
import { documentsService } from '@/apis/services/documents.service';
import { CONF_LEVELS, URG_LEVELS } from '@/constants/documentLevels';
import { foldersAsPaths } from '@/utils/folders';
import { calculateChecksum } from '@/apis/services/s3.service';
import { useMultipartUploader } from '@/apis/hooks/useMultipartUploader';

/**
 * Shown once two or more files are waiting: set the shared fields on every
 * card at once, then file them all. "Apply to all" only overwrites the fields
 * chosen here, and each card stays editable afterwards.
 */
function BatchBar({
  waitingCount,
  busy,
  onApply,
  onFileAll,
}: {
  waitingCount: number;
  busy: boolean;
  onApply: (defaults: BatchDefaults) => void;
  onFileAll: () => void;
}) {
  const { data: cabinetsData } = useCabinets();
  const cabinets = cabinetsData?.data || [];
  const [cabinetId, setCabinetId] = useState('');
  const { data: folData, isLoading: foldersLoading } = useCabinetFolders(cabinetId || undefined);
  const folders = folData?.data || [];
  const [folderId, setFolderId] = useState('');
  const [confidentiality, setConfidentiality] = useState('');
  const [urgency, setUrgency] = useState('');
  const nothingChosen = !cabinetId && !confidentiality && !urgency;

  return (
    <div className="idu-card mt-4">
      <div className="flex justify-between items-center flex-wrap gap-2 mb-2">
        <b style={{ fontSize: '13px' }}>
          {busy
            ? 'Filing…'
            : `${waitingCount} file${waitingCount === 1 ? '' : 's'} waiting to be filed`}
        </b>
        <span className="caption">Set fields for all of them at once, then file together.</span>
      </div>
      <fieldset disabled={busy} style={{ border: 0, padding: 0, margin: 0, minWidth: 0 }}>
        <div className="grid grid-cols-1 sm:grid-cols-4 gap-4 items-end mb-4 [&_.field]:mb-0!">
          <div className="field">
            <label>Cabinet</label>
            <select
              className="input"
              value={cabinetId}
              onChange={(e) => {
                setCabinetId(e.target.value);
                setFolderId('');
              }}
            >
              <option value="">Keep each file&rsquo;s</option>
              {cabinets.map((c: any) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>
          <div className="field">
            <label>Folder</label>
            <select
              className="input"
              value={folderId}
              disabled={!cabinetId || foldersLoading}
              onChange={(e) => setFolderId(e.target.value)}
            >
              <option value="">
                {!cabinetId
                  ? 'Choose a cabinet first'
                  : foldersLoading
                    ? 'Loading folders…'
                    : 'Choose per file'}
              </option>
              {foldersAsPaths(folders).map((f: any) => (
                <option key={f.id} value={f.id}>
                  {f.path}
                </option>
              ))}
            </select>
          </div>
          <div className="field">
            <label>Confidentiality</label>
            <select
              className="input"
              value={confidentiality}
              onChange={(e) => setConfidentiality(e.target.value)}
            >
              <option value="">Keep each file&rsquo;s</option>
              {CONF_LEVELS.map((l) => (
                <option key={l.value} value={l.value}>
                  {l.label}
                </option>
              ))}
            </select>
          </div>
          <div className="field">
            <label>Urgency</label>
            <select className="input" value={urgency} onChange={(e) => setUrgency(e.target.value)}>
              <option value="">Keep each file&rsquo;s</option>
              {URG_LEVELS.map((l) => (
                <option key={l.value} value={l.value}>
                  {l.label}
                </option>
              ))}
            </select>
          </div>
        </div>
        <div className="flex gap-2" style={{ justifyContent: 'flex-end' }}>
          <button
            className="btn btn-secondary btn-sm"
            disabled={nothingChosen || waitingCount === 0}
            onClick={() =>
              onApply({
                cabinetId: cabinetId || undefined,
                folderId: folderId || undefined,
                confidentiality: confidentiality || undefined,
                urgency: urgency || undefined,
              })
            }
          >
            Apply to all
          </button>
          <button
            className="btn btn-primary btn-sm"
            disabled={waitingCount === 0}
            onClick={onFileAll}
          >
            {busy ? 'Filing…' : `File all (${waitingCount})`}
          </button>
        </div>
      </fieldset>
    </div>
  );
}

function IDUCard({
  file,
  setFiles,
  register,
  batchBusy,
}: {
  file: UploadItem;
  setFiles: React.Dispatch<React.SetStateAction<UploadItem[]>>;
  register: (id: string, handle: CardHandle | null) => void;
  batchBusy: boolean;
}) {
  const { data: cabinetsData } = useCabinets();
  const cabinets = cabinetsData?.data || [];
  const { addToast } = useUIStore();
  const guess = file.guess;
  const { startUpload, uploadProgress, abort } = useMultipartUploader();
  const busy = file.status === 'uploading' || file.status === 'processing';

  const [title, setTitle] = useState(file.name.replace(/\.[a-z0-9]+$/i, '').replace(/[-_]/g, ' '));
  const [type, setType] = useState(guess.type);
  const [selCab, setSelCab] = useState(guess.cab || '');
  const { data: folData, isLoading: foldersLoading } = useCabinetFolders(selCab);
  const folders = folData?.data || [];
  const [selFol, setSelFol] = useState(guess.folder || '');

  // Update selCab to valid initial value if cabinets data loads
  useEffect(() => {
    if (cabinets.length > 0 && !selCab) {
      setSelCab(cabinets[0].id);
    } else if (cabinets.length > 0 && !cabinets.find((c: any) => c.id === selCab)) {
      setSelCab(cabinets[0].id);
    }
  }, [cabinets, selCab]);

  // The IDU guess carries a sample folder id, so drop it (and any stale pick
  // from a previous cabinet) once the real folder list for the cabinet arrives.
  useEffect(() => {
    if (!selFol || !folders.length) return;
    if (!folders.find((f: any) => f.id === selFol)) setSelFol('');
  }, [folders, selFol]);

  const patchFile = useCallback(
    (patch: Partial<UploadItem>) =>
      setFiles((current) => current.map((f) => (f.id === file.id ? { ...f, ...patch } : f))),
    [file.id, setFiles],
  );

  // Mirror the multipart uploader's chunk-by-chunk progress into the shared
  // files list. The card stays mounted while it uploads, so this keeps running.
  useEffect(() => {
    if (uploadProgress <= 0 || file.status !== 'uploading') return;
    patchFile({ progress: uploadProgress });
  }, [uploadProgress, file.status, patchFile]);

  // The chosen cabinet's metadata schema (only the single-cabinet GET carries it).
  // `POST /documents` takes no metadata, so the values are saved by a second call,
  // `PUT /documents/:id/metadata`, which needs `document_metadata:edit` AND `edit`
  // on the cabinet — more than uploading does. Without both, the fields are listed
  // but not offered, since the save would be refused after the file was already in.
  const { can } = usePermissions();
  // `selCab` briefly holds the IDU guess's sample id until real cabinets load.
  const realCabId = cabinets.some((c: any) => c.id === selCab) ? selCab : undefined;
  const { data: cabinetDetail, isLoading: schemaLoading } = useCabinet(realCabId);
  const metadataFields = (cabinetDetail?.metadataFields ?? [])
    .slice()
    .sort((a, b) => a.displayOrder - b.displayOrder);
  const myLevel = useMyCabinetAccess(realCabId);
  const canFillMetadata = can('document_metadata', 'edit') && cabinetAllows(myLevel, 'edit');
  const [metaValues, setMetaValues] = useState<Record<string, string>>({});
  useEffect(() => {
    setMetaValues({});
  }, [selCab]);
  // An untouched checkbox reads "No", so a boolean starts as "false".
  const metaValue = (f: { id: string; fieldType: string }) =>
    metaValues[f.id] ?? (f.fieldType === 'boolean' ? 'false' : '');
  const missingMetadata = canFillMetadata
    ? metadataFields.filter((f) => isMetadataValueMissing(f, metaValue(f)))
    : [];

  const [conf, setConf] = useState('internal');
  const [urg, setUrg] = useState('normal');
  const [showErr, setShowErr] = useState(false);
  // The file's place in storage once uploaded, so a failed filing can be
  // retried without uploading it again.
  const uploaded = useRef<{ fileUrl: string; checksum: string } | null>(null);

  const confCls = guess.conf >= 85 ? 'conf-hi' : guess.conf >= 70 ? 'conf-med' : 'conf-lo';

  // A document must land in a folder — filing straight into a cabinet leaves
  // it floating at the cabinet root. Not ready while the cabinet's metadata
  // fields are still loading, or a required one could be skipped.
  const validate = () => {
    const ok =
      !!title.trim() &&
      !!selCab &&
      !!selFol &&
      missingMetadata.length === 0 &&
      !(realCabId && schemaLoading);
    if (!ok) setShowErr(true);
    return ok;
  };

  const prepare = async (): Promise<UploadDocumentRequest> => {
    patchFile({ status: 'uploading', progress: 0, abortUpload: abort, error: undefined });
    if (!uploaded.current) {
      const checksum = await calculateChecksum(file.file);
      const fileUrl = await startUpload({
        file: file.file,
        fileName: file.file.name,
        folderName: 'edmsDocuments',
      });
      uploaded.current = { fileUrl, checksum };
    }
    patchFile({ status: 'processing', progress: 100, abortUpload: undefined });
    return {
      title: title.trim(),
      documentType: type,
      cabinetId: selCab,
      folderId: selFol,
      confidentiality: conf as UploadDocumentRequest['confidentiality'],
      urgency: urg as UploadDocumentRequest['urgency'],
      fileUrl: uploaded.current.fileUrl,
      mimeType: resolveUploadMimeType(file.file) ?? file.file.type,
      fileSize: file.file.size,
      checksum: uploaded.current.checksum,
    };
  };

  // The document is already filed by now, so a metadata failure is reported,
  // not rolled back.
  const finish = async (doc: { id: string }) => {
    let metadataError: string | undefined;
    const metadata = canFillMetadata
      ? metadataFields
          .map((f) => ({ fieldId: f.id, value: metaValue(f) }))
          .filter((m) => m.value !== '')
      : [];
    if (metadata.length > 0) {
      try {
        await documentsService.updateMetadata(doc.id, metadata);
      } catch (err: any) {
        metadataError = err.response?.data?.message || err.message || 'unknown error';
      }
    }
    patchFile({
      status: 'filed',
      docId: doc.id,
      name: title.trim(),
      abortUpload: undefined,
      metadataError,
    });
    return metadataError;
  };

  const fail = (message: string) =>
    patchFile({ status: 'ready', abortUpload: undefined, error: message });

  const apply = (defaults: BatchDefaults) => {
    if (defaults.cabinetId) {
      setSelCab(defaults.cabinetId);
      setSelFol(defaults.folderId ?? '');
    }
    if (defaults.confidentiality) setConf(defaults.confidentiality);
    if (defaults.urgency) setUrg(defaults.urgency);
  };

  // Hand the page a stable handle whose methods always see this render's state.
  const latest = useRef<CardHandle>({ validate, prepare, finish, fail, apply });
  latest.current = { validate, prepare, finish, fail, apply };
  useEffect(() => {
    register(file.id, {
      validate: () => latest.current.validate(),
      prepare: () => latest.current.prepare(),
      finish: (doc) => latest.current.finish(doc),
      fail: (message) => latest.current.fail(message),
      apply: (defaults) => latest.current.apply(defaults),
    });
    return () => register(file.id, null);
  }, [file.id, register]);

  const fileDoc = async () => {
    if (!validate()) return;
    try {
      const body = await prepare();
      const createdDoc = await documentsService.create(body);
      const metadataError = await finish(createdDoc);
      addToast(
        metadataError
          ? 'Document filed, but its metadata wasn’t saved'
          : 'Document filed successfully',
        metadataError ? 'error' : 'success',
      );
    } catch (err: any) {
      const wasAborted = err?.message === 'Upload aborted';
      const message = wasAborted
        ? 'Upload canceled'
        : err?.response?.data?.message || err?.message || 'Failed to upload document';
      fail(message);
      addToast(message, wasAborted ? 'info' : 'error');
    }
  };

  return (
    <div className="idu-card mt-4">
      <div className="flex justify-between items-center mb-2">
        <div className="flex items-center gap-2">
          <span style={{ color: 'var(--brand-primary-light)' }}>
            <Icon name="doc" size={18} />
          </span>
          <b style={{ fontSize: '13px' }}>{file.name}</b>
        </div>
        <span className={`conf-pill ${confCls}`}>IDU confidence {guess.conf}%</span>
      </div>
      {file.error && !busy && (
        <div className="banner error" style={{ marginBottom: '12px' }}>
          Not filed: {file.error}. Check the details below and try again.
        </div>
      )}
      {guess.conf < 70 && (
        <div className="banner warning" style={{ marginBottom: '12px' }}>
          Low classification confidence — this item would also appear in the review queue. Please
          verify the fields below.
        </div>
      )}

      {/* Locked while this file uploads and files. */}
      <fieldset disabled={busy} style={{ border: 0, padding: 0, margin: 0, minWidth: 0 }}>
        {/* `.field` carries its own bottom margin, which would stack on top of the
            grid's row gap — zero it out so row and column spacing stay equal. */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 items-start mb-4 [&_.field]:mb-0!">
          <div className="field">
            <label>
              Title <span className="req">*</span>
            </label>
            <input
              className={`input ${showErr && !title.trim() ? 'invalid' : ''}`}
              value={title}
              onChange={(e) => setTitle(e.target.value)}
            />
            {showErr && !title.trim() && (
              <div className="err" style={{ display: 'block' }}>
                Title is mandatory before filing.
              </div>
            )}
          </div>
          <div className="field">
            <label>Document type</label>
            <select className="input" value={type} onChange={(e) => setType(e.target.value)}>
              {DOCUMENT_TYPES.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
          </div>
          <div className="field">
            <label>
              Destination Cabinet <span className="req">*</span>
            </label>
            <select
              className="input"
              value={selCab}
              onChange={(e) => {
                setSelCab(e.target.value);
                setSelFol('');
              }}
            >
              {cabinets.map((c: any) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>
          <div className="field">
            <label>
              Destination Folder <span className="req">*</span>
            </label>
            <select
              className={`input ${showErr && !selFol ? 'invalid' : ''}`}
              value={selFol}
              disabled={!selCab || foldersLoading}
              onChange={(e) => setSelFol(e.target.value)}
            >
              <option value="">
                {foldersLoading ? 'Loading folders…' : '-- Select a folder --'}
              </option>
              {foldersAsPaths(folders).map((f: any) => (
                <option key={f.id} value={f.id}>
                  {f.path}
                </option>
              ))}
            </select>
            {showErr && !selFol ? (
              <div className="err" style={{ display: 'block' }}>
                {folders.length || foldersLoading
                  ? 'Choose a folder before filing.'
                  : 'This cabinet has no folders yet — create one before filing here.'}
              </div>
            ) : (
              <div className="help">Documents must be filed into a folder, not a cabinet root.</div>
            )}
          </div>
          <div className="field">
            <label>
              Confidentiality <span className="req">*</span>
            </label>
            <select className="input" value={conf} onChange={(e) => setConf(e.target.value)}>
              {CONF_LEVELS.map((l) => (
                <option key={l.value} value={l.value}>
                  {l.label}
                </option>
              ))}
            </select>
            <div className="help">Drives watermarking, download and print behaviour.</div>
          </div>
          <div className="field">
            <label>
              Urgency <span className="req">*</span>
            </label>
            <select className="input" value={urg} onChange={(e) => setUrg(e.target.value)}>
              {URG_LEVELS.map((l) => (
                <option key={l.value} value={l.value}>
                  {l.label}
                </option>
              ))}
            </select>
          </div>
        </div>

        {metadataFields.length > 0 && (
          <div className="mb-4">
            <div className="caption" style={{ fontWeight: 700, marginBottom: '6px' }}>
              CABINET METADATA
            </div>
            {canFillMetadata ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 items-start [&_.field]:mb-0!">
                {metadataFields.map((f) => {
                  const invalid = showErr && isMetadataValueMissing(f, metaValue(f));
                  return (
                    <div key={f.id} className="field">
                      <label>
                        {f.name} {f.isRequired && <span className="req">*</span>}
                      </label>
                      <MetadataFieldInput
                        field={f}
                        value={metaValue(f)}
                        invalid={invalid}
                        onChange={(v) => setMetaValues((m) => ({ ...m, [f.id]: v }))}
                      />
                      {invalid && (
                        <div className="err" style={{ display: 'block' }}>
                          {f.name} is required before filing.
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="help">
                This cabinet has {metadataFields.length} metadata field
                {metadataFields.length === 1 ? '' : 's'} (
                {metadataFields.map((f) => f.name).join(', ')}). Filling them in needs permission to
                edit document metadata and Edit access on this cabinet — someone with both can add
                them on the document page once it’s filed.
              </div>
            )}
          </div>
        )}
      </fieldset>

      {Object.keys(guess.fields).length > 0 && (
        <div className="mb-2">
          <div className="caption" style={{ fontWeight: 700, marginBottom: '6px' }}>
            EXTRACTED METADATA (IDU)
          </div>
          <div className="flex gap-2 flex-wrap">
            {Object.entries(guess.fields).map(([k, v]) => (
              <span key={k} className="tag">
                {k}: {String(v)}
              </span>
            ))}
          </div>
        </div>
      )}

      {busy ? (
        <div className="flex items-center gap-3" style={{ marginTop: '10px' }}>
          <div style={{ flex: 1 }}>
            <div className="up-prog">
              <i style={{ width: `${file.progress}%` }}></i>
            </div>
            <div className="caption prog-label" style={{ marginTop: '4px' }}>
              {file.status === 'processing'
                ? 'Filing…'
                : `Uploading… ${Math.round(file.progress)}%`}
            </div>
          </div>
          {file.status === 'uploading' && (
            <button
              className="btn btn-secondary btn-sm"
              title="Cancel upload"
              aria-label="Cancel upload"
              onClick={() => file.abortUpload?.()}
            >
              <Icon name="x" size={14} />
            </button>
          )}
        </div>
      ) : (
        <div className="flex gap-2" style={{ justifyContent: 'flex-end', marginTop: '10px' }}>
          <button
            className="btn btn-secondary btn-sm"
            disabled={batchBusy}
            onClick={() => {
              patchFile({ status: 'discarded' });
              addToast('Upload discarded', 'info');
            }}
          >
            Discard
          </button>
          <button
            className="btn btn-primary btn-sm"
            onClick={fileDoc}
            disabled={batchBusy || (!!selCab && schemaLoading)}
          >
            Accept & file
          </button>
        </div>
      )}
    </div>
  );
}
