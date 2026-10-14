'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useStore } from '@/store/useStore';
import { useUIStore } from '@/store/useUIStore';
import { authService } from '@/apis/services/auth.service';
import { useMutation } from '@tanstack/react-query';
import Cookies from 'js-cookie';
import { AuthShell } from '@/components/auth/AuthShell';
import { PasswordInput } from '@/components/auth/PasswordInput';
import { getBrandPreset } from '@/lib/brand';
import {
  PORTAL_BY_KEY,
  fallbackPermissionsForRoles,
  normalizePermission,
  effectivePortal,
} from '@/lib/permissions';

export default function LoginPage() {
  const router = useRouter();
  const { currentUser, setCurrentUser, prefs } = useStore();
  const { addToast } = useUIStore();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  // Redirect if already logged in — by the portal the user's permissions unlock,
  // not by role name. Permissions may not be hydrated yet at this instant, so
  // fall back to the seeded system-role grant approximation.
  useEffect(() => {
    if (currentUser) {
      // The store keeps `currentUser` in localStorage so a reload doesn't bounce a
      // signed-in user out — but it outlives the session it came from. With no
      // `accessToken` cookie there is no session behind it (the proxy deletes the
      // pair when it confirms one is dead), and treating it as one was a dead end:
      // the portal push is bounced straight back here by the proxy while this page
      // returns null for as long as the stale user is set, so the screen stayed
      // blank and there was no way to sign in. Drop it and show the form.
      if (!Cookies.get('accessToken')) {
        setCurrentUser(null);
        return;
      }
      const perms =
        currentUser.permissions && currentUser.permissions.length > 0
          ? currentUser.permissions.map(normalizePermission)
          : fallbackPermissionsForRoles(currentUser.roles);
      const portalKey = effectivePortal(
        perms,
        currentUser.roles,
        currentUser.id,
        prefs?.portalChoice,
      );
      router.push(PORTAL_BY_KEY[portalKey]?.home || '/staff');
    }
    // Only on sign-in, not when the switcher later changes `prefs`.
    // eslint-disable-next-line react-hooks/exhaustive-deps
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

  const autofill = (testEmail: string, testPassword = 'password') => {
    setEmail(testEmail);
    setPassword(testPassword);
  };

  const isDev = process.env.NODE_ENV === 'development';
  // The fixture logins belong to our own deployment, so a white-labelled build
  // never shows them — not even in development.
  const { loginTestAccounts } = getBrandPreset().features;

  if (currentUser) return null;

  return (
    <AuthShell>
      <div className="page-title mb-1">Sign in</div>
      <p className="text-sm text-muted">Enter your credentials to access your secure portal.</p>

      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <div>
          <label className="mb-2 block text-[13px] font-medium">Email Address</label>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="input w-full"
            placeholder="you@company.com"
            required
          />
        </div>

        <div>
          <label className="mb-2 block text-[13px] font-medium">Password</label>
          <PasswordInput
            value={password}
            onChange={setPassword}
            autoComplete="current-password"
            required
          />
          <div className="mt-2 flex justify-end">
            <Link
              href="/forgot-password"
              className="text-[12.5px] font-medium text-(--focus) hover:underline"
            >
              Forgot password?
            </Link>
          </div>
        </div>

        <button
          type="submit"
          className="btn btn-primary mt-2 w-full justify-center py-3"
          disabled={loginMutation.isPending}
        >
          {loginMutation.isPending ? 'Authenticating...' : 'Sign In securely'}
        </button>
      </form>

      {isDev && loginTestAccounts && (
        <div className="mt-8 border-t border-(--border) pt-5">
          <div className="mb-3 text-xs font-semibold uppercase text-(--text-soft)">
            Test Accounts (Set 2)
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              className="btn btn-secondary text-xs"
              style={{ padding: '6px 12px' }}
              onClick={() => autofill('tjoel+staff_finance@schulltech.com', 'Fixture123!')}
            >
              Staff (Finance)
            </button>
            <button
              className="btn btn-secondary text-xs"
              style={{ padding: '6px 12px' }}
              onClick={() => autofill('tjoel+staff_hr@schulltech.com', 'Fixture123!')}
            >
              Staff (HR)
            </button>
            <button
              className="btn btn-secondary text-xs"
              style={{ padding: '6px 12px' }}
              onClick={() => autofill('tjoel+supervisor_finance@schulltech.com', 'Fixture123!')}
            >
              Supervisor (Finance)
            </button>
            <button
              className="btn btn-secondary text-xs"
              style={{ padding: '6px 12px' }}
              onClick={() => autofill('tjoel+management_ops@schulltech.com', 'Fixture123!')}
            >
              Management (Ops)
            </button>
            <button
              className="btn btn-secondary text-xs"
              style={{ padding: '6px 12px' }}
              onClick={() => autofill('tjoel+clientadmin@schulltech.com', 'Fixture123!')}
            >
              Client Admin
            </button>
            <button
              className="btn btn-secondary text-xs"
              style={{ padding: '6px 12px' }}
              onClick={() => autofill('tjoel+auditor@schulltech.com', 'Fixture123!')}
            >
              Auditor
            </button>
            <button
              className="btn btn-secondary text-xs"
              style={{ padding: '6px 12px' }}
              onClick={() => autofill('tjoel+schulltechadmin@schulltech.com', 'Fixture123!')}
            >
              Platform Admin
            </button>
          </div>
        </div>
      )}
    </AuthShell>
  );
}
