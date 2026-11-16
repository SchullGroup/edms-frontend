'use client';

import React, { useEffect, useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { authService, type LoginResponseData } from '@/apis/services/auth.service';
import type { MfaSetupStart } from '@/types/models';
import { CodeBoxes } from '@/components/auth/CodeBoxes';
import { AuthenticatorKey, mfaErrorText, useResendCountdown } from '@/components/security/mfaParts';
import { RecoveryCodes } from '@/components/security/RecoveryCodes';
import { getBrandPreset } from '@/lib/brand';
import {
  BackToSignIn,
  STEP_ICON,
  TimedOutCard,
  formatSeconds,
  maskEmail,
} from '@/components/auth/signInParts';

/** Backend `MFA_SETUP_TTL`: the set-up token from the password step lasts 10 minutes. */
const SETUP_MS = 10 * 60 * 1000;

/** The set-up token ran out, or the account changed under it: the password is needed again. */
const EXPIRED_CODES = new Set(['MFA_SETUP_TOKEN_INVALID', 'MFA_SETUP_SESSION_INVALID']);

type Method = 'authenticator' | 'email';
type AppKey = Extract<MfaSetupStart, { method: 'authenticator' }>;
type SetUp = LoginResponseData & { recoveryCodes: string[] };

/** Required two-step set-up after the password: pick a method, prove it, save recovery codes. */
export function MfaSetupStep({
  mfaSetupToken,
  email,
  onSignedIn,
  onStartAgain,
}: {
  mfaSetupToken: string;
  email: string;
  onSignedIn: (data: LoginResponseData) => void;
  onStartAgain: () => void;
}) {
  const { appName } = getBrandPreset();
  const [method, setMethod] = useState<Method | null>(null);
  const [appKey, setAppKey] = useState<AppKey | null>(null);
  const [challengeId, setChallengeId] = useState('');
  const [emailUnavailable, setEmailUnavailable] = useState('');
  const [startError, setStartError] = useState('');
  const [code, setCode] = useState('');
  const [error, setError] = useState('');
  const [wrongCode, setWrongCode] = useState(false);
  const [expired, setExpired] = useState(false);
  const [setUp, setSetUp] = useState<SetUp | null>(null);
  const { secondsLeft, restart } = useResendCountdown();

  useEffect(() => {
    if (setUp) return;
    const t = window.setTimeout(() => setExpired(true), SETUP_MS);
    return () => window.clearTimeout(t);
  }, [setUp]);

  const start = useMutation({
    mutationFn: (m: Method) => authService.startMfaSetup({ mfaSetupToken, method: m }),
    onSuccess: (r) => {
      if (r.method === 'authenticator') {
        setAppKey(r);
        return;
      }
      setChallengeId(r.challengeId);
      setCode('');
      setWrongCode(false);
      restart();
    },
    onError: (err: any, m) => {
      const errCode = err.response?.data?.code;
      if (EXPIRED_CODES.has(errCode)) {
        setExpired(true);
      } else if (m === 'email' && errCode === 'MFA_OTP_NOT_CONFIGURED') {
        setEmailUnavailable(mfaErrorText(err, ''));
        setMethod(null);
      } else {
        setStartError(mfaErrorText(err, 'Couldn’t start set-up. Try again.'));
      }
    },
  });

  const confirm = useMutation({
    mutationFn: (c: string) =>
      authService.confirmMfaSetup({
        mfaSetupToken,
        method: method ?? 'authenticator',
        code: c,
        ...(method === 'email' ? { challengeId } : {}),
      }),
    onSuccess: setSetUp,
    onError: (err: any) => {
      if (EXPIRED_CODES.has(err.response?.data?.code)) {
        setExpired(true);
        return;
      }
      setError(mfaErrorText(err, 'Couldn’t finish set-up. Try again.'));
      setCode('');
      setWrongCode(true);
    },
  });

  const choose = (m: Method) => {
    setMethod(m);
    setStartError('');
    setError('');
    setCode('');
    setWrongCode(false);
    // Reuse what was issued: a new key would void one already scanned, and email has a 60 s cooldown.
    if (m === 'authenticator' ? !appKey : !challengeId) start.mutate(m);
  };

  const ready = method === 'authenticator' ? !!appKey : !!challengeId;
  const canSubmit = code.length === 6 && ready && !confirm.isPending;

  const onCodeChange = (next: string) => {
    setCode(next);
    setWrongCode(false);
    setError('');
    if (next.length === 6 && ready && !confirm.isPending) confirm.mutate(next);
  };

  if (expired) {
    return (
      <TimedOutCard
        message="For your security, set-up must be finished within 10 minutes of your password."
        onStartAgain={onStartAgain}
      />
    );
  }

  if (setUp) {
    return (
      <div className="flex flex-col">
        <div className="mfa-card">
          <div className="mfa-icon">{STEP_ICON.recovery}</div>
          <h2 className="mt-4 text-[24px] font-bold tracking-[-0.01em]">Save your recovery codes</h2>
          <p className="mt-2 mb-5 text-sm leading-relaxed text-muted" style={{ textWrap: 'balance' }}>
            Two-step sign-in is on. If you can&apos;t get a code, each of these signs you in once
            instead. <strong className="font-semibold text-(--ink)">You won&apos;t see them again.</strong>
          </p>
          <RecoveryCodes
            codes={setUp.recoveryCodes}
            email={email}
            doneLabel={`Continue to ${appName}`}
            onDone={() => onSignedIn(setUp)}
          />
        </div>
      </div>
    );
  }

  if (!method) {
    return (
      <div className="flex flex-col">
        <BackToSignIn onClick={onStartAgain} />
        <div className="mfa-card">
          <div className="mfa-icon">{STEP_ICON.setup}</div>
          <h2 className="mt-4 text-[24px] font-bold tracking-[-0.01em]">Set up two-step sign-in</h2>
          <p className="mt-2 text-sm leading-relaxed text-muted" style={{ textWrap: 'balance' }}>
            Your administrator requires a second step when you sign in. Choose how you&apos;ll get
            your 6-digit code.
          </p>
          <div className="mt-6 flex w-full flex-col gap-3">
            <MethodButton
              title="Authenticator app"
              description="A code from an app such as Microsoft Authenticator or Google Authenticator."
              onClick={() => choose('authenticator')}
            />
            <MethodButton
              title="Email"
              description={emailUnavailable || `A code sent to ${maskEmail(email)} each time you sign in.`}
              disabled={!!emailUnavailable}
              onClick={() => choose('email')}
            />
          </div>
        </div>
      </div>
    );
  }

  const byEmail = method === 'email';

  return (
    <div className="flex flex-col">
      <BackToSignIn onClick={() => setMethod(null)} label="Choose another way" />
      <form
        className="mfa-card"
        noValidate
        onSubmit={(e) => {
          e.preventDefault();
          if (canSubmit) confirm.mutate(code);
        }}
      >
        <div className="mfa-icon">{byEmail ? STEP_ICON.email : STEP_ICON.authenticator}</div>
        <h2 className="mt-4 text-[24px] font-bold tracking-[-0.01em]">
          {byEmail ? 'Check your inbox' : 'Add it to your app'}
        </h2>
        <p className="mt-2 text-sm leading-relaxed text-muted" style={{ textWrap: 'balance' }}>
          {byEmail ? (
            start.isPending ? (
              `Sending a code to ${maskEmail(email)}…`
            ) : (
              <>
                Enter the 6-digit code we sent to{' '}
                <strong className="font-semibold text-(--ink)">{maskEmail(email)}</strong>
              </>
            )
          ) : (
            `Scan the QR code with your authenticator app, then enter the 6-digit code it shows for ${appName}.`
          )}
        </p>

        {!byEmail && (
          <div className="mt-5 w-full">
            {appKey ? (
              <AuthenticatorKey secret={appKey.secret} otpauthUri={appKey.otpauthUri} />
            ) : start.isPending ? (
              <div className="caption">Preparing your key…</div>
            ) : null}
          </div>
        )}

        {startError && (
          <div role="alert" className="mt-4 text-[13px] text-(--status-overdue)">
            {startError}
          </div>
        )}

        <div className="mt-6 w-full">
          <CodeBoxes
            value={code}
            onChange={onCodeChange}
            invalid={wrongCode}
            disabled={confirm.isPending || !ready}
            describedBy={error ? 'mfa-setup-error' : undefined}
          />
          {error && (
            <div id="mfa-setup-error" role="alert" className="mt-3 text-[13px] text-(--status-overdue)">
              {error}
            </div>
          )}
        </div>

        <button
          type="submit"
          className="btn btn-primary mt-5 h-12 w-full justify-center"
          disabled={!canSubmit}
        >
          {confirm.isPending ? (
            <>
              <span className="btn-spinner" aria-hidden /> Turning on…
            </>
          ) : (
            'Turn on and continue'
          )}
        </button>

        {byEmail && (
          <p className="mt-4 text-[13px] text-muted" aria-live="polite">
            Didn’t get a code?{' '}
            {start.isPending ? (
              <span className="font-medium">Sending…</span>
            ) : secondsLeft > 0 ? (
              <span className="font-medium">Resend in {formatSeconds(secondsLeft)}</span>
            ) : (
              <button
                type="button"
                className="text-btn font-semibold text-(--focus) hover:underline"
                onClick={() => {
                  setStartError('');
                  setError('');
                  start.mutate('email');
                }}
              >
                Send a new one
              </button>
            )}
          </p>
        )}
      </form>
    </div>
  );
}

function MethodButton({
  title,
  description,
  disabled,
  onClick,
}: {
  title: string;
  description: string;
  disabled?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className="flex w-full items-center gap-3 rounded-[12px] border border-(--border) px-4 py-3 text-left transition-colors hover:border-(--focus) disabled:cursor-not-allowed disabled:opacity-60 disabled:hover:border-(--border)"
    >
      <span className="min-w-0 flex-1">
        <span className="block text-sm font-semibold text-(--ink)">{title}</span>
        <span className="mt-0.5 block text-[12.5px] leading-snug text-muted">{description}</span>
      </span>
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden className="shrink-0 text-(--text-soft)">
        <path d="M9 18l6-6-6-6" />
      </svg>
    </button>
  );
}
