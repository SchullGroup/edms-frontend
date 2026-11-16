'use client';

import React, { useCallback, useEffect, useState } from 'react';
import QRCode from 'qrcode';
import { useUIStore } from '@/store/useUIStore';
import type { MfaMethod } from '@/types/models';

/** Backend `MFA_OTP_RESEND_COOLDOWN_SECONDS`. */
export const OTP_RESEND_SECONDS = 60;

export const METHOD_LABEL: Record<MfaMethod, string> = {
  authenticator: 'Authenticator app',
  email: 'Email',
  sms: 'Text message',
};

const OTP_ERROR_TEXT: Record<string, string> = {
  MFA_OTP_COOLDOWN: 'A code was sent less than a minute ago. Wait a moment, then send a new one.',
  MFA_OTP_RATE_LIMITED: 'Too many codes requested. Try again in an hour, or use a recovery code.',
  MFA_OTP_DELIVERY_FAILED: 'We couldn’t send the email. Try again in a moment.',
  MFA_OTP_NOT_CONFIGURED: 'Email codes aren’t set up on this server yet.',
  MFA_LOCKED: 'Too many wrong codes. Wait a few minutes, then try again.',
};

/** The backend's message, reworded for the email-code errors. */
export const mfaErrorText = (err: any, fallback: string): string => {
  const data = err?.response?.data;
  return OTP_ERROR_TEXT[data?.code] || data?.message || fallback;
};

/** Seconds until another code may be sent; `restart` after each send. */
export function useResendCountdown() {
  const [until, setUntil] = useState(0);
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    if (until <= now) return;
    const t = window.setTimeout(() => setNow(Date.now()), 1000);
    return () => window.clearTimeout(t);
  }, [until, now]);

  const restart = useCallback(() => {
    const t = Date.now();
    setNow(t);
    setUntil(t + OTP_RESEND_SECONDS * 1000);
  }, []);

  return { secondsLeft: Math.max(0, Math.ceil((until - now) / 1000)), restart };
}

/** QR code with the key typed by hand underneath, for adding the account to an authenticator app. */
export function AuthenticatorKey({ secret, otpauthUri }: { secret: string; otpauthUri: string }) {
  const { addToast } = useUIStore();
  const [qrSrc, setQrSrc] = useState('');

  useEffect(() => {
    QRCode.toDataURL(otpauthUri, { margin: 1, width: 200 })
      .then(setQrSrc)
      .catch(() => setQrSrc(''));
  }, [otpauthUri]);

  return (
    <div className="flex flex-col items-center gap-3">
      <div style={{ background: '#fff', padding: 8, borderRadius: 8, border: '1px solid var(--border)' }}>
        {qrSrc ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={qrSrc} width={168} height={168} alt="QR code for your authenticator app" />
        ) : (
          <div style={{ width: 168, height: 168 }} />
        )}
      </div>
      <div className="flex w-full flex-col items-center gap-1.5">
        <div className="caption">
          Can&apos;t scan it? Type this key instead.{' '}
          <button
            type="button"
            className="text-btn font-semibold text-(--focus) hover:underline"
            onClick={() =>
              navigator.clipboard
                .writeText(secret)
                .then(() => addToast('Key copied', 'success'))
                .catch(() => addToast('Couldn’t copy. Select the key and copy it.', 'error'))
            }
          >
            Copy key
          </button>
        </div>
        <code className="kbd" style={{ fontSize: 12.5, whiteSpace: 'nowrap' }}>
          {secret.replace(/(.{4})/g, '$1 ').trim()}
        </code>
      </div>
    </div>
  );
}
