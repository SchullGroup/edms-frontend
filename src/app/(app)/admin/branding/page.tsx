'use client';

import React, { useState, useEffect } from 'react';
import { useStore } from '@/store/useStore';
import { useUIStore } from '@/store/useUIStore';
import { Icon } from '@/components/ui/Icons';
import { useBranding, useUpdateBranding } from '@/apis/hooks/useBranding';

export default function BrandingPage() {
  const { auditAction } = useStore();
  const { setPageTitle, openModal, closeModal, addToast } = useUIStore();

  const { data: brandingData, isLoading } = useBranding();
  const updateBranding = useUpdateBranding();

  const defaultB = {
    appName: 'SchullTech EDMS',
    tenantName: 'First Atlantic Bank',
    logoText: 'FA',
    primary: '#1F3864',
    primaryLight: '#2E5496',
    accent: '#C55A11',
  };

  const [localB, setLocalB] = useState(defaultB);

  // Sync local state when brandingData is loaded
  useEffect(() => {
    if (brandingData) {
      setLocalB(brandingData as any);
    }
  }, [brandingData]);

  useEffect(() => {
    setPageTitle('Branding');
  }, [setPageTitle]);

  const PRESETS = [
    { name: 'SchullTech default', primary: '#1F3864', light: '#2E5496', accent: '#C55A11' },
    { name: 'Emerald Trust', primary: '#0F4C3A', light: '#1B7A5E', accent: '#B0821B' },
    { name: 'Crimson Capital', primary: '#5C1A2E', light: '#8E2C48', accent: '#1F6E8C' },
    { name: 'Slate & Amber', primary: '#2E3A48', light: '#4A5D75', accent: '#C56A11' },
  ];

  const contrastRatio = (hex: string) => {
    const c = hex.replace('#', '');
    const [r, g, bl] = [0, 2, 4]
      .map((i) => parseInt(c.substr(i, 2), 16) / 255)
      .map((v) => (v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4)));
    const L = 0.2126 * r + 0.7152 * g + 0.0722 * bl;
    return 1.05 / (L + 0.05); // vs white text
  };

  const checkContrast = () => {
    const bad = [
      ['Primary', localB.primary],
      ['Accent', localB.accent],
    ].filter(([, v]) => contrastRatio(v) < 4.5);
    return bad;
  };

  const badContrast = checkContrast();

  useEffect(() => {
    document.documentElement.style.setProperty('--brand-primary', localB.primary);
    document.documentElement.style.setProperty('--brand-primary-light', localB.primaryLight);
    document.documentElement.style.setProperty('--brand-accent', localB.accent);

    return () => {
      // Revert on unmount to actual branding if not saved
      if (brandingData) {
        const b = brandingData as any;
        document.documentElement.style.setProperty('--brand-primary', b.primary);
        document.documentElement.style.setProperty('--brand-primary-light', b.primaryLight);
        document.documentElement.style.setProperty('--brand-accent', b.accent);
      }
    };
  }, [localB.primary, localB.primaryLight, localB.accent, brandingData]);

  const apply = () => {
    updateBranding.mutate(localB, {
      onSuccess: () => {
        auditAction('BRANDING_UPDATE', 'Branding', 'Updated tenant branding');
      },
    });
  };

  const handleTemplateEdit = (t: string) => {
    openModal({
      title: 'Template — ' + t,
      size: 'lg',
      body: (
        <div>
          <div
            style={{ border: '1px solid var(--border)', borderRadius: '9px', overflow: 'hidden' }}
          >
            <div
              style={{
                background: localB.primary,
                color: '#fff',
                padding: '14px 18px',
                fontWeight: 800,
              }}
            >
              {localB.appName || 'EDMS'}
            </div>
            <div style={{ padding: '18px', fontSize: '13px', lineHeight: 1.6 }}>
              <p>Hello {'{{first_name}}'},</p>
              <p className="mt8">
                {t === 'Task assigned'
                  ? '“{{document_title}}” has been routed to you at stage “{{stage}}”. It is due {{due_date}}.'
                  : `This is the ${t.toLowerCase()} template. Merge fields: {{document_title}}, {{stage}}, {{due_date}}, {{link}}.`}
              </p>
              <p className="mt8">
                <span
                  className="btn btn-sm"
                  style={{ background: localB.accent, color: '#fff', pointerEvents: 'none' }}
                >
                  Open in {localB.appName || 'EDMS'}
                </span>
              </p>
            </div>
          </div>
          <div className="caption mt8">Templates inherit tenant branding automatically.</div>
        </div>
      ),
      actions: [
        { label: 'Close' },
        {
          label: 'Save template',
          kind: 'btn-primary',
          onClick: () => {
            auditAction('TEMPLATE_EDIT', t, 'Saved email template');
            addToast('Template saved', 'success');
            closeModal();
          },
        },
      ],
    });
  };

  if (isLoading) {
    return <div style={{ padding: '20px' }}>Loading branding...</div>;
  }

  return (
    <div>
      <div className="page-head">
        <div>
          <div className="page-title">Branding</div>
          <div className="page-sub">
            White-label theming — semantic tokens only; structure, hierarchy and accessibility stay
            fixed.
          </div>
        </div>
        <div className="actions">
          <button
            className="btn btn-secondary"
            onClick={() => {
              setLocalB({
                ...localB,
                primary: '#1F3864',
                primaryLight: '#2E5496',
                accent: '#C55A11',
              });
              addToast('Reset to default palette (not yet published)', 'info');
            }}
          >
            Reset to default
          </button>
          <button className="btn btn-primary" onClick={apply}>
            Publish branding
          </button>
        </div>
      </div>

      <div className="grid cols-2" style={{ alignItems: 'start' }}>
        <div>
          <div className="card mb16">
            <div className="card-head">
              <span className="h3">Identity</span>
            </div>
            <div className="card-body">
              <div className="field">
                <label>Application name</label>
                <input
                  className="input"
                  value={localB.appName}
                  onChange={(e) => setLocalB({ ...localB, appName: e.target.value })}
                />
                <div className="help">Shown in the top bar, login screen and email templates.</div>
              </div>
              <div className="field">
                <label>Tenant / organisation name</label>
                <input
                  className="input"
                  value={localB.tenantName}
                  onChange={(e) => setLocalB({ ...localB, tenantName: e.target.value })}
                />
              </div>
              <div className="field">
                <label>Logo monogram (1–2 chars)</label>
                <input
                  className="input"
                  value={localB.logoText}
                  maxLength={2}
                  onChange={(e) => setLocalB({ ...localB, logoText: e.target.value })}
                />
                <div className="help">
                  Production supports uploaded SVG/PNG with safe-area validation and light/dark
                  variants.
                </div>
              </div>
              <div className="field">
                <label>Custom domain</label>
                <input className="input" value="edms.firstatlantic.com" disabled />
                <div className="help">Managed TLS · white-label entitlement ✓</div>
              </div>
            </div>
          </div>

          <div className="card">
            <div className="card-head">
              <span className="h3">Brand colours</span>
              <span className="caption">Live preview as you pick</span>
            </div>
            <div className="card-body">
              <div className="grid cols-3" style={{ gap: '12px' }}>
                <div className="field">
                  <label>Primary</label>
                  <input
                    type="color"
                    value={localB.primary}
                    style={{
                      width: '46px',
                      height: '34px',
                      border: '1px solid var(--border)',
                      borderRadius: '7px',
                      cursor: 'pointer',
                      padding: '2px',
                    }}
                    onChange={(e) => setLocalB({ ...localB, primary: e.target.value })}
                  />
                </div>
                <div className="field">
                  <label>Primary light</label>
                  <input
                    type="color"
                    value={localB.primaryLight}
                    style={{
                      width: '46px',
                      height: '34px',
                      border: '1px solid var(--border)',
                      borderRadius: '7px',
                      cursor: 'pointer',
                      padding: '2px',
                    }}
                    onChange={(e) => setLocalB({ ...localB, primaryLight: e.target.value })}
                  />
                </div>
                <div className="field">
                  <label>Accent / CTA</label>
                  <input
                    type="color"
                    value={localB.accent}
                    style={{
                      width: '46px',
                      height: '34px',
                      border: '1px solid var(--border)',
                      borderRadius: '7px',
                      cursor: 'pointer',
                      padding: '2px',
                    }}
                    onChange={(e) => setLocalB({ ...localB, accent: e.target.value })}
                  />
                </div>
              </div>

              {badContrast.length > 0 ? (
                <div className="banner warning">
                  <span style={{ display: 'inline-flex', alignItems: 'center' }}>
                    <Icon name="alert" size={15} />
                  </span>
                  {`${badContrast.map((x) => x[0]).join(' & ')} fails WCAG AA contrast (4.5:1) for white text. The system will fall back to the fixed semantic hue on text/controls.`}
                </div>
              ) : (
                <div className="banner success">
                  All brand colours pass WCAG AA contrast for white text.
                </div>
              )}

              <div className="h3 mb8 mt8">Sample alternate brands</div>
              <div className="flex g8 wrap">
                {PRESETS.map((p) => (
                  <button
                    key={p.name}
                    className="btn btn-secondary btn-sm"
                    onClick={() => {
                      setLocalB({
                        ...localB,
                        primary: p.primary,
                        primaryLight: p.light,
                        accent: p.accent,
                      });
                      addToast(`Previewing “${p.name}” — publish to keep`, 'info');
                    }}
                  >
                    <span style={{ display: 'inline-flex', gap: '3px', marginRight: '6px' }}>
                      <span
                        style={{
                          width: '10px',
                          height: '10px',
                          borderRadius: '3px',
                          background: p.primary,
                        }}
                      ></span>
                      <span
                        style={{
                          width: '10px',
                          height: '10px',
                          borderRadius: '3px',
                          background: p.accent,
                        }}
                      ></span>
                    </span>
                    {p.name}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>

        <div className="card">
          <div className="card-head">
            <span className="h3">Email templates</span>
          </div>
          <div className="card-body">
            {[
              'Task assigned',
              'SLA reminder',
              'Escalation',
              'Signature request',
              'Circular published',
              'User invitation',
            ].map((t) => (
              <div key={t} className="metric-li">
                <span>{t}</span>
                <button className="btn btn-ghost btn-sm" onClick={() => handleTemplateEdit(t)}>
                  Edit
                </button>
              </div>
            ))}
            <div className="divider"></div>
            <div className="h3 mb8">Login preview</div>
            <div
              style={{
                border: '1px solid var(--border)',
                borderRadius: '10px',
                padding: '22px',
                textAlign: 'center',
                background: 'var(--surface)',
              }}
            >
              <div
                className="brand-logo"
                style={{
                  margin: '0 auto 10px',
                  width: '40px',
                  height: '40px',
                  fontSize: '18px',
                  background: localB.accent,
                  color: '#fff',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  borderRadius: '50%',
                }}
              >
                {(localB.logoText || 'S').toUpperCase()}
              </div>
              <b>{localB.appName || 'SchullTech EDMS'}</b>
              <div className="caption">{localB.tenantName}</div>
              <div
                className="btn btn-sm mt8"
                style={{ background: localB.primary, color: '#fff', pointerEvents: 'none' }}
              >
                Sign in with SSO
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
