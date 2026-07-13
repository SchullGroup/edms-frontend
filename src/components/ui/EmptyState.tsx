import React from 'react';
import { Icon } from './Icons';

interface EmptyStateProps {
  icon: string;
  title: string;
  message: string;
  action?: React.ReactNode;
}

export const EmptyState = ({ icon, title, message, action }: EmptyStateProps) => {
  return (
    <div className="empty">
      <div className="e-ico">
        <Icon name={icon} size={26} />
      </div>
      <div className="e-title">{title}</div>
      <div style={{ fontSize: '12.5px', maxWidth: '340px', margin: '0 auto', lineHeight: '1.55' }}>
        {message}
      </div>
      {action && <div className="mt16">{action}</div>}
    </div>
  );
};
