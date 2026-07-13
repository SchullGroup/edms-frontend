'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useStore } from '@/store/useStore';
import { Sidebar } from './Sidebar';
import { Topbar } from './Topbar';
import { useUIStore } from '@/store/useUIStore';

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
  const { session, branding, prefs } = useStore();
  const { pageTitle } = useUIStore();
  const [collapsed, setCollapsed] = useState(false);

  useEffect(() => {
    const val = sessionStorage.getItem('edms-nav-collapsed') === '1';
    setCollapsed(val);
  }, []);

  useEffect(() => {
    if (!session) {
      router.push('/');
    }
  }, [session, router]);

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

  if (!session) return null;

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
