import React from 'react';

/**
 * Shared split-screen shell for every pre-auth screen (login, forgot
 * password, reset password) — same branded hero on the left, a centred card
 * slot on the right. Only the card's contents differ per screen.
 */
export function AuthShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="login-wrap">
      <div className="login-hero">
        <div className="relative z-10">
          <div className="flex items-center gap-3">
            <div
              className="brand-logo flex items-center justify-center text-white"
              style={{
                width: '42px',
                height: '42px',
                fontSize: '20px',
                borderRadius: '12px',
                background: 'linear-gradient(135deg,#8B7CFF,#6A5AE8)',
                boxShadow: '0 4px 18px rgba(139,124,255,.4)',
              }}
            >
              S
            </div>
            <div>
              <div className="text-[16px] font-extrabold">SchullTech EDMS</div>
              <div className="text-[11px] uppercase tracking-[.08em] opacity-60">
                Electronic Document Management
              </div>
            </div>
          </div>
          <div className="hero-badge">✦ EDMS SaaS Platform · v1.0</div>
          <h1>A system of record for regulated, high-stakes work.</h1>
          <p>
            Capture, classify, route, sign, redact and audit every document — with white-label
            theming, role-based portals and SLA-driven workflows.
          </p>
        </div>
        <div className="text-[11px] opacity-55">
          © 2026 Schull Technologies Ltd · Confidential — Internal & Client Stakeholders
        </div>
      </div>

      <div className="login-panel flex flex-col items-center justify-center">
        <div className="login-card w-full max-w-[400px]">{children}</div>
      </div>
    </div>
  );
}
