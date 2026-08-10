'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useStore } from '@/store/useStore';
import { useUIStore } from '@/store/useUIStore';
import { authService } from '@/services/auth.service';
import { Icon } from '@/components/ui/Icons';
import { useMutation } from '@tanstack/react-query';

export default function LoginPage() {
  const router = useRouter();
  const { currentUser, setCurrentUser } = useStore();
  const { addToast } = useUIStore();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  // Redirect if already logged in
  useEffect(() => {
    if (currentUser) {
      const homeMap: Record<string, string> = {
        staff: '/staff',
        supervisor: '/supervisor',
        management: '/management',
        client_admin: '/admin',
        schulltech_admin: '/platform',
        internal_auditor: '/auditor',
      };

      // We look at the first role if they have multiple
      const roleStr =
        currentUser.roles && currentUser.roles.length > 0
          ? typeof currentUser.roles[0] === 'string'
            ? currentUser.roles[0]
            : (currentUser.roles[0] as any).name
          : 'staff';
      router.push(homeMap[roleStr] || '/');
    }
  }, [currentUser, router]);

  const loginMutation = useMutation({
    mutationFn: async () => {
      return authService.login({ email, password });
    },
    onSuccess: (data) => {
      setCurrentUser(data.user);
      addToast(`Welcome back, ${data.user.name.split(' ')[0]}`, 'success');
    },
    onError: (err: any) => {
      addToast(err.response?.data?.message || 'Login failed. Check your credentials.', 'error');
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) {
      addToast('Please enter both email and password', 'error');
      return;
    }
    loginMutation.mutate();
  };

  const autofill = (testEmail: string) => {
    setEmail(testEmail);
    setPassword('password');
  };

  if (currentUser) return null;

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
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#fff',
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
        </div>
        <div style={{ fontSize: '11px', opacity: 0.55 }}>
          © 2026 Schull Technologies Ltd · Confidential — Internal & Client Stakeholders
        </div>
      </div>

      <div
        className="login-panel"
        style={{
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center',
          alignItems: 'center',
        }}
      >
        <div className="login-card" style={{ width: '100%', maxWidth: '400px' }}>
          <div className="page-title" style={{ marginBottom: '4px' }}>
            Sign in
          </div>
          <p className="page-sub" style={{ marginBottom: '24px' }}>
            Enter your credentials to access your secure portal.
          </p>

          <form
            onSubmit={handleSubmit}
            style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}
          >
            <div>
              <label
                style={{ display: 'block', marginBottom: '8px', fontSize: '13px', fontWeight: 500 }}
              >
                Email Address
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="input-field"
                style={{
                  width: '100%',
                  padding: '10px 14px',
                  borderRadius: '8px',
                  border: '1px solid var(--border)',
                  background: 'var(--surface)',
                }}
                placeholder="you@company.com"
                required
              />
            </div>

            <div>
              <label
                style={{ display: 'block', marginBottom: '8px', fontSize: '13px', fontWeight: 500 }}
              >
                Password
              </label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="input-field"
                style={{
                  width: '100%',
                  padding: '10px 14px',
                  borderRadius: '8px',
                  border: '1px solid var(--border)',
                  background: 'var(--surface)',
                }}
                placeholder="••••••••"
                required
              />
            </div>

            <button
              type="submit"
              className="btn btn-primary"
              style={{ width: '100%', padding: '12px', marginTop: '8px', justifyContent: 'center' }}
              disabled={loginMutation.isPending}
            >
              {loginMutation.isPending ? 'Authenticating...' : 'Sign In securely'}
            </button>
          </form>

          <div
            style={{ marginTop: '32px', borderTop: '1px solid var(--border)', paddingTop: '20px' }}
          >
            <div
              style={{
                fontSize: '12px',
                fontWeight: 600,
                color: 'var(--text-soft)',
                marginBottom: '12px',
                textTransform: 'uppercase',
              }}
            >
              Test Accounts (Auto-fill)
            </div>
            <div className="flex g8" style={{ flexWrap: 'wrap' }}>
              <button
                className="btn btn-secondary"
                style={{ fontSize: '12px', padding: '6px 12px' }}
                onClick={() => autofill('chika@firstatlantic.com')}
              >
                Staff
              </button>
              <button
                className="btn btn-secondary"
                style={{ fontSize: '12px', padding: '6px 12px' }}
                onClick={() => autofill('david@firstatlantic.com')}
              >
                Supervisor
              </button>
              <button
                className="btn btn-secondary"
                style={{ fontSize: '12px', padding: '6px 12px' }}
                onClick={() => autofill('eniola@firstatlantic.com')}
              >
                Management
              </button>
              <button
                className="btn btn-secondary"
                style={{ fontSize: '12px', padding: '6px 12px' }}
                onClick={() => autofill('bola@firstatlantic.com')}
              >
                Client Admin
              </button>
              <button
                className="btn btn-secondary"
                style={{ fontSize: '12px', padding: '6px 12px' }}
                onClick={() => autofill('femi@firstatlantic.com')}
              >
                Auditor
              </button>
              <button
                className="btn btn-secondary"
                style={{ fontSize: '12px', padding: '6px 12px' }}
                onClick={() => autofill('adaeze@schulltech.com')}
              >
                Platform Admin
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
