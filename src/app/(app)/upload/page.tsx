'use client';

import React, { useState, useRef, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useStore, cabById } from '@/store/useStore';
import { useUIStore } from '@/store/useUIStore';
import { Icon } from '@/components/ui/Icons';

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
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [files, setFiles] = useState<
    {
      id: string;
      name: string;
      status: 'uploading' | 'processing' | 'ready' | 'filed' | 'discarded';
      progress: number;
      guess?: any;
      docId?: string;
    }[]
  >([]);

  useEffect(() => {
    setPageTitle('Upload & Capture');
  }, [setPageTitle]);

  const ingest = (names: string[]) => {
    const newFiles = names.map((name, i) => {
      const id = 'f-' + Date.now() + '-' + i;
      return { id, name, status: 'uploading' as const, progress: 0 };
    });
    setFiles((prev) => [...newFiles, ...prev]);

    newFiles.forEach((fileObj, idx) => {
      let p = 0;
      const t = setInterval(() => {
        p += 18 + Math.random() * 22;
        if (p >= 100) {
          clearInterval(t);
          setFiles((current) =>
            current.map((f) => {
              if (f.id === fileObj.id) {
                return { ...f, progress: 100, status: 'processing' };
              }
              return f;
            }),
          );
          setTimeout(() => {
            setFiles((current) =>
              current.map((f) => {
                if (f.id === fileObj.id) {
                  const guessIdx = (fileObj.name.length + idx) % IDU_GUESSES.length;
                  return { ...f, status: 'ready', guess: IDU_GUESSES[guessIdx] };
                }
                return f;
              }),
            );
          }, 700);
        } else {
          setFiles((current) =>
            current.map((f) => {
              if (f.id === fileObj.id) {
                return { ...f, progress: p };
              }
              return f;
            }),
          );
        }
      }, 220);
    });
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const names = Array.from(e.dataTransfer.files).map((f) => f.name);
    ingest(names.length ? names : ['dropped-document.pdf']);
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
          if (e.target.files) ingest(Array.from(e.target.files).map((f) => f.name));
          e.target.value = '';
        }}
      />

      <div className="flex g8 mt16">
        <button
          className="btn btn-secondary btn-sm"
          onClick={() => ingest(['Scanned_Agreement_0034.tiff'])}
        >
          Simulate scanner intake
        </button>
        <button
          className="btn btn-secondary btn-sm"
          onClick={() => ingest(['FWD_Invoice_MeridianLtd.pdf'])}
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
              </div>
            );
          }
          return null; // discarded
        })}
      </div>
    </div>
  );
}

function IDUCard({ file, setFiles }: { file: any, setFiles: any }) {
  const { docTypes, cabinets, session, users, auditAction } = useStore();
  const { addToast } = useUIStore();
  const guess = file.guess;
  const me = session ? users.find((u) => u.id === session) : null;

  const [title, setTitle] = useState(file.name.replace(/\.[a-z0-9]+$/i, '').replace(/[-_]/g, ' '));
  const [type, setType] = useState(guess.type);
  const [cabFolder, setCabFolder] = useState(`${guess.cab}|${guess.folder}`);
  const [conf, setConf] = useState('Internal');
  const [urg, setUrg] = useState('Normal');
  const [due, setDue] = useState(new Date(Date.now() + 3 * 86400000).toISOString().slice(0, 10));
  const [showErr, setShowErr] = useState(false);

  const confCls = guess.conf >= 85 ? 'conf-hi' : guess.conf >= 70 ? 'conf-med' : 'conf-lo';
  const CONF_LEVELS = ['Public', 'Internal', 'Confidential', 'Restricted', 'Top Secret'];
  const URG_LEVELS = ['Critical', 'High', 'Normal', 'Low'];

  const fileDoc = () => {
    if (!title.trim()) {
      setShowErr(true);
      return;
    }
    const [cab, folder] = cabFolder.split('|');
    const id = 'doc-' + Date.now() + Math.floor(Math.random() * 1000);

    const doc = {
      id,
      title: title.trim(),
      type,
      cabinet: cab,
      folder,
      owner: me?.id || 'u-sys',
      assignee: me?.id || 'u-sys',
      status: 'Pending',
      confidentiality: conf,
      urgency: urg,
      created: Date.now(),
      due: due ? new Date(due + 'T17:00:00').getTime() : null,
      pages: 1 + Math.floor(Math.random() * 9),
      version: 1,
      dept: me?.dept,
      workflow: [
        {
          name: 'Capture & Classify',
          assignee: me?.id,
          state: 'done',
          actedAt: Date.now(),
          sla: 24,
        },
        { name: 'Officer Review', assignee: me?.id, state: 'current', sla: 48 },
        { name: 'Supervisor Approval', assignee: 'u-david', state: 'next', sla: 72 },
        { name: 'Close & File', assignee: me?.id, state: 'next', sla: 24 },
      ],
      metadata: guess.fields,
      comments: [],
      redactions: [],
      signatures: [],
      sealed: false,
      locked: null,
    };

    useStore.setState((state) => ({ documents: [doc as any, ...state.documents] }));
    auditAction(
      'UPLOAD',
      id,
      `Filed “${doc.title}” to ${cabinets.find((c) => c.id === cab)?.name} (IDU ${guess.conf}%)`,
    );
    addToast('Document filed and audit entry recorded', 'success');

    setFiles((current: any[]) =>
      current.map((f) => {
        if (f.id === file.id) return { ...f, status: 'filed', docId: id, name: title.trim() };
        return f;
      }),
    );
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

      <div className="grid cols-2" style={{ gap: '12px' }}>
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
          <label>Cabinet › Folder</label>
          <select
            className="input"
            value={cabFolder}
            onChange={(e) => setCabFolder(e.target.value)}
          >
            {cabinets.flatMap((c: any) =>
              c.folders.map((f: any) => (
                <option key={`${c.id}|${f.id}`} value={`${c.id}|${f.id}`}>
                  {c.name} › {f.name}
                </option>
              )),
            )}
          </select>
        </div>
        <div className="field">
          <label>Due date</label>
          <input
            className="input"
            type="date"
            value={due}
            onChange={(e) => setDue(e.target.value)}
          />
        </div>
        <div className="field">
          <label>
            Confidentiality <span className="req">*</span>
          </label>
          <select className="input" value={conf} onChange={(e) => setConf(e.target.value)}>
            {CONF_LEVELS.map((l) => (
              <option key={l} value={l}>
                {l}
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
              <option key={l} value={l}>
                {l}
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
        <button className="btn btn-primary btn-sm" onClick={fileDoc}>
          Accept & file
        </button>
      </div>
    </div>
  );
}
