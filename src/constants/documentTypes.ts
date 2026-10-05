/**
 * The document types users can pick on upload, and filter by in search.
 *
 * The backend stores `documentType` as free text, so this list is the app's
 * own vocabulary — Upload writes these values and Search filters on them, so
 * both must read from here. Replace with a per-cabinet API (tracker 5.3) once
 * the backend has one.
 */
export const DOCUMENT_TYPES = [
  'Invoice',
  'Contract',
  'Memo',
  'Policy',
  'Report',
  'Purchase Order',
  'Letter',
  'Incident Report',
] as const;
