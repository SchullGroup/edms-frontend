import type {
  DocumentConfidentiality as Confidentiality,
  DocumentUrgency as Urgency,
} from '@/types/models';

/** The levels a document can be filed or reclassified at. `top_secret` is left
 *  out: no tenant role is cleared to view it, so nobody could open the result. */
export const CONF_LEVELS: { label: string; value: Confidentiality }[] = [
  { label: 'Public', value: 'public' },
  { label: 'Internal', value: 'internal' },
  { label: 'Confidential', value: 'confidential' },
  { label: 'Restricted', value: 'restricted' },
];

export const URG_LEVELS: { label: string; value: Urgency }[] = [
  { label: 'Critical', value: 'critical' },
  { label: 'High', value: 'high' },
  { label: 'Normal', value: 'normal' },
  { label: 'Low', value: 'low' },
];

// Who may view each tier above `internal` — mirrors `CONFIDENTIAL_TIER_ROLES` /
// `RESTRICTED_TIER_ROLES` / `TOP_SECRET_TIER_ROLES` in edms-backend
// `src/shared/constants/access.constants.ts`. `public` and `internal` are open to all.
const VIEW_ROLES: Partial<Record<Confidentiality, readonly string[]>> = {
  confidential: ['supervisor', 'management', 'client_admin', 'internal_auditor'],
  restricted: ['client_admin'],
  top_secret: [],
};

/** Whether someone holding `roles` can still open a document at `level`. */
export function canViewConfidentiality(roles: readonly string[], level: Confidentiality): boolean {
  const allowed = VIEW_ROLES[level];
  return !allowed || roles.some((r) => allowed.includes(r));
}
