'use client';

import React, { useState } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { useStore, userById } from '@/store/useStore';
import { useNavigation } from '@/hooks/useNavigation';
import { Icon, IconEl } from '@/components/ui/Icons';
import { Avatar } from '@/components/ui/Avatar';
import { useUIStore } from '@/store/useUIStore';

export const Sidebar = () => {
  const router = useRouter();
  const pathname = usePathname();
  const { session, users, branding, setSession, resetData } = useStore();
  const { openModal, addToast } = useUIStore();
  const nav = useNavigation();
  const [menuOpen, setMenuOpen] = useState(false);
  const me = session ? userById(users, session) : null;

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
            className="profile-card"
            aria-label="Account menu"
            onClick={() => setMenuOpen(!menuOpen)}
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

          {menuOpen && (
            <div className="menu up">
              <div className="menu-head">{me.roleLabel}</div>
              <button
                className="menu-item"
                onClick={() => {
                  // Theme toggle logic here (requires document mutation which we can handle in AppShell)
                  addToast('Theme settings are managed in AppShell', 'info');
                }}
              >
                <span>
                  <Icon name="sun" size={16} />
                </span>{' '}
                Theme
              </button>
              <div className="menu-sep"></div>
              <button
                className="menu-item"
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
              <button
                className="menu-item danger"
                onClick={() => {
                  setSession(null);
                  router.push('/');
                }}
              >
                <span>
                  <Icon name="logout" size={16} />
                </span>{' '}
                Sign out / switch role
              </button>
            </div>
          )}
        </div>
      </div>
    </aside>
  );
};
