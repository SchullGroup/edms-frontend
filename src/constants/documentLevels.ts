import type {
  DocumentAccessKind,
  DocumentConfidentiality as Confidentiality,
  DocumentUrgency as Urgency,
} from '@/types/models';

/** How each kind of access request reads to users. `route` is Action access:
 *  acting on a document in a workflow without being able to open it. */
export const ACCESS_KIND_LABEL: Record<DocumentAccessKind, string> = {
  view: 'Open the document',
  route: 'Act on this document',
};

/** The levels a document can be filed or reclassified at. `top_secret` is left
 *  out: no seeded role holds `document:view_top_secret`, so nobody could open
 *  the result. The classification dialog adds it for a caller who is cleared. */
export const CONF_LEVELS: { label: string; value: Confidentiality }[] = [
  { label: 'Public', value: 'public' },
  { label: 'Internal', value: 'internal' },
  { label: 'Confidential', value: 'confidential' },
  { label: 'Restricted', value: 'restricted' },
];

export const TOP_SECRET_LEVEL: { label: string; value: Confidentiality } = {
  label: 'Top Secret',
  value: 'top_secret',
};

export const URG_LEVELS: { label: string; value: Urgency }[] = [
  { label: 'Critical', value: 'critical' },
  { label: 'High', value: 'high' },
  { label: 'Normal', value: 'normal' },
  { label: 'Low', value: 'low' },
];

// --- Confidentiality clearance ------------------------------------------------
// Mirrors edms-backend `isConfidentialityActionAllowed` (access-control.constants.ts, `f3ebfb4`):
// tier clearance and each action's own permission must both be held at a scope covering the doc.

export type ConfidentialityAction = 'view' | 'download' | 'download_original' | 'export' | 'print';

const TIER_CLEARANCE_ACTION: Partial<Record<Confidentiality, string>> = {
  confidential: 'view_confidential',
  restricted: 'view_restricted',
  top_secret: 'view_top_secret',
};

const ACTION_PERMISSION: Partial<Record<ConfidentialityAction, string>> = {
  download: 'download',
  download_original: 'download_original',
  export: 'export',
  print: 'print',
};

export interface ClearanceSubject {
  /** Most permissive scope held for `document:<action>`, or null if not held. */
  scopeFor: (resource: string, action: string) => 'global' | 'department' | 'own' | null;
  userId: string | null;
  departmentId: string | null;
}

export interface ClearanceDocument {
  confidentiality: string;
  createdBy?: string | null;
  /** The department of the document's cabinet; null for a general cabinet. */
  cabinetDepartmentId?: string | null;
}

/** Whether the caller may `action` a document. The backend is the real check;
 *  this decides what the UI offers. */
export function isConfidentialityActionAllowed(
  doc: ClearanceDocument,
  action: ConfidentialityAction,
  subject: ClearanceSubject,
): boolean {
  const clearance = TIER_CLEARANCE_ACTION[doc.confidentiality as Confidentiality];
  if (clearance && !coversDocument(subject.scopeFor('document', clearance), doc, subject)) {
    return false;
  }
  const permission = ACTION_PERMISSION[action];
  return !permission || coversDocument(subject.scopeFor('document', permission), doc, subject);
}

/** Whether a held scope reaches this document: any at global, its cabinet's department, or own uploads. */
function coversDocument(
  scope: ReturnType<ClearanceSubject['scopeFor']>,
  doc: ClearanceDocument,
  subject: ClearanceSubject,
): boolean {
  if (scope === 'global') return true;
  if (scope === 'department') {
    return subject.departmentId !== null && doc.cabinetDepartmentId === subject.departmentId;
  }
  return scope === 'own' && doc.createdBy === subject.userId;
}
