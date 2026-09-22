'use client';

import React, { useState, useEffect } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { evaluateRouteAccess } from '@/lib/routeAccess';
import { useStore } from '@/store/useStore';
import { Sidebar } from './Sidebar';
import { Topbar } from './Topbar';
import { useUIStore } from '@/store/useUIStore';
import { authService } from '@/apis/services/auth.service';
import { usePermissions } from '@/hooks/usePermissions';
import { useHydratePermissions } from '@/hooks/useHydratePermissions';
import { SessionExpiredModal } from '@/components/common/SessionExpiredModal';
import { ServiceUnavailableOverlay } from '@/components/common/ServiceUnavailableOverlay';

interface AppShellProps {
  children: React.ReactNode;
}

// Lighten a hex colour by mixing toward white — keeps tenant brands legible on dark surfaces
function lighten(hex: string, amt: number) {
  const c = hex.replace('#', '');
  const mix = (i: number) =>
    Math.round(parseInt(c.substr(i, 2), 16) + (255 - parseInt(c.substr(i, 2), 16)) * amt)
      .toString(16)
      .padStart(2, '0');
  return '#' + mix(0) + mix(2) + mix(4);
}

export const AppShell = ({ children }: AppShellProps) => {
  const router = useRouter();
  const pathname = usePathname();
  const { currentUser, branding, prefs, patchCurrentUser } = useStore();
  const { pageTitle } = useUIStore();
  const [collapsed, setCollapsed] = useState(false);
  const [isMounted, setIsMounted] = useState(false);
  const [hydrated, setHydrated] = useState(false);
  const { granted, isReady: permsReady } = usePermissions();

  // Top up currentUser.permissions with any role permission keys the live
  // login/`/auth/me` payload didn't include; never overwrites live entries.
  useHydratePermissions();

  useEffect(() => {
    const unsub = useStore.persist.onFinishHydration(() => setHydrated(true));
    setHydrated(useStore.persist.hasHydrated());
    return unsub;
  }, []);

  useEffect(() => {
    const val = sessionStorage.getItem('edms-nav-collapsed') === '1';
    setCollapsed(val);
    setIsMounted(true);
  }, []);

  useEffect(() => {
    // --- Route Guard Logic (cosmetic — middleware.ts is the real gate now) ---
    if (!isMounted || !hydrated) return;
    // Wait until we actually know the user's permissions, otherwise a custom
    // role (empty fallback grants) would be bounced to /unauthorized on first paint.
    if (!permsReady) return;

    if (currentUser && pathname && pathname !== '/unauthorized') {
      const { matched, allowed } = evaluateRouteAccess(pathname, {
        roles: currentUser.roles ?? [],
        permissions: granted,
      });
      if (matched && !allowed) {
        router.replace('/unauthorized');
      }
    }
  }, [currentUser, pathname, router, isMounted, hydrated, permsReady, granted]);

  // Verify the session once per signed-in user, and adopt fresh `roles` /
  // `permissions` from `/auth/me` (both are now live — see docs/01 DRIFT-03).
  // Gap-filling from `GET /roles` is handled separately, reactively, by
  // `useHydratePermissions`. Keyed on `currentUser?.id` (a primitive) — NOT the
  // object — so the `patchCurrentUser` below can't retrigger it.
  useEffect(() => {
    if (!isMounted || !hydrated) return;

    if (!currentUser) {
      router.push('/');
      return;
    }

    let cancelled = false;
    authService
      .me()
      .then((res) => {
        if (cancelled || !res) return;
        const cur = useStore.getState().currentUser;
        if (!cur) return;
        const patch: Record<string, unknown> = {};
        if (res.roles && JSON.stringify(res.roles) !== JSON.stringify(cur.roles)) {
          patch.roles = res.roles;
        }
        if (
          res.permissions &&
          res.permissions.length > 0 &&
          JSON.stringify(res.permissions) !== JSON.stringify(cur.permissions)
        ) {
          patch.permissions = res.permissions;
        }
        if (Object.keys(patch).length) patchCurrentUser(patch);
      })
      .catch((err) => {
        if (cancelled) return;
        // Same distinction as api-client.ts's interceptor: a real response
        // confirming the token is dead (401/403) means the session is
        // genuinely over — hand off to SessionExpiredModal rather than a
        // silent hard redirect. A network error/timeout here means the
        // backend was unreachable for this one call, not that the user is
        // logged out — previously this branch treated the two identically,
        // so a single transient blip right after login forced every user
        // back to the login screen. Do nothing in that case: the session
        // stays as-is, and ServiceUnavailableOverlay picks up the pattern
        // if it keeps happening across other queries.
        const status = err?.response?.status;
        if (status === 401 || status === 403) {
          useUIStore.getState().setSessionExpired(true);
        }
      });

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentUser?.id, isMounted, hydrated]);

  useEffect(() => {
    if (branding && prefs) {
      const dark = prefs.theme === 'dark';
      const r = document.documentElement.style;
      r.setProperty('--brand-primary', dark ? lighten(branding.primary, 0.28) : branding.primary);
      r.setProperty(
        '--brand-primary-light',
        dark ? lighten(branding.primaryLight, 0.32) : branding.primaryLight,
      );
      r.setProperty('--brand-accent', dark ? lighten(branding.accent, 0.18) : branding.accent);
      document.documentElement.setAttribute('data-theme', prefs.theme);
      document.documentElement.setAttribute('data-density', prefs.density);
      document.title = branding.appName;
    }
  }, [branding, prefs]);

  const toggleNav = () => {
    const next = !collapsed;
    setCollapsed(next);
    sessionStorage.setItem('edms-nav-collapsed', next ? '1' : '0');
  };

  if (!hydrated) return null; // Wait for hydration before rendering to prevent flash or bad redirects
  if (!currentUser) return null;

  return (
    <div className={`shell ${collapsed ? 'nav-collapsed' : ''}`}>
      <Sidebar />
      <Topbar pageTitle={pageTitle} toggleNav={toggleNav} />
      <main className="main" id="main-content">
        <div className="main-inner">{children}</div>
      </main>
      <SessionExpiredModal />
      <ServiceUnavailableOverlay />
    </div>
  );
};
