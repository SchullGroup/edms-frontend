'use client';

import { Icon } from '@/components/ui/Icons';
import { PdfViewer } from '@/components/documents/PdfViewer';
import type { DocumentSignatureFieldUI } from '@/components/documents/types';
import { fileKindLabel } from '@/constants/uploadTypes';

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
  /** `document:download` plus clearance for this document's tier. Also decides
   *  whether a PDF's text can be selected and copied. */
  canDownload: boolean;
  /** The page's own (audited) download; without one the button opens the file. */
  onDownload?: () => void;
  /** `document:print` plus clearance. PDFs only. */
  canPrint: boolean;
  /** The audited permission check run before printing; false cancels. */
  onBeforePrint?: () => Promise<boolean>;
}

/**
 * Renders the file straight from its own URL — no Google Docs Viewer or
 * similar third-party proxy, since a proxy caching a PDF means a re-uploaded
 * version can keep showing stale content to other viewers.
 *
 * PDFs open in `PdfViewer` (pdf.js): find, page navigation, zoom, and Print and
 * Download that follow the caller's permissions. No markup or redaction tools
 * (those don't exist server-side — see doc/[id]).
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
  canDownload,
  onDownload,
  canPrint,
  onBeforePrint,
}: DocumentViewerPanelProps) {
  const isPdf = fileMimeType === 'application/pdf';
  // TIFF is an `image/*` type but only Safari can draw it in an <img> — in
  // Chrome/Firefox it would be a broken image, so it takes the "no preview"
  // path along with DOCX/XLSX until a renderer exists for those.
  const isImage = fileMimeType.startsWith('image/') && fileMimeType !== 'image/tiff';

  const downloadLabel = 'Download a copy';

  if (fileUrl && isPdf) {
    return (
      <div className="viewer doc-viewer-col">
        <PdfViewer
          fileUrl={fileUrl}
          title={documentTitle}
          zoom={zoom}
          onZoomChange={onZoomChange}
          showWatermark={showWatermark}
          watermarkText={watermarkText}
          allowCopy={canDownload}
          canPrint={canPrint}
          onBeforePrint={onBeforePrint}
          actions={
            canDownload &&
            (onDownload ? (
              <button
                className="icon-btn"
                onClick={onDownload}
                title={downloadLabel}
                aria-label={downloadLabel}
              >
                <Icon name="download" size={16} />
              </button>
            ) : (
              <a
                className="icon-btn"
                href={fileUrl}
                target="_blank"
                rel="noreferrer"
                title={downloadLabel}
                aria-label={downloadLabel}
              >
                <Icon name="download" size={16} />
              </a>
            ))
          }
        />
      </div>
    );
  }

  return (
    <div className="viewer doc-viewer-col">
      <div className="viewer-bar">
        <span className="tabular-nums" style={{ flex: 1 }}>
          {fileMimeType || 'Unknown type'}
        </span>
        <button
          className="icon-btn"
          onClick={() => onZoomChange(Math.max(0.6, zoom - 0.15))}
          aria-label="Zoom out"
        >
          −
        </button>
        <span className="tabular-nums">{Math.round(zoom * 100)}%</span>
        <button
          className="icon-btn"
          onClick={() => onZoomChange(Math.min(1.6, zoom + 0.15))}
          aria-label="Zoom in"
        >
          +
        </button>
      </div>
      <div className="viewer-page-wrap">
        <div
          className="doc-page"
          style={{
            transform: `scale(${zoom})`,
            transformOrigin: 'top center',
            position: 'relative',
          }}
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
              <p className="caption mb-4">
                {fileKindLabel(fileMimeType)} can&rsquo;t be previewed yet.
                {canDownload
                  ? ' Download it to read it.'
                  : ` Download is turned off for ${confidentiality} documents.`}
              </p>
              {canDownload &&
                (onDownload ? (
                  <button className="btn btn-secondary btn-sm" onClick={onDownload}>
                    <Icon name="download" size={13} /> Download
                  </button>
                ) : (
                  <a
                    className="btn btn-secondary btn-sm"
                    href={fileUrl}
                    target="_blank"
                    rel="noreferrer"
                  >
                    <Icon name="download" size={13} /> Download
                  </a>
                ))}
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
              {s.signedBy
                ? getSignerName(s.signedBy)
                : '✎ ' + (s.field || s.fieldName || 'Signature')}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
