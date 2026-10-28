'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useQueryClient } from '@tanstack/react-query';
import { useUIStore } from '@/store/useUIStore';
import { Icon } from '@/components/ui/Icons';
import { performLogout } from '@/lib/logout';

/** After this many failed "Try again" presses, the dialog offers signing in again instead. */
const MAX_RETRIES = 3;

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
  // Mounted only while shown, so the retry count starts over each time it reappears.
  return serviceUnavailable ? <ServiceUnavailableDialog /> : null;
}

function ServiceUnavailableDialog() {
  const queryClient = useQueryClient();
  const router = useRouter();
  const [retrying, setRetrying] = useState(false);
  const [failedRetries, setFailedRetries] = useState(0);
  const outOfRetries = failedRetries >= MAX_RETRIES;

  const handleRetry = async () => {
    setRetrying(true);
    try {
      await queryClient.refetchQueries({ type: 'active' });
    } finally {
      setRetrying(false);
      // A success clears the flag and unmounts this dialog, so a count here means it failed.
      setFailedRetries((n) => n + 1);
    }
  };

  const handleSignIn = () => {
    useUIStore.getState().setServiceUnavailable(false);
    performLogout(queryClient, router);
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
          {outOfRetries ? (
            <p className="muted" aria-live="polite">
              We still can't reach our systems. Sign in again to start a fresh session. If that
              doesn't work, wait a few minutes or contact your administrator.
            </p>
          ) : (
            <p className="muted">
              Our systems are temporarily unavailable. This usually resolves within a few
              minutes — your work isn't lost, and this page will pick back up automatically once
              we're back.
            </p>
          )}
        </div>
        <div className="modal-foot" style={{ justifyContent: 'center' }}>
          {outOfRetries ? (
            <button className="btn btn-primary" onClick={handleSignIn}>
              Sign in again
            </button>
          ) : (
            <button className="btn btn-primary" onClick={handleRetry} disabled={retrying}>
              {retrying ? 'Checking…' : 'Try again'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
