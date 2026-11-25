export type PdfJs = typeof import('pdfjs-dist');

let pdfjsPromise: Promise<PdfJs> | null = null;

/** pdf.js touches browser globals when imported, so it loads on the client, once. */
export function loadPdfJs(): Promise<PdfJs> {
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

// Served from the app's own origin, copied by scripts/copy-pdfjs-assets.mjs. The
// WebAssembly decoders handle the JBIG2 and JPEG 2000 images common in scans.
export const PDFJS_ASSETS = {
  cMapUrl: '/pdfjs/cmaps/',
  cMapPacked: true,
  standardFontDataUrl: '/pdfjs/standard_fonts/',
  wasmUrl: '/pdfjs/wasm/',
  iccUrl: '/pdfjs/iccs/',
};
