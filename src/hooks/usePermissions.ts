import { useStore } from '@/store/useStore';
import { useMemo } from 'react';

export const usePermissions = () => {
  const { currentUser } = useStore();

  const hasPermission = (resource: string, action: string): boolean => {
    if (!currentUser) return false;

    // 1. If backend provided granular permissions, use them
    if (currentUser.permissions && currentUser.permissions.length > 0) {
      return currentUser.permissions.some((p) => {
        if (typeof p === 'string') {
          return p === `${resource}:${action}` || p === `${resource}:*` || p === `*:*`;
        }
        return p.resource === resource && p.action === action;
      });
    }

    // 2. Fallback: Role-based heuristics (Mocking for now until backend matrix is ready)
    const roles = currentUser.roles || [];

    // System Admins have super access
    if (roles.includes('schulltech_admin')) return true;

    // Client Admins have all client-side permissions
    if (roles.includes('client_admin')) {
      // Except platform-level stuff
      if (resource === 'platform') return false;

      return true;
    }

    // Role-specific mocks
    if (roles.includes('internal_auditor')) {
      if (resource === 'audit' && action === 'view') return true;
      if (resource === 'finding') return true;
      if (resource === 'document' && action === 'view') return true;
      return false; // Auditors shouldn't mutate data
    }

    if (roles.includes('supervisor') || roles.includes('management')) {
      if (resource === 'document' && ['view', 'approve', 'reject', 'route'].includes(action))
        return true;
      if (resource === 'dashboard' && action === 'view') return true;
    }

    if (roles.includes('staff')) {
      if (resource === 'document' && ['view', 'create', 'edit', 'route'].includes(action))
        return true;
      if (resource === 'dashboard' && action === 'view') return true;
    }

    return false;
  };

  return { hasPermission };
};
