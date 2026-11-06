'use client';

import { useEffect, useState } from 'react';

import {
  downloadFileName,
  fileActionFor,
  filesService,
  type FileFetchError,
} from '@/apis/services/files.service';
import { Icon } from '@/components/ui/Icons';
import { PdfViewer } from '@/components/documents/PdfViewer';
import type { DocumentSignatureFieldUI } from '@/components/documents/types';
import { fileKindLabel } from '@/constants/uploadTypes';

export interface DocumentViewerPanelProps {
  documentTitle: string;
  confidentiality: string;
  /** The API's file link (`/files/:token`), or undefined if none/not renderable. */
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
  /** `document:download` plus clearance for this document's tier. Also decides
   *  whether a PDF's text can be selected and copied. */
  canDownload: boolean;
  /** The page's own (audited) download; without one the button opens the file. */
  onDownload?: () => void;
  /** Leaves Download out of the PDF viewer bar, for a page with its own button. */
  hideDownloadButton?: boolean;
  /** `document:print` plus clearance. PDFs only. */
  canPrint: boolean;
  /** The audited permission check run before printing; false cancels. */
  onBeforePrint?: () => Promise<boolean>;
  /** The version's OCR text, searched and shown when a PDF is a scan. */
  ocrText?: string | null;
  ocrStatus?: string;
}

/** The first link seen for a file. Each refetch mints a new token in the link's
 *  path, which would otherwise reload the PDF or image. */
function useFirstUrlFor(fileKey: string | undefined, url: string | undefined) {
  const key = fileKey ?? url?.split('?')[0];
  const [first, setFirst] = useState({ key, url });
  if (first.key !== key) setFirst({ key, url });
  return first.key === key ? first.url : url;
}

/** The image behind a file link, fetched with the session; images exist only as the original. */
function SecureImage({ url, alt }: { url: string; alt: string }) {
  const [state, setState] = useState<{ src?: string; error?: string }>({});
  useEffect(() => {
    let cancelled = false;
    let src: string | undefined;
    setState({});
    filesService
      .fetch(url, 'original')
      .then((blob) => {
        src = URL.createObjectURL(blob);
        if (cancelled) URL.revokeObjectURL(src);
        else setState({ src });
      })
      .catch((err: FileFetchError) => {
        if (cancelled) return;
        setState({
          error:
            err.status === 403
              ? "Viewing this image needs permission to download the original file."
              : err.message || "The image couldn't be loaded.",
        });
      });
    return () => {
      cancelled = true;
      if (src) URL.revokeObjectURL(src);
    };
  }, [url]);

  if (state.error)
    return (
      <div className="empty" style={{ padding: '48px 16px' }}>
        <Icon name="doc" size={32} />
        <div className="h3 mt-4 mb-2">Preview not available</div>
        <p className="caption">{state.error}</p>
      </div>
    );
  if (!state.src) return <div className="caption" style={{ padding: 48 }}>Loading image…</div>;
  return (
    <img
      src={state.src}
      alt={alt}
      draggable={false}
      onContextMenu={(e) => e.preventDefault()}
      style={{
        maxWidth: '100%',
        display: 'block',
        userSelect: 'none',
        WebkitUserSelect: 'none',
      }}
    />
  );
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
  canDownload,
  onDownload,
  hideDownloadButton = false,
  canPrint,
  onBeforePrint,
  ocrText,
  ocrStatus,
}: DocumentViewerPanelProps) {
  const isPdf = fileMimeType === 'application/pdf';
  // Only Safari draws TIFF in an <img>, so it takes the "no preview" path, as do
  // DOCX/XLSX uploaded before only PDF and images were accepted.
  const isImage = fileMimeType.startsWith('image/') && fileMimeType !== 'image/tiff';

  const downloadLabel = 'Download a copy';
  // Shown from the first link; download links take the newest, which hasn't expired.
  const shownUrl = useFirstUrlFor(rawFileKey, fileUrl);

  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const saveFile = async () => {
    if (!fileUrl) return;
    const action = fileActionFor(fileMimeType, 'download');
    setSaving(true);
    setSaveError(null);
    try {
      await filesService.save(fileUrl, downloadFileName(documentTitle, fileMimeType, action), action);
    } catch (err: any) {
      setSaveError(
        err?.status === 403 ? "You don't have permission to download this file." : err?.message,
      );
    } finally {
      setSaving(false);
    }
  };

  if (shownUrl && isPdf) {
    return (
      <div className="viewer doc-viewer-col">
        <PdfViewer
          fileUrl={shownUrl}
          title={documentTitle}
          zoom={zoom}
          onZoomChange={onZoomChange}
          showWatermark={showWatermark}
          watermarkText={watermarkText}
          allowCopy={canDownload}
          canPrint={canPrint}
          onBeforePrint={onBeforePrint}
          ocrText={ocrText}
          ocrStatus={ocrStatus}
          actions={
            canDownload &&
            !hideDownloadButton &&
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
              <button
                className="icon-btn"
                onClick={saveFile}
                disabled={saving}
                title={saveError ?? downloadLabel}
                aria-label={downloadLabel}
              >
                <Icon name="download" size={16} />
              </button>
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
          ) : isImage && shownUrl ? (
            <SecureImage url={shownUrl} alt={documentTitle} />
          ) : (
            <div className="empty" style={{ padding: '48px 16px' }}>
              <Icon name="doc" size={32} />
              <div className="h3 mt-4 mb-2">Preview not available</div>
              <p className="caption mb-4">
                {fileKindLabel(fileMimeType)} can’t be previewed yet.
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
                  <button className="btn btn-secondary btn-sm" onClick={saveFile} disabled={saving}>
                    <Icon name="download" size={13} /> Download
                  </button>
                ))}
              {saveError && <p className="caption mt-2">{saveError}</p>}
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
                ? s.signer?.name || 'Unknown user'
                : '✎ ' + (s.field || s.fieldName || 'Signature')}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
