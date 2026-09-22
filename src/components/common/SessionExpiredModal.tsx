'use client';

import React, { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useQueryClient } from '@tanstack/react-query';
import { useUIStore } from '@/store/useUIStore';
import { performLogout } from '@/lib/logout';

/**
 * A live backend explicitly rejected the refresh token (see `api-client.ts`'s
 * response interceptor) — the session is confirmed over, not just
 * unreachable. Unlike the app's generic modal (`UIProviders`), there is
 * deliberately no way to dismiss this one without logging out: closing it,
 * pressing Escape, or clicking the backdrop all do the same full teardown as
 * the "Sign in again" button. A session that's actually dead has nothing
 * sensible to fall back to by closing the dialog.
 */
export function SessionExpiredModal() {
  const sessionExpired = useUIStore((s) => s.sessionExpired);
  const router = useRouter();
  const queryClient = useQueryClient();

  const handleLogout = () => {
    useUIStore.getState().setSessionExpired(false);
    performLogout(queryClient, router);
  };

  useEffect(() => {
    if (!sessionExpired) return;
    const esc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') handleLogout();
    };
    document.addEventListener('keydown', esc);
    return () => document.removeEventListener('keydown', esc);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionExpired]);

  if (!sessionExpired) return null;

  return (
    <div
      className="modal-backdrop"
      onClick={(e) => {
        if (e.target === e.currentTarget) handleLogout();
      }}
    >
      <div className="modal" role="dialog" aria-modal="true" aria-label="Session ended">
        <div className="modal-head">
          <span className="h2">Session ended</span>
          <button className="modal-close" aria-label="Close and sign out" onClick={handleLogout}>
            ×
          </button>
        </div>
        <div className="modal-body">
          <p>
            Your session has ended, most likely from being idle for a while. Sign in again to
            keep going — nothing you were working on has been lost server-side.
          </p>
        </div>
        <div className="modal-foot">
          <button className="btn btn-primary" onClick={handleLogout}>
            Sign in again
          </button>
        </div>
      </div>
    </div>
  );
}
