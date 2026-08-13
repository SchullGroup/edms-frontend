import React from 'react';

interface SpinnerProps {
  size?: 'sm' | 'md' | 'lg';
  text?: string;
}

export const Spinner = ({ size = 'md', text = 'Loading...' }: SpinnerProps) => {
  return (
    <div className="empty-state">
      <div className={`spinner spinner-${size}`} style={{ marginBottom: '16px' }}></div>
      {text && <p className="text-secondary">{text}</p>}
    </div>
  );
};
