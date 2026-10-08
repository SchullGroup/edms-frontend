import type { PDFDocumentProxy } from 'pdfjs-dist';

// 2× the PDF's 72 dpi: about 144 dpi on paper, sharp enough for text without
// making long documents heavy.
const PRINT_SCALE = 2;

/** Burns the watermark into the page image, the same diagonal text the viewer shows. */
function drawWatermark(canvas: HTMLCanvasElement, text: string) {
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  const label = text.toUpperCase();
  ctx.save();
  ctx.translate(canvas.width / 2, canvas.height / 2);
  ctx.rotate((-32 * Math.PI) / 180);
  let size = canvas.width / 12;
  ctx.font = `800 ${size}px Inter, Arial, sans-serif`;
  // Shrink a long label until it fits across the page.
  while (size > 12 && ctx.measureText(label).width > canvas.width * 0.9) {
    size *= 0.9;
    ctx.font = `800 ${size}px Inter, Arial, sans-serif`;
  }
  ctx.fillStyle = 'rgba(222, 91, 109, 0.18)';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(label, 0, 0);
  ctx.restore();
}

/** Prints page images from a hidden frame; resolves once the print dialog has opened. */
function printImages(urls: string[], title: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const frame = document.createElement('iframe');
    frame.setAttribute('aria-hidden', 'true');
    frame.style.cssText = 'position:fixed;right:0;bottom:0;width:0;height:0;border:0;';
    const esc = (s: string) => s.replace(/[&<>"]/g, (c) => `&#${c.charCodeAt(0)};`);
    frame.srcdoc = `<!doctype html><html><head><meta charset="utf-8"><title>${esc(title)}</title>
<style>@page{margin:0}html,body{margin:0}img{display:block;width:100%;break-after:page}img:last-child{break-after:auto}</style>
</head><body>${urls.map((u) => `<img src="${u}" alt="">`).join('')}</body></html>`;

    const cleanup = () => {
      frame.remove();
      urls.forEach((u) => URL.revokeObjectURL(u));
    };
    frame.onload = async () => {
      const win = frame.contentWindow;
      if (!win) {
        cleanup();
        reject(new Error('Could not open the print frame'));
        return;
      }
      try {
        await Promise.all(Array.from(win.document.images, (img) => img.decode()));
      } catch {
        // A page that fails to decode prints blank rather than blocking the rest.
      }
      // Firefox returns from print() before the dialog closes, so the frame is
      // only removed after printing, with a long fallback in case that event never comes.
      const fallback = window.setTimeout(cleanup, 10 * 60 * 1000);
      win.addEventListener('afterprint', () => {
        window.clearTimeout(fallback);
        window.setTimeout(cleanup, 1000);
      });
      win.focus();
      win.print();
      resolve();
    };
    document.body.appendChild(frame);
  });
}

/**
 * Prints a loaded PDF with the watermark on every page. Pages are printed as
 * images so the watermark can't be dropped, including from "Save as PDF".
 */
export async function printPdf(
  doc: PDFDocumentProxy,
  {
    title,
    watermarkText,
    onProgress,
  }: { title: string; watermarkText?: string; onProgress?: (done: number, total: number) => void },
): Promise<void> {
  const urls: string[] = [];
  try {
    for (let n = 1; n <= doc.numPages; n++) {
      const page = await doc.getPage(n);
      const viewport = page.getViewport({ scale: PRINT_SCALE });
      const canvas = document.createElement('canvas');
      canvas.width = Math.floor(viewport.width);
      canvas.height = Math.floor(viewport.height);
      await page.render({ canvas, viewport, intent: 'print' }).promise;
      if (watermarkText) drawWatermark(canvas, watermarkText);
      const blob = await new Promise<Blob | null>((r) => canvas.toBlob(r, 'image/jpeg', 0.92));
      canvas.width = canvas.height = 0;
      if (!blob) throw new Error(`Could not render page ${n}`);
      urls.push(URL.createObjectURL(blob));
      onProgress?.(n, doc.numPages);
    }
  } catch (err) {
    urls.forEach((u) => URL.revokeObjectURL(u));
    throw err;
  }
  await printImages(urls, title);
}
