import type { Branding } from '@/types/models';

export type BrandKey = 'schulltech' | 'galaxybackbone';
export type BrandPreset = {
  key: BrandKey;
  appName: string;
  platformName: string;
  tenantName: string;
  logoText: string;
  logoUrl: string;
  faviconUrl: string;
  features: {
    brandingPage: boolean;
    tenantStorage: boolean;
    productGuide: boolean;
    extendedPolicyTabs: boolean;
    loginTestAccounts: boolean;
  };
  /** Tenant identity colours: avatars, charts, sparklines. */
  primary: string;
  primaryLight: string;
  accent: string;
  /**
   * Chrome colours this brand re-paints, and only those it genuinely changes.
   * Anything left out keeps the value `globals.css` already had — which is
   * per-theme, so a brand that means to change nothing must not set these, or
   * it would freeze one theme's value (today's violet, say) into both.
   */
  ctaBg?: string;
  ctaBgHover?: string;
  /** Focus rings / active nav. Light and dark differ by design: a shade dark
   *  enough for white button labels is too dim on a dark background. */
  focus?: string;
  focusDark?: string;
  heroBadge: string;
  heroTitle: string;
  heroText: string;
  footerText: string;
};

export const BRAND_PRESETS: Record<BrandKey, BrandPreset> = {
  schulltech: {
    key: 'schulltech',
    appName: 'SchullTech EDMS',
    platformName: 'SchullTech',
    tenantName: 'First Atlantic Bank',
    logoText: 'S',
    logoUrl: '',
    faviconUrl: '/brands/schulltech/favicon.ico',
    features: {
      brandingPage: true,
      tenantStorage: true,
      productGuide: true,
      extendedPolicyTabs: true,
      loginTestAccounts: true,
    },
    primary: '#1F3864',
    primaryLight: '#2E5496',
    accent: '#C55A11',
    heroBadge: '✦ EDMS SaaS Platform · v1.0',
    heroTitle: 'A system of record for regulated, high-stakes work.',
    heroText:
      'Capture, classify, route, sign and audit every document — with white-label theming, role-based portals and SLA-driven workflows.',
    footerText: '© 2026 Schull Technologies Ltd · Confidential — Internal & Client Stakeholders',
  },
  galaxybackbone: {
    key: 'galaxybackbone',
    appName: 'GalaxyBackbone EDMS',
    platformName: 'GalaxyBackbone',
    tenantName: 'GalaxyBackbone',
    logoText: 'GBB',
    logoUrl: '/gbb-logo.jpg',
    faviconUrl: '/gbb-logo.jpg',
    features: {
      brandingPage: false,
      tenantStorage: false,
      productGuide: false,
      extendedPolicyTabs: false,
      loginTestAccounts: false,
    },
    primary: '#008F43',
    primaryLight: '#3DAA6E',
    accent: '#708090',
    ctaBg: '#007A39',
    ctaBgHover: '#00692F',
    focus: '#008F43',
    focusDark: '#3DAA6E',
    heroBadge: 'Electronic Document Management',
    heroTitle: 'A secure, modern document system for mission-critical work.',
    heroText:
      'Capture, classify, route, approve and archive records across teams with a resilient, role-based platform built for compliance and speed.',
    footerText: '© 2026 GalaxyBackbone · Powered by Schull Technologies Limited',
  },
};

export function getBrandPreset(): BrandPreset {
  const rawKey = (process.env.NEXT_PUBLIC_BRAND ?? 'schulltech').trim().toLowerCase();
  const key = rawKey === 'galaxybackbone' ? 'galaxybackbone' : 'schulltech';
  return BRAND_PRESETS[key];
}

/**
 * The store's `branding` as this preset defines it, tagged with the preset key so
 * a browser that ran another brand can tell — and so a preset-owned copy can be
 * refreshed when these values change. `source: 'custom'` marks the one the
 * `/admin/branding` page publishes, which must survive instead.
 */
export function getPresetBranding(): Branding {
  const preset = getBrandPreset();
  return {
    appName: preset.appName,
    tenantName: preset.tenantName,
    primary: preset.primary,
    primaryLight: preset.primaryLight,
    accent: preset.accent,
    logoText: preset.logoText,
    logoUrl: preset.logoUrl,
    brandKey: preset.key,
    source: 'preset' as const,
  };
}

/**
 * The CSS variables the root layout writes onto `<html>`, covering only what the
 * active preset overrides. `--focus` is deliberately not among them: it is
 * resolved per theme in `globals.css` from `--focus-light`/`--focus-dark`, and an
 * inline value would beat `[data-theme="dark"]`.
 */
export function getBrandCssVars(): Record<string, string> {
  const preset = getBrandPreset();
  const vars: Record<string, string> = {
    '--brand-primary': preset.primary,
    '--brand-primary-light': preset.primaryLight,
    '--brand-accent': preset.accent,
  };
  if (preset.ctaBg) vars['--cta-bg'] = preset.ctaBg;
  if (preset.ctaBgHover) vars['--cta-bg-hover'] = preset.ctaBgHover;
  if (preset.focus) vars['--focus-light'] = preset.focus;
  if (preset.focusDark) vars['--focus-dark'] = preset.focusDark;
  return vars;
}
