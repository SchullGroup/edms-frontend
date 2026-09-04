'use client';

import React, { useState, useRef, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useStore, cabById } from '@/store/useStore';
import { useUIStore } from '@/store/useUIStore';
import { Icon } from '@/components/ui/Icons';
import { useRouteToWorkflow } from '@/hooks/useRouteToWorkflow';

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

export default function UploadCapturePage() {
  const router = useRouter();
  const { setPageTitle, addToast } = useUIStore();
  const { routeDocuments } = useRouteToWorkflow();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [files, setFiles] = useState<
    {
      id: string;
      name: string;
      status: 'uploading' | 'processing' | 'ready' | 'filed' | 'discarded';
      progress: number;
      guess?: any;
      docId?: string;
      abortUpload?: () => void;
    }[]
  >([]);

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
        file, // store actual File object
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
          or click to browse · PDF, DOCX, XLSX, TIFF, JPG up to 100 MB · email-in and scanner
          channels are also connected
        </div>
      </div>
      <input
        type="file"
        multiple
        style={{ display: 'none' }}
        ref={fileInputRef}
        onChange={(e) => {
          if (e.target.files) ingest(Array.from(e.target.files));
          e.target.value = '';
        }}
      />

      <div className="flex g8 mt16">
        <button
          className="btn btn-secondary btn-sm"
          onClick={() => {
            const f = new File([''], 'Scanned_Agreement_0034.pdf', { type: 'application/pdf' });
            ingest([f]);
          }}
        >
          Simulate scanner intake
        </button>
        <button
          className="btn btn-secondary btn-sm"
          onClick={() => {
            const f = new File([''], 'FWD_Invoice_MeridianLtd.pdf', { type: 'application/pdf' });
            ingest([f]);
          }}
        >
          Simulate email-in
        </button>
      </div>

      <div className="mt16">
        {files.map((file) => {
          if (file.status === 'uploading' || file.status === 'processing') {
            return (
              <div key={file.id} className="up-file">
                <span style={{ color: 'var(--brand-primary-light)' }}>
                  <Icon name="doc" size={20} />
                </span>
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 600, fontSize: '12.5px' }}>{file.name}</div>
                  <div className="up-prog" style={{ marginTop: '6px' }}>
                    <i style={{ width: `${file.progress}%` }}></i>
                  </div>
                  <div className="caption prog-label" style={{ marginTop: '4px' }}>
                    {file.status === 'processing'
                      ? 'Running OCR & IDU classification…'
                      : 'Uploading…'}
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
            );
          }
          if (file.status === 'ready' && file.guess) {
            return <IDUCard key={file.id} file={file} setFiles={setFiles} />;
          }
          if (file.status === 'filed') {
            return (
              <div key={file.id} className="banner success mt16">
                <span>
                  <Icon name="check" size={15} />
                </span>{' '}
                Filed successfully — “{file.name}” is now filed.{' '}
                <a
                  onClick={() => router.push(`/doc/${file.docId}`)}
                  style={{ fontWeight: 700, cursor: 'pointer' }}
                >
                  Open document
                </a>
                {' · '}
                <a
                  onClick={() => file.docId && routeDocuments([{ id: file.docId, title: file.name }])}
                  style={{ fontWeight: 700, cursor: 'pointer' }}
                >
                  Route to workflow
                </a>
              </div>
            );
          }
          return null; // discarded
        })}
      </div>
    </div>
  );
}

import { useCabinets } from '@/apis/hooks/useCabinets';
import { useCabinetFolders } from '@/apis/hooks/useFolders';
import { documentsService } from '@/apis/services/documents.service';
import { calculateChecksum } from '@/apis/services/s3.service';
import { useMultipartUploader } from '@/apis/hooks/useMultipartUploader';

