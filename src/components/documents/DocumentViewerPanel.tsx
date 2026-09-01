'use client';

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

/**
 * Renders the file straight from its own URL — no Google Docs Viewer or
 * similar third-party proxy, since a proxy caching a PDF means a re-uploaded
 * version can keep showing stale content to other viewers.
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

  return (
    <div className="viewer doc-viewer-col">
      <div className="viewer-bar">
        <span className="tnum" style={{ flex: 1 }}>
          {fileMimeType || 'Unknown type'}
        </span>
        <button className="icon-btn" onClick={() => onZoomChange(Math.max(0.6, zoom - 0.15))}>
          −
        </button>
        <span className="tnum">{Math.round(zoom * 100)}%</span>
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
              <div className="h3 mt16 mb8">No file available</div>
              <p className="caption">
                {rawFileKey
                  ? "This version's file location isn't a real URL — likely seed/fixture data rather than an actual upload."
                  : 'This version has no file attached.'}
              </p>
            </div>
          ) : isPdf ? (
            <iframe
              src={fileUrl}
              title={documentTitle}
              style={{ width: '100%', height: '80vh', border: 'none', display: 'block' }}
            />
          ) : isImage ? (
            <img src={fileUrl} alt={documentTitle} style={{ maxWidth: '100%', display: 'block' }} />
          ) : (
            <div className="empty" style={{ padding: '48px 16px' }}>
              <Icon name="doc" size={32} />
              <div className="h3 mt16 mb8">Preview not available</div>
              <p className="caption mb16">{fileMimeType || 'This file type'} can't be previewed inline.</p>
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
