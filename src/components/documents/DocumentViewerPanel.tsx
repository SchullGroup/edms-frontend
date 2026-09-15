'use client';

import { useState } from 'react';
import { Icon } from '@/components/ui/Icons';
import type { DocumentSignatureFieldUI } from '@/components/documents/types';

export interface DocumentViewerPanelProps {
  documentTitle: string;
  confidentiality: string;
  /** Absolute, percent-encoded S3 URL, or undefined if none/not renderable. */
  fileUrl?: string;
  /** Raw fileKey before validation — used only to distinguish "no file" from
   *  "file location isn't a real URL" in the empty state. */
  rawFileKey?: string;
  fileMimeType: string;
  showWatermark: boolean;
  watermarkText: string;
  zoom: number;
  onZoomChange: (zoom: number) => void;
  signatures: DocumentSignatureFieldUI[];
  sealed: boolean;
  lockedByOther: boolean;
  onSignatureFieldClick: (index: number) => void;
  getSignerName: (userId: string) => string;
}

// Open-parameters honoured by Chromium's and Firefox's (pdf.js) built-in PDF
// viewers: `toolbar=0`/`navpanes=0`/`scrollbar=0` hide the native chrome — and
// with it, the browser's own print/download/draw-annotation controls, which
// otherwise sit on top of this app's confidentiality and watermark policy.
// `page=N` opens straight to a given page. This is best-effort: it depends on
// each browser's own PDF viewer honouring the fragment, isn't guaranteed on
// every platform, and a determined user can always fall back to a viewer that
// ignores it — it's not a substitute for the server-side download gating that
// already exists.
function pdfSrc(fileUrl: string, page: string) {
  const params = ['toolbar=0', 'navpanes=0', 'scrollbar=0'];
  if (page.trim()) params.push(`page=${encodeURIComponent(page.trim())}`);
  return `${fileUrl}#${params.join('&')}`;
}

/**
 * Renders the file straight from its own URL — no Google Docs Viewer or
 * similar third-party proxy, since a proxy caching a PDF means a re-uploaded
 * version can keep showing stale content to other viewers.
 *
 * Deliberately view-only: zoom and page navigation only, no print and no
 * markup/redaction tools (those don't exist server-side — see doc/[id]).
 */
export function DocumentViewerPanel({
  documentTitle,
  confidentiality,
  fileUrl,
  rawFileKey,
  fileMimeType,
  showWatermark,
  watermarkText,
  zoom,
  onZoomChange,
  signatures,
  sealed,
  lockedByOther,
  onSignatureFieldClick,
  getSignerName,
}: DocumentViewerPanelProps) {
  const isPdf = fileMimeType === 'application/pdf';
  const isImage = fileMimeType.startsWith('image/');

  const [pageInput, setPageInput] = useState('');
  const [pdfPage, setPdfPage] = useState('');

  const goToPage = () => setPdfPage(pageInput);

  return (
    <div className="viewer doc-viewer-col">
      <div className="viewer-bar">
        <span className="tabular-nums" style={{ flex: 1 }}>
          {fileMimeType || 'Unknown type'}
        </span>
        {isPdf && fileUrl && (
          <form
            className="flex items-center gap-1"
            onSubmit={(e) => {
              e.preventDefault();
              goToPage();
            }}
          >
            <span className="caption" style={{ color: 'inherit', opacity: 0.7 }}>
              Page
            </span>
            <input
              type="number"
              min={1}
              inputMode="numeric"
              value={pageInput}
              onChange={(e) => setPageInput(e.target.value)}
              placeholder="#"
              aria-label="Go to page"
              style={{
                width: 44,
                height: 24,
                padding: '0 6px',
                borderRadius: 6,
                border: '1px solid rgba(255,255,255,.18)',
                background: 'rgba(255,255,255,.06)',
                color: 'inherit',
                fontSize: 12,
              }}
            />
            <button type="submit" className="icon-btn" title="Go to page" aria-label="Go to page">
              <Icon name="chevR" size={14} />
            </button>
          </form>
        )}
        <button className="icon-btn" onClick={() => onZoomChange(Math.max(0.6, zoom - 0.15))}>
          −
        </button>
        <span className="tabular-nums">{Math.round(zoom * 100)}%</span>
        <button className="icon-btn" onClick={() => onZoomChange(Math.min(1.6, zoom + 0.15))}>
          +
        </button>
      </div>
      <div className="viewer-page-wrap">
        <div
          className="doc-page"
          style={{ transform: `scale(${zoom})`, transformOrigin: 'top center', position: 'relative' }}
        >
          {showWatermark && (
            <div className="watermark" style={{ pointerEvents: 'none' }}>
              <span>{watermarkText}</span>
            </div>
          )}

          {!fileUrl ? (
            <div className="empty" style={{ padding: '48px 16px' }}>
              <Icon name="doc" size={32} />
              <div className="h3 mt-4 mb-2">No file available</div>
              <p className="caption">
                {rawFileKey
                  ? "This version's file location isn't a real URL — likely seed/fixture data rather than an actual upload."
                  : 'This version has no file attached.'}
              </p>
            </div>
          ) : isPdf ? (
            <iframe
              key={pdfPage}
              src={pdfSrc(fileUrl, pdfPage)}
              title={documentTitle}
              style={{ width: '100%', height: '80vh', border: 'none', display: 'block' }}
            />
          ) : isImage ? (
            <img
              src={fileUrl}
              alt={documentTitle}
              draggable={false}
              onContextMenu={(e) => e.preventDefault()}
              style={{
                maxWidth: '100%',
                display: 'block',
                userSelect: 'none',
                WebkitUserSelect: 'none',
              }}
            />
          ) : (
            <div className="empty" style={{ padding: '48px 16px' }}>
              <Icon name="doc" size={32} />
              <div className="h3 mt-4 mb-2">Preview not available</div>
              <p className="caption mb-4">{fileMimeType || 'This file type'} can't be previewed inline.</p>
              <a className="btn btn-secondary btn-sm" href={fileUrl} target="_blank" rel="noreferrer">
                Open file
              </a>
            </div>
          )}

          {/* Signature fields — always empty in practice today; see DocumentWithUiExtras. */}
          {signatures.map((s, i) => (
            <div
              key={i}
              className={`sig-field ${s.signedBy ? 'signed' : ''}`}
              style={{ left: s.x + '%', top: s.y + '%', width: s.w + '%', height: s.h + '%' }}
              onClick={() => {
                if (!s.signedBy && !sealed && !lockedByOther) onSignatureFieldClick(i);
              }}
            >
              {s.signedBy ? getSignerName(s.signedBy) : '✎ ' + (s.field || s.fieldName || 'Signature')}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
