'use client';

import React, { useEffect } from 'react';
import { useUIStore } from '@/store/useUIStore';

export const UIProviders = () => {
  const { toasts, removeToast, modal, closeModal, drawer, closeDrawer } = useUIStore();
  const [loadingActionIdx, setLoadingActionIdx] = React.useState<number | null>(null);
  const isBusy = loadingActionIdx !== null;

  // A newly opened modal is never mid-request.
  useEffect(() => {
    setLoadingActionIdx(null);
  }, [modal]);

  useEffect(() => {
    const esc = (e: KeyboardEvent) => {
      if (isBusy) return;
      if (e.key === 'Escape') {
        if (drawer) closeDrawer();
        else if (modal) closeModal();
      }
    };
    document.addEventListener('keydown', esc);
    return () => document.removeEventListener('keydown', esc);
  }, [modal, closeModal, drawer, closeDrawer, isBusy]);

  return (
    <>
      <div id="toast-root">
        {toasts.map((t) => {
          const icons = { success: '✓', error: '✕', info: 'i', warning: '!' };
          return (
            <div key={t.id} className={`toast ${t.kind}`} role="status">
              <span className="t-ico">{icons[t.kind] || '✓'}</span>
              <span>{t.message}</span>
              <button className="t-close" aria-label="Dismiss" onClick={() => removeToast(t.id)}>
                ×
              </button>
            </div>
          );
        })}
      </div>

      <div id="modal-root">
        {modal && (
          <div
            className="modal-backdrop"
            onClick={(e) => {
              if (isBusy) return;
              if (e.target === e.currentTarget) closeModal();
            }}
          >
            <div
              className={`modal ${modal.size || ''}`}
              role="dialog"
              aria-modal="true"
              aria-label={modal.title}
            >
              <div className="modal-head">
                <span className="h2">{modal.title}</span>
                <button
                  className="modal-close"
                  aria-label="Close"
                  onClick={closeModal}
                  disabled={isBusy}
                >
                  ×
                </button>
              </div>
              <div className="modal-body">{modal.body}</div>
              {modal.actions && modal.actions.length > 0 && (
                <div className="modal-foot">
                  {modal.actions.map((a, i) => (
                    <button
                      key={i}
                      className={`btn ${a.kind || 'btn-secondary'}`}
                      disabled={a.disabled || isBusy}
                      onClick={async () => {
                        const result = a.onClick ? a.onClick() : true;
                        const isPromise = !!result && typeof (result as any).then === 'function';
                        if (!isPromise) {
                          if (result !== false) closeModal();
                          return;
                        }
                        setLoadingActionIdx(i);
                        try {
                          const resolved = await result;
                          setLoadingActionIdx(null);
                          if (resolved !== false) closeModal();
                        } catch {
                          // Error toast is expected to come from the caller's mutation.
                          // Keep the modal open so the user can see it and retry.
                          setLoadingActionIdx(null);
                        }
                      }}
                    >
                      {loadingActionIdx === i ? (
                        <span className="btn-spinner" aria-hidden="true" />
                      ) : (
                        a.label
                      )}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {drawer && (
          <>
            <div className="drawer-backdrop" onClick={closeDrawer} />
            <div className="drawer" role="dialog" aria-label={drawer.title}>
              <div className="drawer-head">
                <span className="h2">{drawer.title}</span>
                <button className="modal-close" aria-label="Close" onClick={closeDrawer}>
                  ×
                </button>
              </div>
              <div className="drawer-body">{drawer.body}</div>
              {drawer.foot && <div className="modal-foot">{drawer.foot}</div>}
            </div>
          </>
        )}
      </div>
    </>
  );
};