function IDUCard({ file, setFiles }: { file: any; setFiles: any }) {
  const { docTypes, session, users } = useStore();
  const { data: cabinetsData } = useCabinets();
  const cabinets = cabinetsData?.data || [];
  const { addToast } = useUIStore();
  const guess = file.guess;
  const me = session ? users.find((u) => u.id === session) : null;
  const { startUpload, uploadProgress, abort } = useMultipartUploader();

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

  // Mirror the multipart uploader's chunk-by-chunk progress into the shared
  // files list, same as the old per-call onProgress callback used to.
  useEffect(() => {
    if (uploadProgress <= 0) return;
    setFiles((current: any[]) =>
      current.map((f) => (f.id === file.id ? { ...f, progress: uploadProgress } : f)),
    );
  }, [uploadProgress, file.id, setFiles]);

  const [conf, setConf] = useState('internal');
  const [urg, setUrg] = useState('normal');
  const [showErr, setShowErr] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const confCls = guess.conf >= 85 ? 'conf-hi' : guess.conf >= 70 ? 'conf-med' : 'conf-lo';
  const CONF_LEVELS = [
    { label: 'Public', value: 'public' },
    { label: 'Internal', value: 'internal' },
    { label: 'Confidential', value: 'confidential' },
    { label: 'Restricted', value: 'restricted' },
  ];
  const URG_LEVELS = [
    { label: 'Critical', value: 'critical' },
    { label: 'High', value: 'high' },
    { label: 'Normal', value: 'normal' },
    { label: 'Low', value: 'low' },
  ];

  const fileDoc = async () => {
    // A document must land in a folder — filing straight into a cabinet leaves
    // it floating at the cabinet root.
    if (!title.trim() || !selCab || !selFol) {
      setShowErr(true);
      return;
    }

    setIsSubmitting(true);
    setFiles((current: any[]) =>
      current.map((f) => {
        if (f.id === file.id) return { ...f, status: 'uploading', progress: 0, abortUpload: abort };
        return f;
      }),
    );

    try {
      // 1. Compute checksum
      const checksum = await calculateChecksum(file.file);

      // 2. Upload to S3 via the chunked multipart flow
      const fileUrl = await startUpload({
        file: file.file,
        fileName: file.file.name,
        folderName: 'edmsDocuments',
      });

      setFiles((current: any[]) =>
        current.map((f) => {
          if (f.id === file.id) return { ...f, progress: 100, status: 'processing' };
          return f;
        }),
      );

      // 3. Create document in backend
      const createdDoc = await documentsService.create({
        title: title.trim(),
        documentType: type,
        cabinetId: selCab,
        folderId: selFol,
        confidentiality: conf,
        urgency: urg,
        fileUrl,
        mimeType: file.file.type || 'application/pdf',
        fileSize: file.file.size,
        checksum: checksum,
      });

      addToast('Document filed successfully', 'success');

      setFiles((current: any[]) =>
        current.map((f) => {
          if (f.id === file.id)
            return { ...f, status: 'filed', docId: createdDoc.id, name: title.trim(), abortUpload: undefined };
          return f;
        }),
      );
    } catch (err: any) {
      const wasAborted = err?.message === 'Upload aborted';
      addToast(wasAborted ? 'Upload canceled' : err.message || 'Failed to upload document', wasAborted ? 'info' : 'error');
      // Revert to ready state
      setFiles((current: any[]) =>
        current.map((f) => {
          if (f.id === file.id) return { ...f, status: 'ready', abortUpload: undefined };
          return f;
        }),
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="idu-card mt16">
      <div className="flex jcb aic mb8">
        <div className="flex aic g8">
          <span style={{ color: 'var(--brand-primary-light)' }}>
            <Icon name="doc" size={18} />
          </span>
          <b style={{ fontSize: '13px' }}>{file.name}</b>
        </div>
        <span className={`conf-pill ${confCls}`}>IDU confidence {guess.conf}%</span>
      </div>
      {guess.conf < 70 && (
        <div className="banner warning" style={{ marginBottom: '12px' }}>
          Low classification confidence — this item would also appear in the review queue. Please
          verify the fields below.
        </div>
      )}

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
            {docTypes.map((t) => (
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
            {folders.map((f: any) => (
              <option key={f.id} value={f.id}>
                {f.name}
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

      {Object.keys(guess.fields).length > 0 && (
        <div className="mb8">
          <div className="caption" style={{ fontWeight: 700, marginBottom: '6px' }}>
            EXTRACTED METADATA (IDU)
          </div>
          <div className="flex g8 wrap">
            {Object.entries(guess.fields).map(([k, v]) => (
              <span key={k} className="tag">
                {k}: {String(v)}
              </span>
            ))}
          </div>
        </div>
      )}

      <div className="flex g8" style={{ justifyContent: 'flex-end', marginTop: '10px' }}>
        <button
          className="btn btn-secondary btn-sm"
          onClick={() => {
            setFiles((current: any[]) =>
              current.map((f) => {
                if (f.id === file.id) return { ...f, status: 'discarded' };
                return f;
              }),
            );
            addToast('Upload discarded', 'info');
          }}
        >
          Discard
        </button>
        <button className="btn btn-primary btn-sm" onClick={fileDoc} disabled={isSubmitting}>
          {isSubmitting ? 'Uploading...' : 'Accept & file'}
        </button>
      </div>
    </div>
  );
}
