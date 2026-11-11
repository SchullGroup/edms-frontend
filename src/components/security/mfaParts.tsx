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

/** Six digits only, as the backend's `^\d{6}$` expects. */
export const digitsOnly = (value: string) => value.replace(/\D/g, '').slice(0, 6);

const OTP_ERROR_TEXT: Record<string, string> = {
  MFA_OTP_COOLDOWN: 'A code was sent less than a minute ago. Wait a moment, then send a new one.',
  MFA_OTP_RATE_LIMITED: 'Too many codes requested. Try again in an hour, or use a recovery code.',
  MFA_OTP_DELIVERY_FAILED: 'We couldn’t send the email. Try again in a moment.',
  MFA_OTP_NOT_CONFIGURED: 'Email codes aren’t set up on this server yet.',
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

/** QR code plus the key typed by hand, for adding the account to an authenticator app. */
export function AuthenticatorKey({ secret, otpauthUri }: { secret: string; otpauthUri: string }) {
  const { addToast } = useUIStore();
  const [qrSrc, setQrSrc] = useState('');

  useEffect(() => {
    QRCode.toDataURL(otpauthUri, { margin: 1, width: 200 })
      .then(setQrSrc)
      .catch(() => setQrSrc(''));
  }, [otpauthUri]);

  return (
    <div className="flex flex-wrap items-start gap-6">
      <div style={{ background: '#fff', padding: 8, borderRadius: 8, border: '1px solid var(--border)' }}>
        {qrSrc ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={qrSrc} width={200} height={200} alt="QR code for your authenticator app" />
        ) : (
          <div style={{ width: 200, height: 200 }} />
        )}
      </div>
      <div className="field" style={{ flex: '1 1 240px', minWidth: 0 }}>
        <label>Key for manual entry</label>
        <div className="flex items-center gap-2">
          <code className="kbd" style={{ fontSize: 13, wordBreak: 'break-all' }}>
            {secret.replace(/(.{4})/g, '$1 ').trim()}
          </code>
          <button
            type="button"
            className="btn btn-secondary btn-sm"
            onClick={() =>
              navigator.clipboard
                .writeText(secret)
                .then(() => addToast('Key copied', 'success'))
                .catch(() => addToast('Couldn’t copy. Select the key and copy it.', 'error'))
            }
          >
            Copy
          </button>
        </div>
        <div className="help">Time-based, 6 digits, every 30 seconds.</div>
      </div>
    </div>
  );
}

/** A 6-digit code input with its inline error. */
export function CodeField({
  id,
  label,
  value,
  onChange,
  error,
  autoFocus,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (code: string) => void;
  error?: string;
  autoFocus?: boolean;
}) {
  return (
    <div className="field">
      <label htmlFor={id}>
        {label} <span className="req">*</span>
      </label>
      <input
        id={id}
        className="input"
        style={{ width: 160, letterSpacing: '0.2em' }}
        inputMode="numeric"
        autoComplete="one-time-code"
        placeholder="123456"
        value={value}
        onChange={(e) => onChange(digitsOnly(e.target.value))}
        aria-invalid={!!error}
        aria-describedby={error ? `${id}-error` : undefined}
        autoFocus={autoFocus}
      />
      {error && (
        <div id={`${id}-error`} className="err" role="alert">
          {error}
        </div>
      )}
    </div>
  );
}

/** "Send a new code", disabled while the cooldown runs. */
export function ResendButton({
  secondsLeft,
  pending,
  onClick,
}: {
  secondsLeft: number;
  pending: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      className="text-btn text-[12.5px] font-medium text-(--focus) hover:underline disabled:cursor-default disabled:text-(--text-soft) disabled:no-underline"
      disabled={secondsLeft > 0 || pending}
      onClick={onClick}
    >
      {pending ? 'Sending…' : secondsLeft > 0 ? `Send a new code in ${secondsLeft}s` : 'Send a new code'}
    </button>
  );
}
