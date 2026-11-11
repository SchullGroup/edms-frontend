import axios from 'axios';
import { apiClient } from '@/lib/api-client';

/** `GET /files/:token?action=`. preview/download are watermarked; original needs `document:download_original`. */
export type FileAction = 'preview' | 'download' | 'original';

const WATERMARKABLE_TYPES = ['application/pdf', 'image/png', 'image/jpeg', 'image/tiff'];

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';
const FILES_PREFIX = `${API_URL.replace(/\/$/, '')}/api/v1/files/`;

/** Only the API's own file links get the session token; a fixture URL elsewhere must not. */
function isApiFileLink(url: string) {
  return url.startsWith(FILES_PREFIX);
}

function baseType(mimeType: string) {
  return mimeType.split(';')[0].trim().toLowerCase();
}

/** PDFs and PNG/JPEG/TIFF images. Any other file 415s on preview and download: original only. */
export function isWatermarkable(mimeType: string): boolean {
  return WATERMARKABLE_TYPES.includes(baseType(mimeType));
}

/** Download works when the backend issued this viewer a `downloadUrl` and the type can be watermarked. */
export function canDownloadVersion(
  version?: { downloadUrl?: string | null; mimeType: string } | null,
) {
  return !!version?.downloadUrl && isWatermarkable(version.mimeType);
}

export class FileFetchError extends Error {
  constructor(
    message: string,
    readonly status?: number,
  ) {
    super(message);
    this.name = 'FileFetchError';
  }
}

/** The API's JSON error arrives as a Blob when `responseType` is blob. */
async function toFileFetchError(err: any): Promise<FileFetchError> {
  const status: number | undefined = err?.response?.status;
  let message = '';
  const data = err?.response?.data;
  if (data instanceof Blob) {
    try {
      message = JSON.parse(await data.text())?.message ?? '';
    } catch {}
  }
  return new FileFetchError(message || err?.message || 'Failed to load the file', status);
}

export const filesService = {
  /** Fetches a file link with the session. No `action` for `downloadUrl`/`originalUrl`: they carry their own. */
  fetch: async (fileUrl: string, action?: FileAction): Promise<Blob> => {
    try {
      if (!isApiFileLink(fileUrl)) {
        const res = await axios.get<Blob>(fileUrl, { responseType: 'blob' });
        return res.data;
      }
      const res = await apiClient.get<Blob>(fileUrl, {
        params: action ? { action } : undefined,
        responseType: 'blob',
        // A GET with no body needs no JSON content type.
        headers: { 'Content-Type': undefined },
      });
      return res.data;
    } catch (err) {
      throw await toFileFetchError(err);
    }
  },

  /** Fetches the file and saves it under `fileName`; an object URL keeps the token out of the address bar. */
  save: async (fileUrl: string, fileName: string, action?: FileAction): Promise<void> => {
    const blob = await filesService.fetch(fileUrl, action);
    const href = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = href;
    a.download = fileName;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(href), 60_000);
  },
};

/** A download name from the title. Watermarking keeps the file's type, so the extension follows it. */
export function downloadFileName(title: string, mimeType: string) {
  const base = title.replace(/[^\w.-]+/g, '_').replace(/^_+|_+$/g, '') || 'document';
  const ext =
    (
      {
        'application/pdf': 'pdf',
        'image/png': 'png',
        'image/jpeg': 'jpg',
        'image/gif': 'gif',
        'image/webp': 'webp',
        'image/tiff': 'tif',
        'application/msword': 'doc',
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'docx',
        'application/vnd.ms-excel': 'xls',
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': 'xlsx',
      } as Record<string, string>
    )[baseType(mimeType)] ?? '';
  return ext && !base.toLowerCase().endsWith(`.${ext}`) ? `${base}.${ext}` : base;
}
