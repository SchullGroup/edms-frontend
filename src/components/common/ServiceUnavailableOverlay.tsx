'use client';

import React, { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useUIStore } from '@/store/useUIStore';
import { Icon } from '@/components/ui/Icons';

/**
 * Shown when several queries in a row fail at the infrastructure level
 * (network error or 5xx — see `react-query-provider.tsx`'s `QueryCache`),
 * rather than leaving the user staring at a dashboard full of individually
 * broken widgets. Full-screen and non-navigable on purpose: if the backend
 * is actually down, no page behind this would work either.
 *
 * Auto-clears itself the moment any query succeeds again (also wired in
 * `react-query-provider.tsx`) — "Try again" just gives the user a way to
 * force that check now instead of waiting for the next background refetch.
 */
export function ServiceUnavailableOverlay() {
  const serviceUnavailable = useUIStore((s) => s.serviceUnavailable);
  const queryClient = useQueryClient();
  const [retrying, setRetrying] = useState(false);

  if (!serviceUnavailable) return null;

  const handleRetry = async () => {
    setRetrying(true);
    try {
      await queryClient.refetchQueries({ type: 'active' });
    } finally {
      setRetrying(false);
    }
  };

  return (
    <div className="modal-backdrop" style={{ zIndex: 9999 }}>
      <div
        className="modal"
        role="alertdialog"
        aria-modal="true"
        aria-label="Service temporarily unavailable"
        style={{ textAlign: 'center' }}
      >
        <div className="modal-body" style={{ padding: '32px 24px 8px' }}>
          <div style={{ marginBottom: '12px' }}>
            <Icon name="alert" size={32} />
          </div>
          <div className="h2" style={{ marginBottom: '8px' }}>
            We're having trouble connecting
          </div>
          <p className="muted">
            Our systems are temporarily unavailable. This usually resolves within a few
            minutes — your work isn't lost, and this page will pick back up automatically once
            we're back.
          </p>
        </div>
        <div className="modal-foot" style={{ justifyContent: 'center' }}>
          <button className="btn btn-primary" onClick={handleRetry} disabled={retrying}>
            {retrying ? 'Checking…' : 'Try again'}
          </button>
        </div>
      </div>
    </div>
  );
}
