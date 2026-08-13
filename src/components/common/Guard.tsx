import React from 'react';
import { usePermissions } from '@/hooks/usePermissions';

interface GuardProps {
  resource: string;
  action: string;
  children: React.ReactNode;
  fallback?: React.ReactNode;
}

export const Guard = ({ resource, action, children, fallback = null }: GuardProps) => {
  const { hasPermission } = usePermissions();

  if (hasPermission(resource, action)) {
    return <>{children}</>;
  }

  return <>{fallback}</>;
};
