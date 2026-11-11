'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useStore } from '@/store/useStore';
import { useUIStore } from '@/store/useUIStore';
import { authService, type LoginResponseData } from '@/apis/services/auth.service';
import type { MfaChallenge } from '@/types/models';
import { mfaErrorText, useResendCountdown } from '@/components/security/mfaParts';
import { CodeBoxes } from '@/components/auth/CodeBoxes';
import { useMutation } from '@tanstack/react-query';
import Cookies from 'js-cookie';
import { AuthShell } from '@/components/auth/AuthShell';
import { PasswordInput } from '@/components/auth/PasswordInput';
import { getBrandPreset } from '@/lib/brand';
import {
  PORTAL_BY_KEY,
  fallbackPermissionsForRoles,
  normalizePermission,
  effectivePortal,
} from '@/lib/permissions';

export default function LoginPage() {
  const router = useRouter();
  const { currentUser, setCurrentUser, prefs } = useStore();
  const { addToast } = useUIStore();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  // Redirect if already logged in — by the portal the user's permissions unlock,
  // not by role name. Permissions may not be hydrated yet at this instant, so
  // fall back to the seeded system-role grant approximation.
  useEffect(() => {
    if (currentUser) {
      // The store keeps `currentUser` in localStorage so a reload doesn't bounce a
      // signed-in user out — but it outlives the session it came from. With no
      // `accessToken` cookie there is no session behind it (the proxy deletes the
      // pair when it confirms one is dead), and treating it as one was a dead end:
      // the portal push is bounced straight back here by the proxy while this page
      // returns null for as long as the stale user is set, so the screen stayed
      // blank and there was no way to sign in. Drop it and show the form.
      if (!Cookies.get('accessToken')) {
        setCurrentUser(null);
        return;
      }
      const perms =
        currentUser.permissions && currentUser.permissions.length > 0
          ? currentUser.permissions.map(normalizePermission)
          : fallbackPermissionsForRoles(currentUser.roles);
      const portalKey = effectivePortal(
        perms,
        currentUser.roles,
        currentUser.id,
        prefs?.portalChoice,
      );
      router.push(PORTAL_BY_KEY[portalKey]?.home || '/staff');
    }
    // Only on sign-in, not when the switcher later changes `prefs`.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentUser, router]);

  // Set when the password was right but the account has two-step sign-in on.
  const [mfa, setMfa] = useState<MfaChallenge | null>(null);

  const finishSignIn = (data: LoginResponseData) => {
    setCurrentUser(data.user);
    addToast(`Welcome back, ${data.user.name.split(' ')[0]}`, 'success');
  };

  const loginMutation = useMutation({
    mutationFn: async () => {
      return authService.login({ email, password });
    },
    onSuccess: (data) => {
      if ('mfaRequired' in data) {
        setMfa(data);
        return;
      }
      finishSignIn(data);
    },
    onError: (err: any) => {
      addToast(err.response?.data?.message || 'Login failed. Check your credentials.', 'error');
    },
  });

  const startAgain = () => {
    setMfa(null);
    setPassword('');
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) {
      addToast('Please enter both email and password', 'error');
      return;
    }
    loginMutation.mutate();
  };

  const autofill = (testEmail: string, testPassword = 'password') => {
    setEmail(testEmail);
    setPassword(testPassword);
  };

  // const isDev = process.env.NODE_ENV === 'development';
  // The fixture logins belong to our own deployment, so a white-labelled build
  // never shows them — not even in development.
  const { loginTestAccounts } = getBrandPreset().features;

  if (currentUser) return null;

  if (mfa) {
    return (
      <AuthShell>
        <MfaStep
          key={mfa.mfaToken}
          mfaToken={mfa.mfaToken}
          byEmail={mfa.mfaMethod === 'email'}
          email={email}
          onSignedIn={finishSignIn}
          onStartAgain={startAgain}
        />
      </AuthShell>
    );
  }

  return (
    <AuthShell>
      <div className="page-title mb-1">Sign in</div>
      <p className="text-sm text-muted">Enter your credentials to access your secure portal.</p>

      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <div>
          <label className="mb-2 block text-[13px] font-medium">Email Address</label>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="input w-full"
            placeholder="you@company.com"
            required
          />
        </div>

        <div>
          <label className="mb-2 block text-[13px] font-medium">Password</label>
          <PasswordInput
            value={password}
            onChange={setPassword}
            autoComplete="current-password"
            required
          />
          <div className="mt-2 flex justify-end">
            <Link
              href="/forgot-password"
              className="text-[12.5px] font-medium text-(--focus) hover:underline"
            >
              Forgot password?
            </Link>
          </div>
        </div>

        <button
          type="submit"
          className="btn btn-primary mt-2 w-full justify-center py-3"
          disabled={loginMutation.isPending}
        >
          {loginMutation.isPending ? 'Authenticating...' : 'Sign In securely'}
        </button>
      </form>

      {/* {isDev && loginTestAccounts && ( */}
      {loginTestAccounts && (
        <div className="mt-8 border-t border-(--border) pt-5">
          <div className="mb-3 text-xs font-semibold uppercase text-(--text-soft)">
            Test accounts
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              className="btn btn-secondary text-xs"
              style={{ padding: '6px 12px' }}
              onClick={() => autofill('tjoel+staff_finance@schulltech.com', 'Fixture123!')}
            >
              Staff (Finance)
            </button>
            <button
              className="btn btn-secondary text-xs"
              style={{ padding: '6px 12px' }}
              onClick={() => autofill('tjoel+staff_hr@schulltech.com', 'Fixture123!')}
            >
              Staff (HR)
            </button>
            <button
              className="btn btn-secondary text-xs"
              style={{ padding: '6px 12px' }}
              onClick={() => autofill('tjoel+supervisor_finance@schulltech.com', 'Fixture123!')}
            >
              Supervisor (Finance)
            </button>
            <button
              className="btn btn-secondary text-xs"
              style={{ padding: '6px 12px' }}
              onClick={() => autofill('tjoel+management_ops@schulltech.com', 'Fixture123!')}
            >
              Management (Ops)
            </button>
            <button
              className="btn btn-secondary text-xs"
              style={{ padding: '6px 12px' }}
              onClick={() => autofill('tjoel+clientadmin@schulltech.com', 'Fixture123!')}
            >
              Client Admin
            </button>
            <button
              className="btn btn-secondary text-xs"
              style={{ padding: '6px 12px' }}
              onClick={() => autofill('tjoel+auditor@schulltech.com', 'Fixture123!')}
            >
              Auditor
            </button>
            <button
              className="btn btn-secondary text-xs"
              style={{ padding: '6px 12px' }}
              onClick={() => autofill('tjoel+schulltechadmin@schulltech.com', 'Fixture123!')}
            >
              Platform Admin
            </button>
          </div>
        </div>
      )}
    </AuthShell>
  );
}

/** How long the backend's challenge token lasts (`mfa-challenge.ts`, 5m). */
const CHALLENGE_MS = 5 * 60 * 1000;

/** `t***@domain`, like the backend's `emailMasked`. */
const maskEmail = (email: string) => {
  const [name, domain] = email.trim().split('@');
  return domain ? `${name.slice(0, 1)}***@${domain}` : email;
};

const formatSeconds = (s: number) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;

const svgProps = {
  width: 26,
  height: 26,
  viewBox: '0 0 24 24',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 1.8,
  strokeLinecap: 'round' as const,
  strokeLinejoin: 'round' as const,
  'aria-hidden': true,
};

const STEP_ICON = {
  email: (
    <svg {...svgProps}>
      <rect x="3" y="5" width="18" height="14" rx="2.5" />
      <path d="M3.5 6.5l8.5 6.5 8.5-6.5" />
    </svg>
  ),
  authenticator: (
    <svg {...svgProps}>
      <path d="M12 3l7 3v5c0 4.5-3 8.2-7 10-4-1.8-7-5.5-7-10V6l7-3z" />
      <path d="M9 12l2 2 4-4" />
    </svg>
  ),
  recovery: (
    <svg {...svgProps}>
      <circle cx="8" cy="15" r="4" />
      <path d="M11 12l9-9" />
      <path d="M17 6l3 3" />
    </svg>
  ),
  expired: (
    <svg {...svgProps}>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7v5l3 2" />
    </svg>
  ),
};

function BackToSignIn({ onClick }: { onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="text-btn mb-5 inline-flex items-center gap-1.5 self-start text-[13px] font-medium text-(--side-ink) hover:text-(--ink)"
    >
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
        <path d="M15 18l-6-6 6-6" />
      </svg>
      Back to sign in
    </button>
  );
}

/** The second sign-in step. A full code submits itself; an expired challenge needs the password again. */
function MfaStep({
  mfaToken,
  byEmail,
  email,
  onSignedIn,
  onStartAgain,
}: {
  mfaToken: string;
  /** Email users get a code sent here; app users read it off their phone. */
  byEmail: boolean;
  email: string;
  onSignedIn: (data: LoginResponseData) => void;
  onStartAgain: () => void;
}) {
  const { appName } = getBrandPreset();
  const [useRecovery, setUseRecovery] = useState(false);
  const [code, setCode] = useState('');
  const [recoveryCode, setRecoveryCode] = useState('');
  const [error, setError] = useState('');
  const [wrongCode, setWrongCode] = useState(false);
  const [expired, setExpired] = useState(false);
  const [challengeId, setChallengeId] = useState('');
  const { secondsLeft, restart } = useResendCountdown();

  useEffect(() => {
    const t = window.setTimeout(() => setExpired(true), CHALLENGE_MS);
    return () => window.clearTimeout(t);
  }, []);

  const sendCode = useMutation({
    mutationFn: () => authService.requestLoginOtp(mfaToken),
    onSuccess: (c) => {
      setChallengeId(c.challengeId);
      setCode('');
      setWrongCode(false);
      restart();
    },
    onError: (err: any) => {
      if (err.response?.data?.code === 'MFA_CHALLENGE_INVALID') setExpired(true);
      else setError(mfaErrorText(err, 'Couldn’t send the code. Try again.'));
    },
  });

  // Once only (Strict Mode runs effects twice); a second send would hit the 60 s cooldown.
  const sent = React.useRef(false);
  const { mutate: send } = sendCode;
  useEffect(() => {
    if (!byEmail || sent.current) return;
    sent.current = true;
    send();
  }, [byEmail, send]);

  const verify = useMutation({
    mutationFn: (proof: { code: string } | { recoveryCode: string }) =>
      authService.verifyMfa(
        'recoveryCode' in proof
          ? { mfaToken, recoveryCode: proof.recoveryCode }
          : { mfaToken, code: proof.code, ...(byEmail ? { challengeId } : {}) },
      ),
    onSuccess: onSignedIn,
    onError: (err: any) => {
      if (err.response?.data?.code === 'MFA_CHALLENGE_INVALID') {
        setExpired(true);
        return;
      }
      setError(mfaErrorText(err, 'Couldn’t sign you in. Try again.'));
      if (useRecovery) setRecoveryCode('');
      else {
        setCode('');
        setWrongCode(true);
      }
    },
  });

  const canSubmitCode = code.length === 6 && (!byEmail || !!challengeId);

  const onCodeChange = (next: string) => {
    setCode(next);
    setWrongCode(false);
    setError('');
    if (next.length === 6 && (!byEmail || challengeId) && !verify.isPending) verify.mutate({ code: next });
  };

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (useRecovery) {
      if (recoveryCode.trim()) verify.mutate({ recoveryCode: recoveryCode.trim() });
    } else if (canSubmitCode) {
      verify.mutate({ code });
    }
  };

  const switchMode = () => {
    setUseRecovery((v) => !v);
    setError('');
    setWrongCode(false);
  };

  if (expired) {
    return (
      <div className="flex flex-col">
        <div className="mfa-card">
          <div className="mfa-icon">{STEP_ICON.expired}</div>
          <h2 className="mt-4 text-[24px] font-bold tracking-[-0.01em]">Sign-in timed out</h2>
          <p className="mt-2 text-sm text-muted">
            For your security, the code must be entered within 5 minutes of your password.
          </p>
          <button className="btn btn-primary mt-6 h-12 w-full justify-center" onClick={onStartAgain}>
            Back to sign in
          </button>
        </div>
      </div>
    );
  }

  const icon = useRecovery ? STEP_ICON.recovery : byEmail ? STEP_ICON.email : STEP_ICON.authenticator;
  const heading = useRecovery
    ? 'Use a recovery code'
    : byEmail
      ? 'Check your inbox'
      : 'Enter your verification code';

  return (
    <div className="flex flex-col">
      <BackToSignIn onClick={onStartAgain} />
      <form className="mfa-card" onSubmit={submit} noValidate>
        <div className="mfa-icon">{icon}</div>
        <h2 className="mt-4 text-[24px] font-bold tracking-[-0.01em]">{heading}</h2>
        <p className="mt-2 text-sm leading-relaxed text-muted" style={{ textWrap: 'balance' }}>
          {useRecovery ? (
            'Enter one of the recovery codes you saved. Each works once.'
          ) : byEmail ? (
            <>
              Enter the 6-digit code we sent to{' '}
              <strong className="font-semibold text-(--ink)">{maskEmail(email)}</strong>
            </>
          ) : (
            `Open your authenticator app and enter the 6-digit code for ${appName}.`
          )}
        </p>

        <div className="mt-6 w-full">
          {useRecovery ? (
            <input
              aria-label="Recovery code"
              className="input w-full text-center"
              style={{ height: 48, fontSize: 16, letterSpacing: '0.08em' }}
              autoComplete="off"
              placeholder="xxxxx-xxxxx"
              value={recoveryCode}
              onChange={(e) => {
                setRecoveryCode(e.target.value);
                setError('');
              }}
              aria-invalid={!!error}
              aria-describedby={error ? 'mfa-error' : undefined}
              disabled={verify.isPending}
              autoFocus
            />
          ) : (
            <CodeBoxes
              value={code}
              onChange={onCodeChange}
              invalid={wrongCode}
              disabled={verify.isPending || (byEmail && !challengeId)}
              describedBy={error ? 'mfa-error' : undefined}
            />
          )}
          {error && (
            <div id="mfa-error" role="alert" className="mt-3 text-[13px] text-(--status-overdue)">
              {error}
            </div>
          )}
        </div>

        <button
          type="submit"
          className="btn btn-primary mt-5 h-12 w-full justify-center"
          disabled={verify.isPending || (useRecovery ? !recoveryCode.trim() : !canSubmitCode)}
        >
          {verify.isPending ? (
            <>
              <span className="btn-spinner" aria-hidden /> Verifying…
            </>
          ) : (
            'Verify and sign in'
          )}
        </button>

        {byEmail && !useRecovery && (
          <p className="mt-4 text-[13px] text-muted" aria-live="polite">
            Didn’t get a code?{' '}
            {sendCode.isPending ? (
              <span className="font-medium">Sending…</span>
            ) : secondsLeft > 0 ? (
              <span className="font-medium">Resend in {formatSeconds(secondsLeft)}</span>
            ) : (
              <button
                type="button"
                className="text-btn font-semibold text-(--focus) hover:underline"
                onClick={() => {
                  setError('');
                  sendCode.mutate();
                }}
              >
                Send a new one
              </button>
            )}
          </p>
        )}

        <div className="mt-5 w-full border-t border-(--border) pt-4">
          <button
            type="button"
            className="text-btn text-[13px] font-medium text-(--focus) hover:underline"
            onClick={switchMode}
          >
            {useRecovery
              ? byEmail
                ? 'Use an emailed code instead'
                : 'Use a code from my app instead'
              : 'Use a recovery code'}
          </button>
        </div>
      </form>
    </div>
  );
}
