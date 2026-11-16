'use client';

import React, { useEffect, useState } from 'react';
import { useUIStore } from '@/store/useUIStore';
import {
  useConfirmOwnPhone,
  useMfaSettings,
  useResendOwnPhoneVerification,
} from '@/apis/hooks/useAuth';
import { SkeletonTable } from '@/components/common/Skeleton';
import { CodeBoxes } from '@/components/auth/CodeBoxes';
import { METHOD_LABEL, mfaErrorText, useResendCountdown } from '@/components/security/mfaParts';
import { formatSeconds } from '@/components/auth/signInParts';
import type { MfaSettings } from '@/types/models';

/** Text messages are offered only with an SMS provider and an admin-registered phone. */
const smsAvailable = (s: MfaSettings) =>
  s.methodOptions.some((o) => o.method === 'sms' && o.available);

/** The ways a required user can choose from at sign-in, as a phrase. */
const setUpChoices = (s: MfaSettings) =>
  smsAvailable(s)
    ? 'with an authenticator app, or a code by email or text message'
    : 'with an authenticator app or a code by email';

/**
 * Two-step sign-in status, read-only. Since backend PRs #71/#72 an administrator requires it,
 * set-up happens at sign-in, and only an administrator resets it; nothing here changes it.
 */
export default function AccountSecurityPage() {
  const { setPageTitle } = useUIStore();
  const { data: settings, isLoading, isError } = useMfaSettings();

  useEffect(() => {
    setPageTitle('Security');
  }, [setPageTitle]);

  return (
    <div>
      <div className="page-head">
        <div>
          <div className="page-title">Security</div>
          <div className="page-sub">How your account is protected when you sign in.</div>
        </div>
      </div>

      <div className="card" style={{ maxWidth: 720 }}>
        <div className="card-head">
          <span className="h3">Two-step sign-in</span>
          {settings && (
            <span className="flex flex-wrap items-center gap-2">
              {settings.mfaRequired && (
                <span className="badge b-status-in-progress">Required by your administrator</span>
              )}
              <span className={`badge ${settings.mfaEnabled ? 'b-status-closed' : 'b-status-pending'}`}>
                {settings.mfaEnabled
                  ? `On · ${METHOD_LABEL[settings.currentMethod ?? 'authenticator']}`
                  : 'Off'}
              </span>
            </span>
          )}
        </div>
        <div className="card-body">
          {isLoading ? (
            <SkeletonTable columns={['']} rows={2} />
          ) : isError || !settings ? (
            <div className="banner error">Couldn&apos;t load your settings. Reload to try again.</div>
          ) : (
            <MfaStatus settings={settings} />
          )}
        </div>
      </div>

      {/* A registered number not yet confirmed: the confirmed one shows as `phoneNumberMasked`. */}
      {settings && smsAvailable(settings) && !settings.phoneNumberMasked && <ConfirmPhoneCard />}
    </div>
  );
}

/** Confirms the mobile number an administrator registered, with the code texted to it. */
function ConfirmPhoneCard() {
  const { addToast } = useUIStore();
  const confirm = useConfirmOwnPhone();
  const resend = useResendOwnPhoneVerification();
  const { secondsLeft, restart } = useResendCountdown();
  const [code, setCode] = useState('');
  const [error, setError] = useState('');
  const [wrongCode, setWrongCode] = useState(false);

  const submit = (c: string) =>
    confirm.mutate(c, {
      onSuccess: () => addToast('Mobile number confirmed', 'success'),
      onError: (err) => {
        setError(mfaErrorText(err, 'Couldn’t confirm your number. Try again.'));
        setWrongCode(true);
        setCode('');
      },
    });

  const sendNew = () => {
    setError('');
    resend.mutate(undefined, {
      onSuccess: () => {
        restart();
        addToast('We texted you a new code', 'success');
      },
      onError: (err) => setError(mfaErrorText(err, 'Couldn’t send the code. Try again.')),
    });
  };

  return (
    <div className="card mt-4" style={{ maxWidth: 720 }}>
      <div className="card-head">
        <span className="h3">Confirm your mobile number</span>
      </div>
      <div className="card-body">
        <p className="text-sm">
          Your administrator registered a mobile number for you. Enter the 6-digit code we texted to
          it.
        </p>
        <form
          className="mt-4"
          style={{ maxWidth: 360 }}
          noValidate
          onSubmit={(e) => {
            e.preventDefault();
            if (code.length === 6 && !confirm.isPending) submit(code);
          }}
        >
          <CodeBoxes
            value={code}
            onChange={(next) => {
              setCode(next);
              setWrongCode(false);
              setError('');
              if (next.length === 6 && !confirm.isPending) submit(next);
            }}
            invalid={wrongCode}
            disabled={confirm.isPending}
            describedBy={error ? 'phone-confirm-error' : undefined}
          />
          {error && (
            <div id="phone-confirm-error" role="alert" className="mt-3 text-[13px] text-(--status-overdue)">
              {error}
            </div>
          )}
          <div className="mt-4 flex flex-wrap items-center gap-3">
            <button
              type="submit"
              className="btn btn-primary"
              disabled={code.length !== 6 || confirm.isPending}
            >
              {confirm.isPending ? 'Confirming…' : 'Confirm number'}
            </button>
            <span className="caption" aria-live="polite">
              {resend.isPending ? (
                'Sending…'
              ) : secondsLeft > 0 ? (
                `Send a new code in ${formatSeconds(secondsLeft)}`
              ) : (
                <button type="button" className="text-btn font-semibold text-(--focus) hover:underline" onClick={sendNew}>
                  Send a new code
                </button>
              )}
            </span>
          </div>
        </form>
      </div>
    </div>
  );
}

function MfaStatus({ settings }: { settings: MfaSettings }) {
  if (!settings.mfaEnabled) {
    return settings.mfaRequired ? (
      <p className="text-sm">
        Your administrator requires two-step sign-in. You&apos;ll set it up the next time you sign
        in, {setUpChoices(settings)}.
      </p>
    ) : (
      <>
        <p className="text-sm">
          Two-step sign-in is off: you sign in with your password only.
        </p>
        <p className="caption mt-2">
          An administrator turns it on for your account. You then set it up the next time you sign
          in, {setUpChoices(settings)}.
        </p>
      </>
    );
  }

  const method = settings.currentMethod ?? 'authenticator';
  return (
    <>
      <p className="text-sm">
        {method === 'email'
          ? `When you sign in, you enter your password and then a 6-digit code we email to ${settings.emailMasked}.`
          : method === 'sms'
            ? `When you sign in, you enter your password and then a 6-digit code we text to ${settings.phoneNumberMasked ?? 'your phone'}.`
            : 'When you sign in, you enter your password and then a 6-digit code from your authenticator app.'}{' '}
        If you can&apos;t get a code, use one of your recovery codes.
      </p>
      <p className="caption mt-2">
        To change how you get your code, or if you&apos;ve lost your recovery codes too, ask an
        administrator to reset two-step sign-in.
        {settings.mfaRequired
          ? ' You’ll then set it up again the next time you sign in.'
          : ' You’ll then sign in with your password only.'}
      </p>
    </>
  );
}
