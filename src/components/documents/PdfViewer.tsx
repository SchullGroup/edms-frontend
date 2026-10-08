'use client';

import React, { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { PDFDocumentProxy, RenderTask } from 'pdfjs-dist';
import type { TextContent, TextItem } from 'pdfjs-dist/types/src/display/api';
import { Icon } from '@/components/ui/Icons';
import { useUIStore } from '@/store/useUIStore';
import {
  buildPageText,
  buildPlainText,
  findMatches,
  itemRanges,
  type PageText,
} from '@/utils/pdfSearch';
import { printPdf } from '@/utils/printPdf';

type PdfJs = typeof import('pdfjs-dist');

let pdfjsPromise: Promise<PdfJs> | null = null;

/** pdf.js touches browser globals when imported, so it loads on the client, once. */
function loadPdfJs(): Promise<PdfJs> {
  pdfjsPromise ??= import('pdfjs-dist')
    .then((pdfjs) => {
      pdfjs.GlobalWorkerOptions.workerSrc = '/pdfjs/pdf.worker.min.mjs';
      return pdfjs;
    })
    .catch((err) => {
      pdfjsPromise = null;
      throw err;
    });
  return pdfjsPromise;
}

// Served from the app's own origin; copied out of node_modules by
// scripts/copy-pdfjs-assets.mjs. The WebAssembly decoders handle the JBIG2 and
// JPEG 2000 images common in scanned documents.
const PDFJS_ASSETS = {
  cMapUrl: '/pdfjs/cmaps/',
  cMapPacked: true,
  standardFontDataUrl: '/pdfjs/standard_fonts/',
  wasmUrl: '/pdfjs/wasm/',
  iccUrl: '/pdfjs/iccs/',
};

// Widest a page is drawn at 100% zoom: the viewer's width, up to this.
const MAX_FIT_WIDTH = 900;
// Cap on canvas pixels per page, so high zoom on a HiDPI screen can't exhaust memory.
const MAX_CANVAS_PIXELS = 16_777_216;

interface PageTextEntry {
  content: TextContent;
  text: PageText;
}

interface PageMatch {
  start: number;
  end: number;
  active: boolean;
}

export interface PdfViewerProps {
  fileUrl: string;
  title: string;
  zoom: number;
  onZoomChange: (zoom: number) => void;
  showWatermark: boolean;
  watermarkText: string;
  /** Text can be selected and copied only by someone who could download the file anyway. */
  allowCopy: boolean;
  canPrint: boolean;
  /** Runs before printing (the permission check and audit entry); false cancels. */
  onBeforePrint?: () => Promise<boolean>;
  /** Extra toolbar buttons, shown at the right end. */
  actions?: React.ReactNode;
  /** The backend's OCR of this version. A scan has no text of its own, so
   *  find searches this instead and shows it as text. */
  ocrText?: string | null;
  ocrStatus?: string;
}

/**
 * The document viewer for PDFs, drawn with pdf.js: find with highlighting, page
 * navigation, zoom, and a Print button that follows the caller's permission and
 * keeps the watermark. Unlike the browser's built-in viewer, it has no Download
 * or Print of its own that would skip the app's checks.
 */
export function PdfViewer({
  fileUrl,
  title,
  zoom,
  onZoomChange,
  showWatermark,
  watermarkText,
  allowCopy,
  canPrint,
  onBeforePrint,
  actions,
  ocrText,
  ocrStatus,
}: PdfViewerProps) {
  const { addToast } = useUIStore();

  // A signed URL changes on every refetch of the document; only a new file
  // (a different path) should reload the viewer.
  const filePath = fileUrl.split('?')[0];
  const latestUrl = useRef(fileUrl);
  latestUrl.current = fileUrl;

  const [pdfjs, setPdfjs] = useState<PdfJs | null>(null);
  const [doc, setDoc] = useState<PDFDocumentProxy | null>(null);
  const [baseSize, setBaseSize] = useState<{ w: number; h: number } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const textCache = useRef(new Map<number, Promise<PageTextEntry>>());

  useEffect(() => {
    let cancelled = false;
    let destroy: (() => void) | undefined;
    setDoc(null);
    setError(null);
    textCache.current = new Map();
    (async () => {
      try {
        const lib = await loadPdfJs();
        if (cancelled) return;
        const task = lib.getDocument({
          url: latestUrl.current,
          ...PDFJS_ASSETS,
          // S3 doesn't expose Content-Range to scripts, so fetch the file whole.
          // (No scripting option is needed: JavaScript inside a PDF only runs
          // through pdf.js's full viewer, which this doesn't use.)
          disableRange: true,
          disableStream: true,
        });
        destroy = () => void task.destroy();
        const pdf = await task.promise;
        const first = await pdf.getPage(1);
        if (cancelled) return;
        const vp = first.getViewport({ scale: 1 });
        setPdfjs(lib);
        setBaseSize({ w: vp.width, h: vp.height });
        setDoc(pdf);
      } catch (err: any) {
        if (cancelled) return;
        // S3 answers 404 for a missing file and 403 for an expired link.
        const status = err?.name === 'ResponseException' ? err.status : undefined;
        setError(
          err?.name === 'PasswordException'
            ? "This PDF is password-protected, so it can't be shown here."
            : err?.name === 'InvalidPDFException'
              ? "This file isn't a readable PDF."
              : status === 404
                ? "This version's file is missing from storage."
                : status === 403
                  ? 'The link to this file has expired. Reload the page.'
                  : "The PDF couldn't be loaded. Check your connection and reload the page.",
        );
      }
    })();
    return () => {
      cancelled = true;
      destroy?.();
    };
  }, [filePath]);

  const getPageText = useCallback(
    (n: number): Promise<PageTextEntry> => {
      if (!doc) return Promise.reject(new Error('No document'));
      let entry = textCache.current.get(n);
      if (!entry) {
        entry = doc
          .getPage(n)
          .then((page) => page.getTextContent())
          .then((content) => ({
            content,
            text: buildPageText(content.items.filter((item): item is TextItem => 'str' in item)),
          }));
        textCache.current.set(n, entry);
      }
      return entry;
    },
    [doc],
  );

  // --- Scanned documents ---------------------------------------------------
  // A scan is pictures of pages with no text of its own. If page 1 has no text
  // and the backend has OCR'd the file, offer that text as a second view.
  const hasOcr = !!ocrText?.trim();
  const [scanned, setScanned] = useState(false);
  const [view, setView] = useState<'pages' | 'text'>('pages');
  useEffect(() => {
    setScanned(false);
    setView('pages');
    if (!doc) return;
    let cancelled = false;
    getPageText(1)
      .then((e) => {
        if (!cancelled) setScanned(!e.text.text.trim());
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [doc, getPageText]);
  const showTextView = scanned && hasOcr && view === 'text';

  // --- Layout --------------------------------------------------------------
  const scrollRef = useRef<HTMLDivElement>(null);
  const [availableWidth, setAvailableWidth] = useState(0);
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setAvailableWidth(el.clientWidth - 24));
    ro.observe(el);
    return () => ro.disconnect();
  }, [doc]);

  const scale = useMemo(() => {
    if (!baseSize || availableWidth <= 0) return 0;
    const fit = Math.min(availableWidth, MAX_FIT_WIDTH) / baseSize.w;
    return Math.round(fit * zoom * 1000) / 1000;
  }, [baseSize, availableWidth, zoom]);

  const pageEls = useRef(new Map<number, HTMLDivElement>());
  const registerPage = useCallback((n: number, el: HTMLDivElement | null) => {
    if (el) pageEls.current.set(n, el);
    else pageEls.current.delete(n);
  }, []);

  const numPages = doc?.numPages ?? 0;
  const [currentPage, setCurrentPage] = useState(1);
  const [pageDraft, setPageDraft] = useState<string | null>(null);

  const onScroll = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;
    // The page under the middle of the viewer.
    const line = el.scrollTop + el.clientHeight / 2;
    let page = 1;
    for (let n = 1; n <= numPages; n++) {
      const p = pageEls.current.get(n);
      if (p && p.offsetTop <= line) page = n;
      else break;
    }
    setCurrentPage(page);
  }, [numPages]);

  const scrollToPage = useCallback((n: number) => {
    const el = scrollRef.current;
    const p = pageEls.current.get(n);
    if (el && p) el.scrollTo({ top: p.offsetTop - 12 });
  }, []);

  const goToDraftPage = () => {
    const n = parseInt(pageDraft ?? '', 10);
    if (n >= 1 && n <= numPages) scrollToPage(n);
    setPageDraft(null);
  };

  // --- Find ----------------------------------------------------------------
  const searchRef = useRef<HTMLInputElement>(null);
  const [query, setQuery] = useState('');
  const [matches, setMatches] = useState<{ page: number; start: number; end: number }[]>([]);
  const [active, setActive] = useState(0);
  // `ocr` when the last search ran over the scan's OCR text instead of the PDF's own.
  const [mode, setMode] = useState<'pdf' | 'ocr'>('pdf');
  const [searching, setSearching] = useState(false);
  const searchSeq = useRef(0);
  const scrollToActive = useRef(false);

  useEffect(() => {
    const seq = ++searchSeq.current;
    if (!doc || !query.trim()) {
      setMatches([]);
      setSearching(false);
      return;
    }
    setSearching(true);
    const timer = window.setTimeout(async () => {
      try {
        const pages = await Promise.all(
          Array.from({ length: doc.numPages }, (_, i) => getPageText(i + 1).then((e) => e.text)),
        );
        if (seq !== searchSeq.current) return;
        if (pages.every((p) => !p.text.trim())) {
          // No text in the PDF itself: search what OCR read instead.
          const found = ocrText?.trim() ? findMatches([buildPlainText(ocrText)], query) : [];
          setMode('ocr');
          setMatches(found);
          setActive(0);
          if (found.length) {
            scrollToActive.current = true;
            setView('text');
          }
          return;
        }
        const found = findMatches(pages, query);
        setMode('pdf');
        setMatches(found);
        setActive(0);
        if (found.length) {
          scrollToActive.current = true;
          scrollToPage(found[0].page);
        }
      } catch {
        // A page whose text can't be read just has no matches.
      } finally {
        if (seq === searchSeq.current) setSearching(false);
      }
    }, 250);
    return () => window.clearTimeout(timer);
  }, [doc, query, getPageText, scrollToPage, ocrText]);

  const step = (delta: number) => {
    if (!matches.length) return;
    const next = (active + delta + matches.length) % matches.length;
    setActive(next);
    scrollToActive.current = true;
    if (mode === 'ocr') setView('text');
    else scrollToPage(matches[next].page);
  };

  const matchesByPage = useMemo(() => {
    const map = new Map<number, PageMatch[]>();
    matches.forEach((m, i) => {
      const list = map.get(m.page) ?? [];
      list.push({ start: m.start, end: m.end, active: i === active });
      map.set(m.page, list);
    });
    return map;
  }, [matches, active]);

  // Centres the current match once its page has drawn its highlights.
  const onActiveHighlight = useCallback((el: HTMLElement) => {
    const box = scrollRef.current;
    if (!box || !scrollToActive.current) return;
    scrollToActive.current = false;
    const r = el.getBoundingClientRect();
    const b = box.getBoundingClientRect();
    box.scrollBy({
      top: r.top - b.top - box.clientHeight / 2,
      left: r.left < b.left || r.right > b.right ? r.left - b.left - box.clientWidth / 2 : 0,
    });
  }, []);

  // --- Print ---------------------------------------------------------------
  const [printing, setPrinting] = useState<{ done: number; total: number } | null>(null);
  const print = async () => {
    if (!doc || printing || !canPrint) return;
    setPrinting({ done: 0, total: doc.numPages });
    try {
      if (onBeforePrint && !(await onBeforePrint())) return;
      await printPdf(doc, {
        title,
        watermarkText: showWatermark ? watermarkText : undefined,
        onProgress: (done, total) => setPrinting({ done, total }),
      });
    } catch {
      addToast("The document couldn't be prepared for printing", 'error');
    } finally {
      setPrinting(null);
    }
  };

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (!(e.ctrlKey || e.metaKey) || e.altKey) return;
    const key = e.key.toLowerCase();
    if (key === 'f' && doc) {
      e.preventDefault();
      searchRef.current?.focus();
      searchRef.current?.select();
    } else if (key === 'p') {
      // The browser would print the whole app page, without the watermark.
      e.preventDefault();
      if (canPrint) void print();
    }
  };

  const ready = !!doc && !!pdfjs && scale > 0;
  const matchLabel = searching
    ? 'Searching…'
    : !query.trim()
      ? ''
      : mode === 'ocr' && !hasOcr
        ? ocrStatus === 'pending' || ocrStatus === 'processing'
          ? 'Scan not read yet'
          : 'No text in this scan'
        : matches.length
          ? `${active + 1} of ${matches.length}`
          : 'No matches';

  return (
    <div onKeyDown={onKeyDown}>
      <div className="viewer-bar flex-wrap" role="toolbar" aria-label="Document viewer">
        <div className="pdf-search" role="search">
          <Icon name="search" size={14} />
          <input
            ref={searchRef}
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                step(e.shiftKey ? -1 : 1);
              } else if (e.key === 'Escape') {
                setQuery('');
              }
            }}
            placeholder="Find in document"
            aria-label="Find in document"
            disabled={!doc}
          />
          <span className="tabular-nums" aria-live="polite" style={{ minWidth: 64, opacity: 0.8 }}>
            {matchLabel}
          </span>
          <button
            className="icon-btn"
            onClick={() => step(-1)}
            disabled={matches.length === 0}
            title="Previous match (Shift+Enter)"
            aria-label="Previous match"
          >
            <span style={{ display: 'inline-flex', transform: 'rotate(180deg)' }}>
              <Icon name="chevD" size={14} />
            </span>
          </button>
          <button
            className="icon-btn"
            onClick={() => step(1)}
            disabled={matches.length === 0}
            title="Next match (Enter)"
            aria-label="Next match"
          >
            <Icon name="chevD" size={14} />
          </button>
        </div>
        <span style={{ flex: 1 }} />
        {scanned && hasOcr && (
          <button
            className="pdf-view-toggle"
            aria-pressed={view === 'text'}
            onClick={() => setView(view === 'text' ? 'pages' : 'text')}
            title="This is a scan. Switch between the page images and the text read from them"
          >
            {view === 'text' ? 'Show pages' : 'Scanned text'}
          </button>
        )}
        {numPages > 0 && !showTextView && (
          <form
            className="flex items-center gap-1"
            onSubmit={(e) => {
              e.preventDefault();
              goToDraftPage();
            }}
          >
            <input
              className="pdf-page-input tabular-nums"
              inputMode="numeric"
              value={pageDraft ?? String(currentPage)}
              onFocus={(e) => {
                setPageDraft(String(currentPage));
                e.currentTarget.select();
              }}
              onChange={(e) => setPageDraft(e.target.value.replace(/\D/g, ''))}
              onBlur={goToDraftPage}
              aria-label={`Page number, of ${numPages}`}
            />
            <span className="tabular-nums" style={{ opacity: 0.8 }}>
              / {numPages}
            </span>
          </form>
        )}
        <span className="sep" aria-hidden="true" />
        <button
          className="icon-btn"
          onClick={() => onZoomChange(Math.max(0.6, Math.round((zoom - 0.15) * 100) / 100))}
          disabled={zoom <= 0.6}
          title="Zoom out"
          aria-label="Zoom out"
        >
          −
        </button>
        <span className="tabular-nums" style={{ minWidth: 36, textAlign: 'center' }}>
          {Math.round(zoom * 100)}%
        </span>
        <button
          className="icon-btn"
          onClick={() => onZoomChange(Math.min(1.6, Math.round((zoom + 0.15) * 100) / 100))}
          disabled={zoom >= 1.6}
          title="Zoom in"
          aria-label="Zoom in"
        >
          +
        </button>
        {(canPrint || actions) && <span className="sep" aria-hidden="true" />}
        {canPrint && (
          <button
            className="icon-btn"
            onClick={() => void print()}
            disabled={!doc || !!printing}
            title={printing ? `Preparing page ${printing.done} of ${printing.total}` : 'Print'}
            aria-label="Print"
          >
            <Icon name="print" size={16} />
          </button>
        )}
        {printing && (
          <span className="tabular-nums" role="status" style={{ opacity: 0.8 }}>
            Preparing {printing.done}/{printing.total}
          </span>
        )}
        {actions}
      </div>

      <div
        ref={scrollRef}
        className="pdf-scroll"
        tabIndex={0}
        onScroll={onScroll}
        aria-label={`${title}, PDF`}
        aria-busy={!ready && !error}
        onCopy={allowCopy ? undefined : (e) => e.preventDefault()}
        onContextMenu={allowCopy ? undefined : (e) => e.preventDefault()}
      >
        {error ? (
          <div className="pdf-status" role="alert">
            <Icon name="doc" size={28} />
            <div>{error}</div>
          </div>
        ) : !ready ? (
          <div className="pdf-status">Loading document…</div>
        ) : showTextView ? (
          <OcrTextView
            text={ocrText ?? ''}
            matches={mode === 'ocr' ? matches : []}
            active={active}
            zoom={zoom}
            allowCopy={allowCopy}
            watermarkText={showWatermark ? watermarkText : undefined}
            onActiveHighlight={onActiveHighlight}
          />
        ) : (
          <div className="pdf-pages">
            {Array.from({ length: numPages }, (_, i) => (
              <PdfPage
                key={i + 1}
                pdfjs={pdfjs}
                doc={doc}
                pageNumber={i + 1}
                numPages={numPages}
                scale={scale}
                estimate={{ w: baseSize!.w * scale, h: baseSize!.h * scale }}
                scrollRoot={scrollRef}
                getPageText={getPageText}
                matches={matchesByPage.get(i + 1)}
                onActiveHighlight={onActiveHighlight}
                registerPage={registerPage}
                allowCopy={allowCopy}
                watermarkText={showWatermark ? watermarkText : undefined}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

/**
 * A scan's OCR text on a sheet, with find matches highlighted. Line breaks are
 * kept as OCR returned them.
 */
function OcrTextView({
  text,
  matches,
  active,
  zoom,
  allowCopy,
  watermarkText,
  onActiveHighlight,
}: {
  text: string;
  matches: { start: number; end: number }[];
  active: number;
  zoom: number;
  allowCopy: boolean;
  watermarkText?: string;
  onActiveHighlight: (el: HTMLElement) => void;
}) {
  const activeRef = useRef<HTMLElement>(null);
  useEffect(() => {
    if (activeRef.current) onActiveHighlight(activeRef.current);
  }, [matches, active, onActiveHighlight]);

  const parts: React.ReactNode[] = [];
  let pos = 0;
  matches.forEach((m, i) => {
    if (m.start > pos) parts.push(text.slice(pos, m.start));
    parts.push(
      <mark
        key={i}
        ref={i === active ? activeRef : undefined}
        className={i === active ? 'ocr-hl active' : 'ocr-hl'}
      >
        {text.slice(m.start, m.end)}
      </mark>,
    );
    pos = m.end;
  });
  if (pos < text.length) parts.push(text.slice(pos));

  return (
    <div
      className="ocr-sheet"
      style={watermarkText ? { backgroundImage: watermarkTile(watermarkText) } : undefined}
    >
      <p className="ocr-note">
        This is a scanned document. Below is the text read from it by OCR, which can contain
        mistakes. Matches can&rsquo;t be highlighted on the page images.
      </p>
      <div
        className="ocr-text"
        style={{ fontSize: 14 * zoom, userSelect: allowCopy ? 'text' : 'none' }}
      >
        {parts}
      </div>
    </div>
  );
}

/** The diagonal watermark as a repeating tile, so it covers a sheet of any length.
 *  The tile is sized to the label (about 20px per character at 22px with its
 *  letter spacing), so a long name isn't cut off at the tile's edges. */
function watermarkTile(text: string): string {
  const esc = text.toUpperCase().replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);
  const angle = (32 * Math.PI) / 180;
  const length = Math.max(text.length, 10) * 20;
  const w = Math.round(length * Math.cos(angle) + 140);
  const h = Math.round(length * Math.sin(angle) + 180);
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}"><text x="${w / 2}" y="${h / 2}" transform="rotate(-32 ${w / 2} ${h / 2})" text-anchor="middle" dominant-baseline="middle" font-family="Inter, Arial, sans-serif" font-weight="800" font-size="22" letter-spacing="2" fill="rgba(222,91,109,0.14)">${esc}</text></svg>`;
  return `url("data:image/svg+xml,${encodeURIComponent(svg)}")`;
}

/** 42px at 100%, shrunk so the diagonal label fits across the page. Each
 *  upper-case character with the watermark's letter spacing is about 0.8em wide. */
function watermarkFontSize(text: string, pageWidth: number, scale: number): number {
  const fit = (0.9 * pageWidth) / (Math.max(text.length, 8) * 0.8 * Math.cos((32 * Math.PI) / 180));
  return Math.min(42 * scale, fit);
}

interface PdfPageProps {
  pdfjs: PdfJs;
  doc: PDFDocumentProxy;
  pageNumber: number;
  numPages: number;
  scale: number;
  /** Size to reserve before the page itself has loaded (the first page's). */
  estimate: { w: number; h: number };
  scrollRoot: React.RefObject<HTMLDivElement | null>;
  getPageText: (n: number) => Promise<PageTextEntry>;
  matches?: PageMatch[];
  onActiveHighlight: (el: HTMLElement) => void;
  registerPage: (n: number, el: HTMLDivElement | null) => void;
  allowCopy: boolean;
  watermarkText?: string;
}

/** One page: drawn only once it nears the visible area, redrawn when the zoom changes. */
const PdfPage = memo(function PdfPage({
  pdfjs,
  doc,
  pageNumber,
  numPages,
  scale,
  estimate,
  scrollRoot,
  getPageText,
  matches,
  onActiveHighlight,
  registerPage,
  allowCopy,
  watermarkText,
}: PdfPageProps) {
  const pageRef = useRef<HTMLDivElement | null>(null);
  const canvasHost = useRef<HTMLDivElement>(null);
  const textHost = useRef<HTMLDivElement>(null);
  const [near, setNear] = useState(false);
  const [size, setSize] = useState<{ w: number; h: number; total: number } | null>(null);
  const [layer, setLayer] = useState<{ divs: HTMLElement[]; text: PageText } | null>(null);

  const setPageRef = useCallback(
    (el: HTMLDivElement | null) => {
      pageRef.current = el;
      registerPage(pageNumber, el);
    },
    [registerPage, pageNumber],
  );

  useEffect(() => {
    const el = pageRef.current;
    if (!el) return;
    const io = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) setNear(true);
      },
      { root: scrollRoot.current, rootMargin: '800px 0px' },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [scrollRoot]);

  useEffect(() => {
    if (!near || scale <= 0) return;
    let cancelled = false;
    let renderTask: RenderTask | undefined;
    let textLayer: InstanceType<PdfJs['TextLayer']> | undefined;
    (async () => {
      const page = await doc.getPage(pageNumber);
      if (cancelled) return;
      const viewport = page.getViewport({ scale });
      const userUnit = (viewport as unknown as { userUnit?: number }).userUnit ?? 1;
      setSize({ w: viewport.width, h: viewport.height, total: viewport.scale * userUnit });

      // Draw into a fresh canvas and swap it in when done, so the old drawing
      // stays up meanwhile and a cancelled render never shares a canvas.
      const canvas = document.createElement('canvas');
      const dpr = window.devicePixelRatio || 1;
      const ratio = Math.min(
        dpr,
        Math.sqrt(MAX_CANVAS_PIXELS / (viewport.width * viewport.height)),
      );
      canvas.width = Math.floor(viewport.width * ratio);
      canvas.height = Math.floor(viewport.height * ratio);
      canvas.style.width = `${Math.floor(viewport.width)}px`;
      canvas.style.height = `${Math.floor(viewport.height)}px`;
      canvas.setAttribute('aria-hidden', 'true');
      renderTask = page.render({
        canvas,
        viewport,
        transform: ratio !== 1 ? [ratio, 0, 0, ratio, 0, 0] : undefined,
      });
      await renderTask.promise;
      if (cancelled) return;
      canvasHost.current?.replaceChildren(canvas);

      const { content, text } = await getPageText(pageNumber);
      if (cancelled || !textHost.current) return;
      const container = document.createElement('div');
      container.className = allowCopy ? 'textLayer' : 'textLayer no-select';
      textHost.current.replaceChildren(container);
      textLayer = new pdfjs.TextLayer({ textContentSource: content, container, viewport });
      await textLayer.render();
      if (cancelled) return;
      setLayer({ divs: textLayer.textDivs, text });
    })().catch((err) => {
      if (err?.name !== 'RenderingCancelledException' && !cancelled) {
        console.warn(`PDF page ${pageNumber} failed to render`, err);
      }
    });
    return () => {
      cancelled = true;
      renderTask?.cancel();
      textLayer?.cancel();
    };
  }, [near, scale, doc, pdfjs, pageNumber, getPageText, allowCopy]);

  // Find highlights: rebuild the spans a match touches, and restore the rest.
  const touched = useRef(new Set<number>());
  useEffect(() => {
    if (!layer) return;
    const { divs, text } = layer;
    for (const i of touched.current) {
      if (divs[i]) divs[i].textContent = text.items[i];
    }
    touched.current = new Set();
    if (!matches?.length) return;

    const byItem = new Map<number, { from: number; to: number; active: boolean }[]>();
    for (const m of matches) {
      for (const r of itemRanges(text, m.start, m.end)) {
        const list = byItem.get(r.item) ?? [];
        list.push({ from: r.from, to: r.to, active: m.active });
        byItem.set(r.item, list);
      }
    }
    let activeEl: HTMLElement | null = null;
    byItem.forEach((ranges, i) => {
      const div = divs[i];
      const str = text.items[i];
      if (!div) return;
      ranges.sort((a, b) => a.from - b.from);
      const frag = document.createDocumentFragment();
      let pos = 0;
      for (const r of ranges) {
        if (r.from > pos) frag.append(str.slice(pos, r.from));
        const mark = document.createElement('span');
        mark.className = r.active ? 'pdf-hl active' : 'pdf-hl';
        mark.textContent = str.slice(r.from, r.to);
        frag.append(mark);
        if (r.active && !activeEl) activeEl = mark;
        pos = r.to;
      }
      if (pos < str.length) frag.append(str.slice(pos));
      div.replaceChildren(frag);
      touched.current.add(i);
    });
    if (activeEl) onActiveHighlight(activeEl);
  }, [layer, matches, onActiveHighlight]);

  const w = size?.w ?? estimate.w;
  const h = size?.h ?? estimate.h;
  return (
    <div
      ref={setPageRef}
      className="pdf-page"
      role="region"
      aria-label={`Page ${pageNumber} of ${numPages}`}
      style={
        {
          width: Math.floor(w),
          height: Math.floor(h),
          '--total-scale-factor': size?.total ?? scale,
        } as React.CSSProperties
      }
    >
      <div ref={canvasHost} />
      <div ref={textHost} />
      {watermarkText && (
        <div className="watermark" aria-hidden="true">
          <span style={{ fontSize: watermarkFontSize(watermarkText, w, size?.total ?? scale) }}>
            {watermarkText}
          </span>
        </div>
      )}
    </div>
  );
});
