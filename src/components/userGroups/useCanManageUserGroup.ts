import { usePermissions } from '@/hooks/usePermissions';
import { useStore } from '@/store/useStore';
import type { UserGroup } from '@/types/models';

/** `workflow:create` at global scope, or below it only on groups the caller created. */
export function useCanManageUserGroup(group?: Pick<UserGroup, 'createdBy'> | null): boolean {
  const { scopeFor } = usePermissions();
  const { currentUser } = useStore();
  const scope = scopeFor('workflow', 'create');
  if (!scope || !group) return false;
  return scope === 'global' || group.createdBy === currentUser?.id;
}
