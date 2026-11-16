'use client';

import React, { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useQueryClient } from '@tanstack/react-query';
import { useUIStore } from '@/store/useUIStore';
import { performLogout } from '@/lib/logout';
import { SESSION_END_COPY } from '@/lib/sessionEnd';

/** The backend confirmed the session is over (`api-client.ts`). Closing it any way signs out:
 *  a dead session has nothing to fall back to. */
export function SessionExpiredModal() {
  const sessionExpired = useUIStore((s) => s.sessionExpired);
  const copy = SESSION_END_COPY[useUIStore((s) => s.sessionEndReason)];
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
      <div className="modal" role="dialog" aria-modal="true" aria-label={copy.title}>
        <div className="modal-head">
          <span className="h2">{copy.title}</span>
          <button className="modal-close" aria-label="Close and sign out" onClick={handleLogout}>
            ×
          </button>
        </div>
        <div className="modal-body">
          <p>{copy.body}</p>
        </div>
        <div className="modal-foot">
          <button className="btn btn-primary" onClick={handleLogout}>
            {copy.action}
          </button>
        </div>
      </div>
    </div>
  );
}
