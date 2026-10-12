/**
 * What can be uploaded as a document (Upload page, "New version", the workflow
 * review picker). One list, so the uploader's check, each file input's
 * `accept` and the help text can't disagree. The backend accepts any
 * `mimeType`; this is the app's own policy.
 */
export const UPLOAD_TYPES = [
  { mime: 'application/pdf', extensions: ['pdf'] },
  {
    mime: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    extensions: ['docx'],
  },
  {
    mime: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    extensions: ['xlsx'],
  },
  { mime: 'image/tiff', extensions: ['tif', 'tiff'] },
  { mime: 'image/jpeg', extensions: ['jpg', 'jpeg'] },
  { mime: 'image/png', extensions: ['png'] },
] as const;

/** What to call a file of this MIME type in a sentence: "Word documents". */
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

export const MAX_UPLOAD_BYTES = 100 * 1024 * 1024;

export const UPLOAD_TYPES_LABEL = 'PDF, DOCX, XLSX, TIFF, JPG or PNG up to 100 MB';

/** For `<input type="file" accept>` — MIME types plus extensions, since some
 *  systems report no MIME type for Office files. */
export const UPLOAD_ACCEPT = UPLOAD_TYPES.flatMap((t) => [
  t.mime,
  ...t.extensions.map((e) => `.${e}`),
]).join(',');

/**
 * The file's MIME type, falling back to its extension when the browser
 * reports none (common for .docx/.xlsx on Windows without Office installed).
 * `undefined` when it isn't an allowed type.
 */
export function resolveUploadMimeType(file: File): string | undefined {
  const byMime = UPLOAD_TYPES.find((t) => t.mime === file.type);
  if (byMime) return byMime.mime;
  const ext = file.name.split('.').pop()?.toLowerCase() ?? '';
  return UPLOAD_TYPES.find((t) => (t.extensions as readonly string[]).includes(ext))?.mime;
}

/** Why this file can't be uploaded, or `null` when it can. */
export function validateUploadFile(file: File): string | null {
  if (!resolveUploadMimeType(file)) return `Unsupported file type — use ${UPLOAD_TYPES_LABEL}`;
  if (file.size > MAX_UPLOAD_BYTES) return 'File size must be 100 MB or less';
  return null;
}
