import { getBrandPreset } from '@/lib/brand';
import { useImageFallback } from '@/hooks/useImageFallback';

/**
 * Shared split-screen shell for every pre-auth screen (login, forgot
 * password, reset password) — same branded hero on the left, a centred card
 * slot on the right. Only the card's contents differ per screen.
 */
export function AuthShell({ children }: { children: React.ReactNode }) {
  const brand = getBrandPreset();
  const logoUrl = brand.logoUrl.trim();
  const logoText = brand.logoText.trim();
  const { showImage, onImageError } = useImageFallback(logoUrl);

  return (
    <div className="login-wrap">
      <div className="login-hero">
        <div className="relative z-10">
          <div className="flex items-center gap-3">
            {showImage ? (
              <img
                src={logoUrl}
                alt={`${brand.appName} logo`}
                className="brand-logo-image"
                style={{ width: '42px', height: '42px', borderRadius: '12px' }}
                onError={onImageError}
              />
            ) : (
              <div
                className="brand-logo flex items-center justify-center text-white"
                style={{
                  width: '42px',
                  height: '42px',
                  fontSize: '20px',
                  borderRadius: '12px',
                  // The active brand's CTA colour, per theme — not the preset's
                  // raw value, which is absent for a brand that changes nothing.
                  background: 'var(--cta-bg)',
                  boxShadow: '0 4px 18px color-mix(in srgb, var(--focus) 40%, transparent)',
                }}
              >
                {logoText || brand.appName[0]}
              </div>
            )}
            <div>
              <div className="text-[16px] font-extrabold">{brand.appName}</div>
              <div className="text-[11px] uppercase tracking-[.08em] opacity-60">
                Electronic Document Management
              </div>
            </div>
          </div>
          <div className="hero-badge">{brand.heroBadge}</div>
          <h1>{brand.heroTitle}</h1>
          <p>{brand.heroText}</p>
        </div>
        <div className="text-[11px] opacity-55">{brand.footerText}</div>
      </div>

      <div className="login-panel flex flex-col items-center justify-center">
        <div className="login-card w-full max-w-[400px]">{children}</div>
      </div>
    </div>
  );
}
