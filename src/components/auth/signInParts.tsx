'use client';

import React from 'react';

/** `t***@domain`, like the backend's `emailMasked`. */
export const maskEmail = (email: string) => {
  const [name, domain] = email.trim().split('@');
  return domain ? `${name.slice(0, 1)}***@${domain}` : email;
};

export const formatSeconds = (s: number) =>
  `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;

const svgProps = {
  width: 26,
  height: 26,
  viewBox: '0 0 24 24',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 1.8,
  strokeLinecap: 'round' as const,
  strokeLinejoin: 'round' as const,
  'aria-hidden': true,
};

export const STEP_ICON = {
  email: (
    <svg {...svgProps}>
      <rect x="3" y="5" width="18" height="14" rx="2.5" />
      <path d="M3.5 6.5l8.5 6.5 8.5-6.5" />
    </svg>
  ),
  authenticator: (
    <svg {...svgProps}>
      <path d="M12 3l7 3v5c0 4.5-3 8.2-7 10-4-1.8-7-5.5-7-10V6l7-3z" />
      <path d="M9 12l2 2 4-4" />
    </svg>
  ),
  recovery: (
    <svg {...svgProps}>
      <circle cx="8" cy="15" r="4" />
      <path d="M11 12l9-9" />
      <path d="M17 6l3 3" />
    </svg>
  ),
  expired: (
    <svg {...svgProps}>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7v5l3 2" />
    </svg>
  ),
  setup: (
    <svg {...svgProps}>
      <rect x="5" y="11" width="14" height="10" rx="2" />
      <path d="M8 11V8a4 4 0 018 0v3" />
      <path d="M12 15v2" />
    </svg>
  ),
};

export function BackToSignIn({ onClick, label = 'Back to sign in' }: { onClick: () => void; label?: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="text-btn mb-5 inline-flex items-center gap-1.5 self-start text-[13px] font-medium text-(--side-ink) hover:text-(--ink)"
    >
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
        <path d="M15 18l-6-6 6-6" />
      </svg>
      {label}
    </button>
  );
}

/** The card shown when a sign-in token has run out: the password is needed again. */
export function TimedOutCard({ message, onStartAgain }: { message: string; onStartAgain: () => void }) {
  return (
    <div className="flex flex-col">
      <div className="mfa-card">
        <div className="mfa-icon">{STEP_ICON.expired}</div>
        <h2 className="mt-4 text-[24px] font-bold tracking-[-0.01em]">Sign-in timed out</h2>
        <p className="mt-2 text-sm text-muted">{message}</p>
        <button className="btn btn-primary mt-6 h-12 w-full justify-center" onClick={onStartAgain}>
          Back to sign in
        </button>
      </div>
    </div>
  );
}
