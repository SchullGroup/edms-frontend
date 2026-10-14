'use client';

import React, { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { useRouter, usePathname } from 'next/navigation';
import { useQueryClient } from '@tanstack/react-query';
import { useStore, userById } from '@/store/useStore';
import { useNavigation } from '@/hooks/useNavigation';
import { Icon, IconEl } from '@/components/ui/Icons';
import { Avatar } from '@/components/ui/Avatar';
import { performLogout } from '@/lib/logout';
import { getBrandPreset } from '@/lib/brand';
import { useImageFallback } from '@/hooks/useImageFallback';

interface SidebarProps {
  isMobileOpen: boolean;
  onClose: () => void;
  navToggleRef: React.RefObject<HTMLButtonElement | null>;
}

export const Sidebar = ({ isMobileOpen, onClose, navToggleRef }: SidebarProps) => {
  const router = useRouter();
  const pathname = usePathname();
  const preset = getBrandPreset();
  const { currentUser, branding, prefs, setPrefs } = useStore();
  const queryClient = useQueryClient();

  const logoSrc = (branding.logoUrl || '').trim() || preset.logoUrl.trim();
  const brandAppName = branding.appName || preset.appName;
  const brandTenantName = branding.tenantName || preset.tenantName;
  const brandLogoText = (branding.logoText || preset.logoText).trim();
  const { showImage: showLogoImage, onImageError: onLogoError } = useImageFallback(logoSrc);

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
  const sidebarRef = React.useRef<HTMLElement>(null);
  const wasMobileOpen = React.useRef(false);

  useEffect(() => {
    if (isMobileOpen) {
      setMenuOpen(false);
      sidebarRef.current?.querySelector<HTMLButtonElement>('.nav-item')?.focus();
      const previousOverflow = document.body.style.overflow;
      document.body.style.overflow = 'hidden';
      const handleKey = (event: KeyboardEvent) => {
        if (event.key === 'Escape') {
          onClose();
          return;
        }
        if (event.key !== 'Tab' || !sidebarRef.current) return;

        const focusable = Array.from(
          sidebarRef.current.querySelectorAll<HTMLElement>(
            'a[href], button:not(:disabled), input:not(:disabled), select:not(:disabled), [tabindex]:not([tabindex="-1"])',
          ),
        ).filter((element) => element.getClientRects().length > 0);
        const first = focusable[0];
        const last = focusable[focusable.length - 1];
        if (!sidebarRef.current.contains(document.activeElement)) {
          event.preventDefault();
          (event.shiftKey ? last : first)?.focus();
        } else if (event.shiftKey && document.activeElement === first) {
          event.preventDefault();
          last?.focus();
        } else if (!event.shiftKey && document.activeElement === last) {
          event.preventDefault();
          first?.focus();
        }
      };
      document.addEventListener('keydown', handleKey);
      wasMobileOpen.current = true;
      return () => {
        document.removeEventListener('keydown', handleKey);
        document.body.style.overflow = previousOverflow;
      };
    }

    if (wasMobileOpen.current) navToggleRef.current?.focus();
    wasMobileOpen.current = false;
  }, [isMobileOpen, navToggleRef, onClose]);

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

  // "/" anywhere (outside a text field) jumps to search, as the box's hint says.
  const searchRef = useRef<HTMLInputElement>(null);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== '/' || e.ctrlKey || e.metaKey || e.altKey) return;
      const t = e.target as HTMLElement | null;
      if (t?.closest('input, textarea, select, [contenteditable="true"]')) return;
      e.preventDefault();
      searchRef.current?.focus();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, []);

  if (!me || !nav) return null;

  const storagePct = 79;

  return (
    <aside
      ref={sidebarRef}
      id="primary-sidebar"
      className="sidebar"
      aria-label="Primary navigation"
      role={isMobileOpen ? 'dialog' : undefined}
      aria-modal={isMobileOpen || undefined}
    >
      <div className="sidebar-brand">
        <div className="brand-mark" aria-label={`${brandAppName} logo`}>
          {showLogoImage ? (
            <img
              src={logoSrc}
              alt={`${brandAppName} logo`}
              className="brand-logo-image"
              onError={onLogoError}
            />
          ) : (
            <div className="brand-logo">{brandLogoText || brandAppName[0]}</div>
          )}
        </div>
        <div>
          <div className="brand-name">{brandAppName}</div>
          <div className="brand-sub">{brandTenantName}</div>
        </div>
      </div>

      <div className="side-search">
        <div className="global-search">
          <span className="search-ico">
            <Icon name="search" size={16} />
          </span>
          <input
            ref={searchRef}
            type="search"
            placeholder="Search…"
            aria-label="Global search"
            onKeyDown={(e) => {
              if (e.key === 'Enter' && e.currentTarget.value.trim()) {
                router.push(`/search?q=${encodeURIComponent(e.currentTarget.value.trim())}`);
                onClose();
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
                  onClick={() => {
                    router.push(it.route);
                    onClose();
                  }}
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

      {preset.features.tenantStorage && (
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
      )}

      <div className="sidebar-foot">
        <button
          className="foot-link"
          onClick={() => {
            router.push('/help');
            onClose();
          }}
        >
          <span>
            <Icon name="info" size={16} />
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
