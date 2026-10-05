import type { Document } from '@/types/models';

/**
 * Where to load a document's current file from. The API returns a ready-to-use
 * pre-signed URL on the current version — pass it through untouched (it's
 * already encoded; re-encoding risks breaking the signature). Fall back to
 * `fileKey` only when it's itself an absolute URL, which happens with
 * seed/fixture data.
 */
export function documentFile(doc: Pick<Document, 'currentVersion'>) {
  const rawFileKey = doc.currentVersion?.fileKey;
  const signedFileUrl = doc.currentVersion?.fileUrl?.trim() || undefined;
  const fileKeyIsUrl = !!rawFileKey && /^https?:\/\//i.test(rawFileKey);
  const fileUrl = signedFileUrl ?? (fileKeyIsUrl ? encodeURI(rawFileKey as string) : undefined);
  return { rawFileKey, fileUrl, fileMimeType: doc.currentVersion?.mimeType || '' };
}
