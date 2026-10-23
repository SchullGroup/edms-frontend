const MB = 1024 * 1024;

/** The one upload allowlist (the backend accepts any `mimeType`). PDF and images only, since
 *  every upload is OCR'd; images cap at 10 MB because Textract's async API does. */

export const UPLOAD_TYPES = [
  { mime: 'application/pdf', extensions: ['pdf'], maxBytes: 100 * MB },
  { mime: 'image/tiff', extensions: ['tif', 'tiff'], maxBytes: 100 * MB },
  { mime: 'image/jpeg', extensions: ['jpg', 'jpeg'], maxBytes: 10 * MB },
  { mime: 'image/png', extensions: ['png'], maxBytes: 10 * MB },
] as const;

/** What to call a file of this MIME type in a sentence: "Word documents". Covers
 *  types no longer accepted, since documents uploaded before still exist. */
export function fileKindLabel(mime: string): string {
  switch (mime) {
    case 'application/vnd.openxmlformats-officedocument.wordprocessingml.document':
      return 'Word documents';
    case 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet':
      return 'Excel spreadsheets';
    case 'image/tiff':
      return 'TIFF images';
    default:
      return 'Files of this type';
  }
}

export const MAX_UPLOAD_BYTES = 100 * MB;

export const UPLOAD_TYPES_LABEL = 'PDF or TIFF up to 100 MB, JPG or PNG up to 10 MB';

/** For `<input type="file" accept>` — MIME types plus extensions, since some
 *  systems report no MIME type for a file. */
export const UPLOAD_ACCEPT = UPLOAD_TYPES.flatMap((t) => [
  t.mime,
  ...t.extensions.map((e) => `.${e}`),
]).join(',');

function uploadTypeOf(file: File) {
  const byMime = UPLOAD_TYPES.find((t) => t.mime === file.type);
  if (byMime) return byMime;
  const ext = file.name.split('.').pop()?.toLowerCase() ?? '';
  return UPLOAD_TYPES.find((t) => (t.extensions as readonly string[]).includes(ext));
}

/** The file's MIME type, falling back to its extension when the browser reports none.
 *  `undefined` when it isn't an allowed type. */
export function resolveUploadMimeType(file: File): string | undefined {
  return uploadTypeOf(file)?.mime;
}

/** Why this file can't be uploaded, or `null` when it can. */
export function validateUploadFile(file: File): string | null {
  const type = uploadTypeOf(file);
  if (!type) return `Unsupported file type — use ${UPLOAD_TYPES_LABEL}`;
  if (file.size > type.maxBytes) {
    return `${type.extensions[0].toUpperCase()} files must be ${type.maxBytes / MB} MB or less`;
  }
  return null;
}
