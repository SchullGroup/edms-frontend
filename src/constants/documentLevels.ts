import type {
  DocumentConfidentiality as Confidentiality,
  DocumentUrgency as Urgency,
} from '@/types/models';

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
// Mirrors `isConfidentialityActionAllowed` in edms-backend
// `src/shared/constants/access-control.constants.ts` (`0dab81a`). Viewing a tier
// above `internal` needs that tier's `document:view_*` permission, and its scope
// narrows which documents it covers. Download, export and print each also need
// their own `document:*` permission, whatever the tier.

export type ConfidentialityAction = 'view' | 'download' | 'export' | 'print';

const TIER_CLEARANCE_ACTION: Partial<Record<Confidentiality, string>> = {
  confidential: 'view_confidential',
  restricted: 'view_restricted',
  top_secret: 'view_top_secret',
};

const ACTION_PERMISSION: Partial<Record<ConfidentialityAction, string>> = {
  download: 'download',
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
  if (clearance) {
    const scope = subject.scopeFor('document', clearance);
    if (!scope) return false;
    if (
      scope === 'department' &&
      (subject.departmentId === null || doc.cabinetDepartmentId !== subject.departmentId)
    ) {
      return false;
    }
    if (scope === 'own' && doc.createdBy !== subject.userId) return false;
  }
  const permission = ACTION_PERMISSION[action];
  return !permission || subject.scopeFor('document', permission) !== null;
}
