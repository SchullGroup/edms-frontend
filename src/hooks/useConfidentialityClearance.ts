import { useCallback } from 'react';
import { useStore, cabById } from '@/store/useStore';
import { usePermissions } from '@/hooks/usePermissions';
import { useUser } from '@/apis/hooks/useUsers';
import { useCabinets } from '@/apis/hooks/useCabinets';
import {
  isConfidentialityActionAllowed,
  type ConfidentialityAction,
} from '@/constants/documentLevels';

export interface ClearanceTarget {
  confidentiality: string;
  createdBy?: string | null;
  cabinetId?: string | null;
}

/**
 * `allows(doc, action)`: whether the caller may view, download, export or print
 * a document, by the same rule the backend applies (see
 * `isConfidentialityActionAllowed`). The caller's department comes from
 * `GET /users/:id`, because `/auth/me` doesn't carry it; until that loads, a
 * department-scoped clearance answers "no". That route needs `user:view`, so a
 * custom role with department-scoped clearance but no `user:view` is under-offered
 * here, though the API would allow it. `departmentId` on `/auth/me` (requested
 * from the backend) would fix that.
 *
 * Before live permissions arrive, `usePermissions` approximates grants from the
 * role names without scopes. A grant held with no known scope counts as global
 * here, so buttons don't flicker off on first render. The backend still decides.
 */
export function useConfidentialityClearance() {
  const { can, scopeFor } = usePermissions();
  const meId = useStore((s) => s.currentUser?.id) ?? null;
  const { data: me } = useUser(meId ?? '');
  const { data: cabinetsData } = useCabinets();
  const cabinets = cabinetsData?.data;
  const departmentId = me?.departmentId ?? null;

  const allows = useCallback(
    (doc: ClearanceTarget, action: ConfidentialityAction) =>
      isConfidentialityActionAllowed(
        {
          confidentiality: doc.confidentiality,
          createdBy: doc.createdBy,
          cabinetDepartmentId:
            (doc.cabinetId && cabById(cabinets ?? [], doc.cabinetId)?.departmentId) || null,
        },
        action,
        {
          scopeFor: (r, a) => scopeFor(r, a) ?? (can(r, a) ? 'global' : null),
          userId: meId,
          departmentId,
        },
      ),
    [can, scopeFor, cabinets, meId, departmentId],
  );

  return { allows };
}
