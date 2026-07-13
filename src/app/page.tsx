'use client';

import React, { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useStore, userById } from '@/store/useStore';
import { useUIStore } from '@/store/useUIStore';
import { Avatar } from '@/components/ui/Avatar';
import { Icon } from '@/components/ui/Icons';

export default function LoginPage() {
  const router = useRouter();
  const { session, setSession, users } = useStore();
  const { addToast } = useUIStore();

  useEffect(() => {
    if (session) {
      const me = userById(users, session);
      if (me) {
        const homeMap: Record<string, string> = {
          staff: '/staff',
          supervisor: '/supervisor',
          management: '/management',
          clientadmin: '/admin',
          platform: '/platform',
          auditor: '/auditor',
        };
        router.push(homeMap[me.role] || '/');
      }
    }
  }, [session, router, users]);

  const personas = [
    { id: 'u-chika', blurb: 'Dense queues, fast actions & search' },
    { id: 'u-david', blurb: 'Team visibility, reassignment, approvals' },
    { id: 'u-eniola', blurb: 'Org KPIs, trends, drill-down, exports' },
    { id: 'u-bola', blurb: 'Cabinets, workflows, policies, branding' },
    { id: 'u-adaeze', blurb: 'Tenants, plans, billing, platform health' },
    { id: 'u-femi', blurb: 'Immutable trails, sampling, findings' },
  ];

  const signIn = (uid: string) => {
    setSession(uid);
    const u = userById(users, uid);
    if (u) {
      addToast(`Welcome back, ${u.name.split(' ')[0]}`, 'success');
      // The useEffect will handle redirecting once session is set
    }
  };

  // If already session, we return null to avoid flash while redirecting
  if (session) return null;

  return (
    <div className="login-wrap">
      <div className="login-hero">
        <div style={{ position: 'relative', zIndex: 1 }}>
          <div className="flex aic g12">
            <div
              className="brand-logo"
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
              <div style={{ fontWeight: 800, fontSize: '16px' }}>SchullTech EDMS</div>
              <div
                style={{
                  fontSize: '11px',
                  opacity: 0.6,
                  letterSpacing: '.08em',
                  textTransform: 'uppercase',
                }}
              >
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
          <div className="hero-points">
            {[
              'Trust & accountability — every action tracked and auditable',
              'Speed for the daily user — instant queues and search',
              'Confidence for the occasional user — self-explanatory dashboards',
              'Configurability without chaos — validated admin designers',
            ].map((t, idx) => (
              <div key={idx}>
                <span className="pt">
                  <Icon name="check" size={14} />
                </span>
                {t}
              </div>
            ))}
          </div>
        </div>
        <div style={{ fontSize: '11px', opacity: 0.55 }}>
          © 2026 Schull Technologies Ltd · Confidential — Internal & Client Stakeholders
        </div>
      </div>
      <div className="login-panel">
        <div className="login-card">
          <div className="page-title" style={{ marginBottom: '4px' }}>
            Sign in
          </div>
          <p className="page-sub" style={{ marginBottom: '20px' }}>
            Role-based demo — pick a persona to enter their portal.
          </p>
          {personas.map((p) => {
            const u = userById(users, p.id);
            if (!u) return null;
            return (
              <button key={p.id} className="persona-btn" onClick={() => signIn(p.id)}>
                <Avatar user={u} />
                <span>
                  <div className="pn">
                    {u.name} — {u.roleLabel}
                  </div>
                  <div className="pr">{p.blurb}</div>
                </span>
                <span className="arrow">
                  <Icon name="chevR" size={16} />
                </span>
              </button>
            );
          })}
          <div className="caption" style={{ marginTop: '14px', lineHeight: 1.5 }}>
            Single sign-on (SSO), MFA and step-up authentication are enforced in production. This
            demo signs you straight in.
          </div>
        </div>
      </div>
    </div>
  );
}
