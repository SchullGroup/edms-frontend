'use client';

import React, { useEffect, useRef, useState } from 'react';
import { useUIStore } from '@/store/useUIStore';
import {
  useConfirmMfaMethodChange,
  useEnableEmailMfa,
  useEnableMfa,
  useMe,
  useMfaSettings,
  useRequestCurrentMethodOtp,
  useRequestNewMethodOtp,
  useSetupMfa,
  useStartEmailMfa,
  useStartMfaMethodChange,
} from '@/apis/hooks/useAuth';
import { authService, type MfaMethodChange } from '@/apis/services/auth.service';
import { getBrandPreset } from '@/lib/brand';
import { SkeletonTable } from '@/components/common/Skeleton';
import {
  AuthenticatorKey,
  CodeField,
  METHOD_LABEL,
  ResendButton,
  mfaErrorText,
  useResendCountdown,
} from '@/components/security/mfaParts';
import type { MfaMethod, MfaSettings } from '@/types/models';

type Step = 'status' | 'scan' | 'email' | 'change' | 'codes';

/** The methods a user can pick today; SMS isn't offered until the backend sends texts. */
type PickableMethod = Exclude<MfaMethod, 'sms'>;

const isAvailable = (settings: MfaSettings, method: MfaMethod) =>
  settings.methodOptions.some((o) => o.method === method && o.available);

