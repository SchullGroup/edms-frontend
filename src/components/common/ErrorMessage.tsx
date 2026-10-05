import { AlertOctagon } from 'lucide-react';

interface ErrorMessageProps {
  message?: string;
  retry?: () => void;
}

export const ErrorMessage = ({ message = 'Failed to load data.', retry }: ErrorMessageProps) => {
  return (
    <div className="empty-state p-8">
      <AlertOctagon className="w-20 h-20" />
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
