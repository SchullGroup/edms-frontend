'use client';

import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { useRouter, usePathname } from 'next/navigation';
import { useQueryClient } from '@tanstack/react-query';
import { useStore, userById } from '@/store/useStore';
import { useNavigation } from '@/hooks/useNavigation';
import { Icon, IconEl } from '@/components/ui/Icons';
import { Avatar } from '@/components/ui/Avatar';
import { useUIStore } from '@/store/useUIStore';
import { performLogout } from '@/lib/logout';

export const Sidebar = () => {
  const router = useRouter();
  const pathname = usePathname();
  const { currentUser, branding, resetData, prefs, setPrefs } = useStore();
  const { openModal, addToast } = useUIStore();
  const queryClient = useQueryClient();

  const handleSignOut = () => {
    setMenuOpen(false);
    performLogout(queryClient, router);
  };
  const nav = useNavigation();
  const [menuOpen, setMenuOpen] = useState(false);
  const [menuPos, setMenuPos] = useState<{ left: number; bottom: number } | null>(null);
  const me = currentUser;
  const triggerRef = React.useRef<HTMLButtonElement>(null);
  const popoverRef = React.useRef<HTMLDivElement>(null);

  // Position the popover against the trigger. It renders in a portal on
  // `document.body` (position: fixed) so the sidebar's `overflow: hidden`
  // can't clip it.
  const placeMenu = React.useCallback(() => {
    const r = triggerRef.current?.getBoundingClientRect();
    if (!r) return;
    const width = 240;
    setMenuPos({
      left: Math.min(r.left, window.innerWidth - width - 8),
      bottom: window.innerHeight - r.top + 8,
    });
  }, []);

  useEffect(() => {
    if (!menuOpen) {
      setMenuPos(null);
      return;
    }
    placeMenu();
    const onScrollResize = () => placeMenu();
    window.addEventListener('resize', onScrollResize);
    window.addEventListener('scroll', onScrollResize, true);

    const handleClickOutside = (event: MouseEvent) => {
      const t = event.target as Node;
      if (
        !triggerRef.current?.contains(t) &&
        !popoverRef.current?.contains(t)
      ) {
        setMenuOpen(false);
      }
    };
    const handleKey = (e: KeyboardEvent) => e.key === 'Escape' && setMenuOpen(false);
    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleKey);

    return () => {
      window.removeEventListener('resize', onScrollResize);
      window.removeEventListener('scroll', onScrollResize, true);
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleKey);
    };
  }, [menuOpen, placeMenu]);

  if (!me || !nav) return null;

  const storagePct = 79;

  return (
    <aside className="sidebar" aria-label="Primary navigation">
      <div className="sidebar-brand">
        <div className="brand-logo">{branding.logoText || branding.appName[0]}</div>
        <div>
          <div className="brand-name">{branding.appName}</div>
          <div className="brand-sub">{branding.tenantName}</div>
        </div>
      </div>

      <div className="side-search">
        <div className="global-search">
          <span className="search-ico">
            <Icon name="search" size={16} />
          </span>
          <input
            type="search"
            placeholder="Search…"
            aria-label="Global search"
            onKeyDown={(e) => {
              if (e.key === 'Enter' && e.currentTarget.value.trim()) {
                router.push(`/search?q=${encodeURIComponent(e.currentTarget.value.trim())}`);
              }
            }}
          />
          <span className="kbd-hint">/</span>
        </div>
      </div>

      <nav className="sidebar-nav">
        {nav.sections.map((sec: any, idx: number) => (
          <div key={idx} className="nav-section">
            <div className="nav-section-label">{sec.label}</div>
            {sec.items.map((it: any, iIdx: number) => {
              const badge = it.badge ? it.badge() : 0;
              return (
                <button
                  key={iIdx}
                  className={`nav-item ${pathname === it.route ? 'active' : ''}`}
                  onClick={() => router.push(it.route)}
                  title={it.label}
                  aria-current={pathname === it.route ? 'page' : undefined}
                >
                  <IconEl name={it.icon} />
                  <span className="nav-label">{it.label}</span>
                  {badge > 0 && <span className="nav-badge">{badge}</span>}
                </button>
              );
            })}
          </div>
        ))}
      </nav>

      <div className="side-usage">
        <div className="su-title">
          <Icon name="cabinet" size={14} />
          &nbsp;Tenant storage
        </div>
        <div className="su-sub">812 GB of 1 TB used</div>
        <div className={`pbar ${storagePct > 85 ? 'crit' : 'warn'}`}>
          <i style={{ width: `${storagePct}%` }}></i>
        </div>
      </div>

      <div className="sidebar-foot">
        <button
          className="foot-link"
          onClick={() =>
            openModal({
              title: 'Help & support',
              body: (
                <div>
                  <p style={{ lineHeight: 1.65, fontSize: '13px' }}>
                    SchullTech EDMS v1.0 — role-based demo build. Press{' '}
                    <span className="kbd">/</span> anywhere to search. Workflows, signing,
                    redaction, theming and audit trails are fully interactive; data persists locally
                    and can be reset from your profile menu.
                  </p>
                </div>
              ),
              actions: [{ label: 'Got it', kind: 'btn-primary' }],
            })
          }
        >
          <span>
            <Icon name="circle" size={16} />
          </span>
          <span className="foot-label">Help & support</span>
        </button>

        <div style={{ position: 'relative' }}>
          <button
            ref={triggerRef}
            className="profile-card"
            aria-label="Account menu"
            aria-haspopup="menu"
            aria-expanded={menuOpen}
            onClick={() => setMenuOpen((v) => !v)}
          >
            <Avatar user={me} />
            <span>
              <div className="pc-name">{me.name}</div>
              <div className="pc-mail">{me.email}</div>
            </span>
            <span className="chev">
              <Icon name="chevD" size={14} />
            </span>
          </button>

          {menuOpen &&
            menuPos &&
            createPortal(
              <div
                ref={popoverRef}
                className="menu"
                role="menu"
                style={{
                  position: 'fixed',
                  left: menuPos.left,
                  bottom: menuPos.bottom,
                  top: 'auto',
                  right: 'auto',
                  width: 240,
                }}
              >
                <div className="menu-head">{me.roles?.[0] || 'User'}</div>
                <button
                  className="menu-item"
                  role="menuitem"
                  onClick={() => {
                    setPrefs({ ...prefs, theme: prefs.theme === 'dark' ? 'light' : 'dark' });
                  }}
                >
                  <span>
                    <Icon name={prefs.theme === 'dark' ? 'sun' : 'moon'} size={16} />
                  </span>{' '}
                  {prefs.theme === 'dark' ? 'Light theme' : 'Dark theme'}
                </button>
                <div className="menu-sep"></div>
                <button
                  className="menu-item"
                  role="menuitem"
                  onClick={() => {
                    resetData();
                    addToast('Demo data reset', 'info');
                    setMenuOpen(false);
                  }}
                >
                  <span>
                    <Icon name="swap" size={16} />
                  </span>{' '}
                  Reset demo data
                </button>
                <div className="menu-sep"></div>
                <button className="menu-item danger" role="menuitem" onClick={handleSignOut}>
                  <span>
                    <Icon name="logout" size={16} />
                  </span>{' '}
                  Sign out / switch role
                </button>
              </div>,
              document.body,
            )}
        </div>
      </div>
    </aside>
  );
};
