// Copies pdf.js's runtime files into public/pdfjs/ so the document viewer can
// load them from the app's own origin: the worker, the WebAssembly image
// decoders (JBIG2 and JPEG 2000, common in scanned PDFs), standard fonts,
// character maps and colour profiles. Runs before `dev` and `build`, so the
// copy always matches the installed pdfjs-dist. public/pdfjs/ is git-ignored.
import { cpSync, mkdirSync, rmSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const src = dirname(require.resolve('pdfjs-dist/package.json'));
const out = join(dirname(fileURLToPath(import.meta.url)), '..', 'public', 'pdfjs');

rmSync(out, { recursive: true, force: true });
mkdirSync(out, { recursive: true });
cpSync(join(src, 'build', 'pdf.worker.min.mjs'), join(out, 'pdf.worker.min.mjs'));
for (const dir of ['wasm', 'cmaps', 'standard_fonts', 'iccs']) {
  cpSync(join(src, dir), join(out, dir), { recursive: true });
}
console.log('pdf.js assets copied to public/pdfjs/');
