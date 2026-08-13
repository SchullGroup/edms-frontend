import React from 'react';

interface ErrorMessageProps {
  message?: string;
  retry?: () => void;
}

export const ErrorMessage = ({ message = 'Failed to load data.', retry }: ErrorMessageProps) => {
  return (
    <div className="empty-state">
      <div className="icon warning" style={{ marginBottom: '16px' }}>
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
          <line x1="12" y1="9" x2="12" y2="13" />
          <line x1="12" y1="17" x2="12.01" y2="17" />
        </svg>
      </div>
      <h3 style={{ marginBottom: '8px' }}>Error</h3>
      <p className="text-secondary" style={{ marginBottom: '16px' }}>
        {message}
      </p>
      {retry && (
        <button className="btn btn-secondary" onClick={retry}>
          Try Again
        </button>
      )}
    </div>
  );
};