export default function AccountSecurityPage() {
  const { setPageTitle } = useUIStore();
  const { data: settings, isLoading, isError } = useMfaSettings();
  const { data: me } = useMe();
  const [step, setStep] = useState<Step>('status');
  const [recoveryCodes, setRecoveryCodes] = useState<string[]>([]);
  const [codesNote, setCodesNote] = useState('');

  useEffect(() => {
    setPageTitle('Security');
  }, [setPageTitle]);

  const showCodes = (codes: string[], note: string) => {
    setRecoveryCodes(codes);
    setCodesNote(note);
    setStep('codes');
  };

  const current: PickableMethod | null =
    settings?.mfaEnabled && settings.currentMethod !== 'sms'
      ? (settings.currentMethod ?? 'authenticator')
      : null;
  const other: PickableMethod = current === 'email' ? 'authenticator' : 'email';

  return (
    <div>
      <div className="page-head">
        <div>
          <div className="page-title">Security</div>
          <div className="page-sub">Protect your account with a second step at sign-in.</div>
        </div>
      </div>

      <div className="card" style={{ maxWidth: 720 }}>
        <div className="card-head">
          <span className="h3">Two-step sign-in</span>
          {settings && (
            <span className={`badge ${settings.mfaEnabled ? 'b-status-closed' : 'b-status-pending'}`}>
              {settings.mfaEnabled
                ? `On · ${METHOD_LABEL[settings.currentMethod ?? 'authenticator']}`
                : 'Off'}
            </span>
          )}
        </div>
        <div className="card-body">
          {isLoading ? (
            <SkeletonTable columns={['']} rows={2} />
          ) : isError || !settings ? (
            <div className="banner error">Couldn&apos;t load your settings. Reload to try again.</div>
          ) : step === 'scan' ? (
            <ScanStep
              onCancel={() => setStep('status')}
              onEnabled={(codes) => showCodes(codes, 'Two-step sign-in is on.')}
            />
          ) : step === 'email' ? (
            <EmailSetupStep
              emailMasked={settings.emailMasked}
              onCancel={() => setStep('status')}
              onEnabled={(codes) => showCodes(codes, 'Two-step sign-in is on.')}
            />
          ) : step === 'change' && current ? (
            <ChangeMethodStep
              current={current}
              target={other}
              emailMasked={settings.emailMasked}
              onCancel={() => setStep('status')}
              onChanged={(codes) =>
                showCodes(
                  codes,
                  `You now sign in with ${METHOD_LABEL[other].toLowerCase()}. Your old recovery codes no longer work.`,
                )
              }
            />
          ) : step === 'codes' ? (
            <RecoveryCodesStep
              codes={recoveryCodes}
              note={codesNote}
              email={me?.email ?? ''}
              onDone={() => {
                setRecoveryCodes([]);
                setStep('status');
              }}
            />
          ) : current ? (
            <>
              <p className="text-sm">
                {current === 'email'
                  ? `When you sign in, you enter your password and then a 6-digit code we email to ${settings.emailMasked}.`
                  : 'When you sign in, you enter your password and then a 6-digit code from your authenticator app.'}{' '}
                If you can&apos;t get a code, use one of your recovery codes.
              </p>
              <p className="caption mt-2">
                Only an administrator can turn two-step sign-in off. If you lose your recovery codes
                too, ask an administrator to reset it.
              </p>
              {isAvailable(settings, other) && (
                <button className="btn btn-secondary mt-4" onClick={() => setStep('change')}>
                  Switch to {METHOD_LABEL[other].toLowerCase()}
                </button>
              )}
            </>
          ) : (
            <>
              <p className="text-sm">
                Add a 6-digit code to your password. Someone who learns your password still can&apos;t
                sign in without it. Once it&apos;s on, only an administrator can turn it off.
              </p>
              <div className="mt-4 flex flex-col gap-3">
                <MethodOption
                  title="Authenticator app"
                  description="A code from an app such as Microsoft Authenticator or Google Authenticator."
                  onSetUp={() => setStep('scan')}
                />
                <MethodOption
                  title="Email"
                  description={`A code sent to ${settings.emailMasked} each time you sign in.`}
                  unavailable={
                    isAvailable(settings, 'email')
                      ? undefined
                      : 'Email codes aren’t set up on this server yet.'
                  }
                  onSetUp={() => setStep('email')}
                />
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

function MethodOption({
  title,
  description,
  unavailable,
  onSetUp,
}: {
  title: string;
  description: string;
  unavailable?: string;
  onSetUp: () => void;
}) {
  return (
    <div
      className="flex flex-wrap items-center justify-between gap-3"
      style={{ border: '1px solid var(--border)', borderRadius: 8, padding: '12px 16px' }}
    >
      <div style={{ flex: '1 1 260px', minWidth: 0 }}>
        <div className="text-sm font-medium">{title}</div>
        <div className="caption">{unavailable ?? description}</div>
      </div>
      <button className="btn btn-primary btn-sm" disabled={!!unavailable} onClick={onSetUp}>
        Set up
      </button>
    </div>
  );
}

/** Starts enrolment on mount, then confirms it with a code from the app. */
function ScanStep({
  onCancel,
  onEnabled,
}: {
  onCancel: () => void;
  onEnabled: (recoveryCodes: string[]) => void;
}) {
  const setup = useSetupMfa();
  const enable = useEnableMfa();
  const [code, setCode] = useState('');
  const [error, setError] = useState('');

  const { mutate: startSetup } = setup;
  const started = useRef(false);
  useEffect(() => {
    // Once only: each setup replaces the stored secret, so two could leave the QR stale.
    if (started.current) return;
    started.current = true;
    startSetup();
  }, [startSetup]);

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (code.length !== 6) {
      setError('Enter the 6-digit code from your app.');
      return;
    }
    setError('');
    enable.mutate(code, {
      onSuccess: (data) => onEnabled(data.recoveryCodes),
      onError: (err) => setError(mfaErrorText(err, 'That code is not valid.')),
    });
  };

  if (setup.isIdle || setup.isPending) return <div className="caption">Preparing your key…</div>;
  if (setup.isError || !setup.data) {
    return (
      <>
        <div className="banner error">{mfaErrorText(setup.error, 'Couldn’t start setup.')}</div>
        <button className="btn btn-secondary" onClick={onCancel}>
          Back
        </button>
      </>
    );
  }

  return (
    <form onSubmit={submit}>
      <ol className="text-sm mb-4" style={{ listStyle: 'decimal', paddingLeft: 20 }}>
        <li>Open your authenticator app and add an account.</li>
        <li className="mt-1">Scan this QR code, or type the key.</li>
        <li className="mt-1">Enter the 6-digit code the app shows.</li>
      </ol>
      <AuthenticatorKey secret={setup.data.secret} otpauthUri={setup.data.otpauthUri} />
      <CodeField
        id="mfa-enable-code"
        label="Code from your app"
        value={code}
        onChange={setCode}
        error={error}
        autoFocus
      />
      <div className="flex gap-2">
        <button type="submit" className="btn btn-primary" disabled={enable.isPending}>
          {enable.isPending ? 'Checking…' : 'Turn on'}
        </button>
        <button type="button" className="btn btn-secondary" onClick={onCancel}>
          Cancel
        </button>
      </div>
    </form>
  );
}

/** Emails a code on mount; entering it turns email codes on. */
function EmailSetupStep({
  emailMasked,
  onCancel,
  onEnabled,
}: {
  emailMasked: string;
  onCancel: () => void;
  onEnabled: (recoveryCodes: string[]) => void;
}) {
  const send = useStartEmailMfa();
  const enable = useEnableEmailMfa();
  const { secondsLeft, restart } = useResendCountdown();
  const [challengeId, setChallengeId] = useState('');
  const [code, setCode] = useState('');
  const [error, setError] = useState('');

  const sendCode = () => {
    setError('');
    send.mutate(undefined, {
      onSuccess: (c) => {
        setChallengeId(c.challengeId);
        setCode('');
        restart();
      },
      onError: (err) => setError(mfaErrorText(err, 'Couldn’t send the code.')),
    });
  };

  const started = useRef(false);
  useEffect(() => {
    if (started.current) return;
    started.current = true;
    sendCode();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (code.length !== 6) {
      setError('Enter the 6-digit code from the email.');
      return;
    }
    setError('');
    enable.mutate(
      { challengeId, code },
      {
        onSuccess: (data) => onEnabled(data.recoveryCodes),
        onError: (err) => {
          setError(mfaErrorText(err, 'That code is not valid.'));
          setCode('');
        },
      },
    );
  };

  return (
    <form onSubmit={submit}>
      <p className="text-sm mb-4">
        {send.isPending && !challengeId
          ? `Sending a code to ${emailMasked}…`
          : `We sent a 6-digit code to ${emailMasked}. It works for 5 minutes.`}
      </p>
      <CodeField
        id="mfa-email-code"
        label="Code from the email"
        value={code}
        onChange={setCode}
        error={error}
        autoFocus
      />
      <div className="mb-4">
        <ResendButton secondsLeft={secondsLeft} pending={send.isPending} onClick={sendCode} />
      </div>
      <div className="flex gap-2">
        <button
          type="submit"
          className="btn btn-primary"
          disabled={enable.isPending || !challengeId}
        >
          {enable.isPending ? 'Checking…' : 'Turn on'}
        </button>
        <button type="button" className="btn btn-secondary" onClick={onCancel}>
          Cancel
        </button>
      </div>
    </form>
  );
}

/** Proves the current method, then sets up the new one; the old one works until the end. */
function ChangeMethodStep({
  current,
  target,
  emailMasked,
  onCancel,
  onChanged,
}: {
  current: PickableMethod;
  target: PickableMethod;
  emailMasked: string;
  onCancel: () => void;
  onChanged: (recoveryCodes: string[]) => void;
}) {
  const [change, setChange] = useState<MfaMethodChange | null>(null);

  const cancel = () => {
    // Best effort: an unfinished change expires by itself after 5 minutes.
    if (change) authService.cancelMfaMethodChange(change.changeId).catch(() => {});
    onCancel();
  };

  return change ? (
    <ConfirmNewMethod change={change} target={target} emailMasked={emailMasked} onCancel={cancel} onChanged={onChanged} />
  ) : (
    <ProveCurrentMethod
      current={current}
      target={target}
      emailMasked={emailMasked}
      onCancel={cancel}
      onStarted={setChange}
    />
  );
}

function ProveCurrentMethod({
  current,
  target,
  emailMasked,
  onCancel,
  onStarted,
}: {
  current: PickableMethod;
  target: PickableMethod;
  emailMasked: string;
  onCancel: () => void;
  onStarted: (change: MfaMethodChange) => void;
}) {
  const sendCurrent = useRequestCurrentMethodOtp();
  const start = useStartMfaMethodChange();
  const { secondsLeft, restart } = useResendCountdown();
  const [password, setPassword] = useState('');
  const [useRecovery, setUseRecovery] = useState(false);
  const [code, setCode] = useState('');
  const [recoveryCode, setRecoveryCode] = useState('');
  const [challengeId, setChallengeId] = useState('');
  const [error, setError] = useState('');
  const needsEmailCode = current === 'email' && !useRecovery;

  const sendCode = () => {
    setError('');
    sendCurrent.mutate(password || undefined, {
      onSuccess: (c) => {
        setChallengeId(c.challengeId);
        setCode('');
        restart();
      },
      onError: (err) => setError(mfaErrorText(err, 'Couldn’t send the code.')),
    });
  };

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (useRecovery ? !recoveryCode.trim() : code.length !== 6) {
      setError(useRecovery ? 'Enter a recovery code.' : 'Enter the 6-digit code.');
      return;
    }
    setError('');
    start.mutate(
      {
        method: target,
        ...(password ? { password } : {}),
        ...(useRecovery
          ? { recoveryCode: recoveryCode.trim() }
          : { code, ...(needsEmailCode ? { challengeId } : {}) }),
      },
      {
        onSuccess: onStarted,
        onError: (err) => {
          setError(mfaErrorText(err, 'Couldn’t check that.'));
          setCode('');
        },
      },
    );
  };

  return (
    <form onSubmit={submit} style={{ maxWidth: 420 }}>
      <p className="text-sm mb-4">
        Confirm it&apos;s you before switching to {METHOD_LABEL[target].toLowerCase()}. Your current
        method keeps working until the switch is finished.
      </p>
      <div className="field">
        <label htmlFor="mfa-change-password">Password</label>
        <input
          id="mfa-change-password"
          type="password"
          className="input w-full"
          autoComplete="current-password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />
        <div className="help">Leave empty only if you sign in with Active Directory.</div>
      </div>

      {useRecovery ? (
        <div className="field">
          <label htmlFor="mfa-change-recovery">
            Recovery code <span className="req">*</span>
          </label>
          <input
            id="mfa-change-recovery"
            className="input w-full"
            autoComplete="off"
            placeholder="xxxxx-xxxxx"
            value={recoveryCode}
            onChange={(e) => setRecoveryCode(e.target.value)}
          />
        </div>
      ) : needsEmailCode && !challengeId ? (
        <div className="field">
          <button
            type="button"
            className="btn btn-secondary"
            disabled={sendCurrent.isPending}
            onClick={sendCode}
          >
            {sendCurrent.isPending ? 'Sending…' : `Email a code to ${emailMasked}`}
          </button>
        </div>
      ) : (
        <>
          <CodeField
            id="mfa-change-current-code"
            label={needsEmailCode ? `Code sent to ${emailMasked}` : 'Code from your app'}
            value={code}
            onChange={setCode}
            autoFocus
          />
          {needsEmailCode && (
            <div className="mb-4">
              <ResendButton secondsLeft={secondsLeft} pending={sendCurrent.isPending} onClick={sendCode} />
            </div>
          )}
        </>
      )}

      <button
        type="button"
        className="text-btn text-[12.5px] font-medium text-(--focus) hover:underline"
        onClick={() => {
          setUseRecovery((v) => !v);
          setError('');
        }}
      >
        {useRecovery
          ? current === 'email'
            ? 'Use an emailed code instead'
            : 'Use a code from my app instead'
          : 'Use a recovery code instead'}
      </button>

      {error && (
        <div className="banner error mt-4" role="alert">
          {error}
        </div>
      )}

      <div className="mt-4 flex gap-2">
        <button
          type="submit"
          className="btn btn-primary"
          disabled={start.isPending || (needsEmailCode && !challengeId)}
        >
          {start.isPending ? 'Checking…' : 'Continue'}
        </button>
        <button type="button" className="btn btn-secondary" onClick={onCancel}>
          Cancel
        </button>
      </div>
    </form>
  );
}

function ConfirmNewMethod({
  change,
  target,
  emailMasked,
  onCancel,
  onChanged,
}: {
  change: MfaMethodChange;
  target: PickableMethod;
  emailMasked: string;
  onCancel: () => void;
  onChanged: (recoveryCodes: string[]) => void;
}) {
  const sendNew = useRequestNewMethodOtp();
  const confirm = useConfirmMfaMethodChange();
  const { secondsLeft, restart } = useResendCountdown();
  const [challengeId, setChallengeId] = useState('');
  const [code, setCode] = useState('');
  const [error, setError] = useState('');

  const sendCode = () => {
    setError('');
    sendNew.mutate(change.changeId, {
      onSuccess: (c) => {
        setChallengeId(c.challengeId);
        setCode('');
        restart();
      },
      onError: (err) => setError(mfaErrorText(err, 'Couldn’t send the code.')),
    });
  };

  const started = useRef(false);
  useEffect(() => {
    if (target !== 'email' || started.current) return;
    started.current = true;
    sendCode();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [target]);

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (code.length !== 6) {
      setError('Enter the 6-digit code.');
      return;
    }
    setError('');
    confirm.mutate(
      { changeId: change.changeId, code, ...(target === 'email' ? { challengeId } : {}) },
      {
        onSuccess: (data) => onChanged(data.recoveryCodes),
        onError: (err) => {
          setError(mfaErrorText(err, 'That code is not valid.'));
          setCode('');
        },
      },
    );
  };

  return (
    <form onSubmit={submit}>
      {target === 'authenticator' && change.setup ? (
        <>
          <ol className="text-sm mb-4" style={{ listStyle: 'decimal', paddingLeft: 20 }}>
            <li>Open your authenticator app and add an account.</li>
            <li className="mt-1">Scan this QR code, or type the key.</li>
            <li className="mt-1">Enter the 6-digit code the app shows.</li>
          </ol>
          <AuthenticatorKey secret={change.setup.secret} otpauthUri={change.setup.otpauthUri} />
        </>
      ) : (
        <p className="text-sm mb-4">
          {sendNew.isPending && !challengeId
            ? `Sending a code to ${emailMasked}…`
            : `We sent a 6-digit code to ${emailMasked}. It works for 5 minutes.`}
        </p>
      )}
      <CodeField
        id="mfa-change-new-code"
        label={target === 'email' ? 'Code from the email' : 'Code from your app'}
        value={code}
        onChange={setCode}
        error={error}
        autoFocus
      />
      {target === 'email' && (
        <div className="mb-4">
          <ResendButton secondsLeft={secondsLeft} pending={sendNew.isPending} onClick={sendCode} />
        </div>
      )}
      <p className="caption mb-4">Finish within 5 minutes, or start again.</p>
      <div className="flex gap-2">
        <button
          type="submit"
          className="btn btn-primary"
          disabled={confirm.isPending || (target === 'email' && !challengeId)}
        >
          {confirm.isPending ? 'Checking…' : `Switch to ${METHOD_LABEL[target].toLowerCase()}`}
        </button>
        <button type="button" className="btn btn-secondary" onClick={onCancel}>
          Cancel
        </button>
      </div>
    </form>
  );
}

/** Shown once, straight after enabling or switching. Leaving needs "I've saved these". */
function RecoveryCodesStep({
  codes,
  note,
  email,
  onDone,
}: {
  codes: string[];
  note: string;
  email: string;
  onDone: () => void;
}) {
  const { addToast } = useUIStore();
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    if (saved) return;
    const warn = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [saved]);

  const asText = () =>
    [
      `${getBrandPreset().appName} recovery codes${email ? ` for ${email}` : ''}`,
      `Created ${new Date().toLocaleString()}. Each code works once.`,
      '',
      ...codes,
      '',
    ].join('\n');

  const download = () => {
    const url = URL.createObjectURL(new Blob([asText()], { type: 'text/plain' }));
    const a = document.createElement('a');
    a.href = url;
    a.download = 'recovery-codes.txt';
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <>
      <div className="banner success">{note}</div>
      <p className="text-sm">
        Save these recovery codes somewhere safe. If you can&apos;t get a code, each one signs you in
        once in its place. <strong>You won&apos;t see them again.</strong>
      </p>

      <ul
        className="mt-4 grid grid-cols-2 gap-x-6 gap-y-1"
        aria-label="Recovery codes"
        style={{
          fontFamily: '"Cascadia Code", Consolas, monospace',
          fontSize: 14,
          background: 'var(--surface)',
          border: '1px solid var(--border)',
          borderRadius: 8,
          padding: '12px 16px',
          maxWidth: 360,
        }}
      >
        {codes.map((c) => (
          <li key={c}>{c}</li>
        ))}
      </ul>

      <div className="mt-4 flex flex-wrap gap-2">
        <button
          className="btn btn-secondary"
          onClick={() =>
            navigator.clipboard
              .writeText(codes.join('\n'))
              .then(() => addToast('Recovery codes copied', 'success'))
              .catch(() => addToast('Couldn’t copy. Download them instead.', 'error'))
          }
        >
          Copy
        </button>
        <button className="btn btn-secondary" onClick={download}>
          Download .txt
        </button>
      </div>

      <label className="mt-4 flex items-center gap-2 text-sm" style={{ cursor: 'pointer' }}>
        <input type="checkbox" checked={saved} onChange={(e) => setSaved(e.target.checked)} />
        I&apos;ve saved these codes
      </label>
      <button className="btn btn-primary mt-4" disabled={!saved} onClick={onDone}>
        Done
      </button>
    </>
  );
}
