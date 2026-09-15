'use client';

import React, { useState, useEffect } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { routeConfig } from '@/config/routes.config';
import { useStore } from '@/store/useStore';
import { Sidebar } from './Sidebar';
import { Topbar } from './Topbar';
import { useUIStore } from '@/store/useUIStore';
import { authService } from '@/apis/services/auth.service';
import { usePermissions } from '@/hooks/usePermissions';
import { useHydratePermissions } from '@/hooks/useHydratePermissions';

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
  const { hasPermission, isReady: permsReady } = usePermissions();

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
    // --- Route Guard Logic (cosmetic — the backend is the real gate) ---
    if (!isMounted || !hydrated) return;
    // Wait until we actually know the user's permissions, otherwise a custom
    // role (empty fallback grants) would be bounced to /unauthorized on first paint.
    if (!permsReady) return;

    if (currentUser && pathname && pathname !== '/unauthorized') {
      let isAllowed = true;
      let matchedRule = false;

      const checkOne = (p: string | { resource: string; action: string }) => {
        if (typeof p === 'string') {
          const [res, act] = p.split(':');
          return hasPermission(res, act || '*');
        }
        return hasPermission(p.resource, p.action);
      };

      for (const rule of routeConfig) {
        let match = false;
        if (rule.matchType === 'exact') {
          match = pathname === rule.path;
        } else if (rule.matchType === 'prefix') {
          const isExcluded = rule.exclude?.some((ex) => pathname.startsWith(ex));
          match = pathname.startsWith(rule.path) && !isExcluded;
        } else if (rule.matchType === 'whitelist') {
          const isIncluded = rule.include?.some((inc) => pathname.startsWith(inc));
          match = pathname === rule.path || !!isIncluded;
        }

        if (match) {
          matchedRule = true;

          if (rule.roles && rule.roles.length > 0) {
            isAllowed = currentUser.roles.some((r) => rule.roles!.includes(r));
          }
          if (isAllowed && rule.anyPermissions && rule.anyPermissions.length > 0) {
            isAllowed = rule.anyPermissions.some(checkOne);
          }
          if (isAllowed && rule.permissions && rule.permissions.length > 0) {
            isAllowed = rule.permissions.every(checkOne);
          }

          break; // Stop at first match
        }
      }

      if (matchedRule && !isAllowed) {
        router.replace('/unauthorized');
      }
    }
  }, [currentUser, pathname, router, isMounted, hydrated, permsReady, hasPermission]);

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
      .catch(() => {
        if (cancelled) return;
        // interceptor handles the 401 — we just clear local state
        useStore.getState().setCurrentUser(null);
        router.push('/');
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
    </div>
  );
};
