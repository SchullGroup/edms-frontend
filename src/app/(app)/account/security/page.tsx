'use client';

import React, { useEffect, useState } from 'react';
import QRCode from 'qrcode';
import { useUIStore } from '@/store/useUIStore';
import { useDisableMfa, useEnableMfa, useMe, useSetupMfa } from '@/apis/hooks/useAuth';
import { getBrandPreset } from '@/lib/brand';
import { SkeletonTable } from '@/components/common/Skeleton';

type Step = 'status' | 'scan' | 'codes' | 'disable';

const errorText = (err: any, fallback: string): string =>
  err?.response?.data?.message || fallback;

/** Six digits only, as the backend's `^\d{6}$` expects. */
const digitsOnly = (value: string) => value.replace(/\D/g, '').slice(0, 6);

export default function AccountSecurityPage() {
  const { setPageTitle } = useUIStore();
  const { data: me, isLoading, isError } = useMe();
  const [step, setStep] = useState<Step>('status');
  const [recoveryCodes, setRecoveryCodes] = useState<string[]>([]);

  useEffect(() => {
    setPageTitle('Security');
  }, [setPageTitle]);

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
          {me && (
            <span className={`badge ${me.mfaEnabled ? 'b-status-closed' : 'b-status-pending'}`}>
              {me.mfaEnabled ? 'On' : 'Off'}
            </span>
          )}
        </div>
        <div className="card-body">
          {isLoading ? (
            <SkeletonTable columns={['']} rows={2} />
          ) : isError || !me ? (
            <div className="banner error">Couldn&apos;t load your account. Reload to try again.</div>
          ) : step === 'scan' ? (
            <ScanStep
              onCancel={() => setStep('status')}
              onEnabled={(codes) => {
                setRecoveryCodes(codes);
                setStep('codes');
              }}
            />
          ) : step === 'codes' ? (
            <RecoveryCodesStep
              codes={recoveryCodes}
              email={me.email}
              onDone={() => {
                setRecoveryCodes([]);
                setStep('status');
              }}
            />
          ) : step === 'disable' ? (
            <DisableStep onCancel={() => setStep('status')} onDisabled={() => setStep('status')} />
          ) : me.mfaEnabled ? (
            <>
              <p className="text-sm">
                When you sign in, you enter your password and then a 6-digit code from your
                authenticator app. If you lose your phone, use one of your recovery codes.
              </p>
              <button className="btn btn-secondary mt-4" onClick={() => setStep('disable')}>
                Turn off
              </button>
            </>
          ) : (
            <>
              <p className="text-sm">
                Add a 6-digit code from an authenticator app (such as Microsoft Authenticator or
                Google Authenticator) to your password. Someone who learns your password still
                can&apos;t sign in without your phone.
              </p>
              <button className="btn btn-primary mt-4" onClick={() => setStep('scan')}>
                Set up
              </button>
            </>
          )}
        </div>
      </div>
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
  const [qrSrc, setQrSrc] = useState('');
  const [code, setCode] = useState('');
  const [error, setError] = useState('');
  const { addToast } = useUIStore();

  const { mutate: startSetup } = setup;
  const started = React.useRef(false);
  useEffect(() => {
    // Once only: each setup replaces the stored secret, so two could leave the QR stale.
    if (started.current) return;
    started.current = true;
    startSetup();
  }, [startSetup]);

  const otpauthUri = setup.data?.otpauthUri;
  useEffect(() => {
    if (!otpauthUri) return;
    QRCode.toDataURL(otpauthUri, { margin: 1, width: 200 })
      .then(setQrSrc)
      .catch(() => setQrSrc(''));
  }, [otpauthUri]);

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (code.length !== 6) {
      setError('Enter the 6-digit code from your app.');
      return;
    }
    setError('');
    enable.mutate(code, {
      onSuccess: (data) => onEnabled(data.recoveryCodes),
      onError: (err) => setError(errorText(err, 'That code is not valid.')),
    });
  };

  if (setup.isIdle || setup.isPending) return <div className="caption">Preparing your key…</div>;
  if (setup.isError || !setup.data) {
    return (
      <>
        <div className="banner error">{errorText(setup.error, 'Couldn’t start setup.')}</div>
        <button className="btn btn-secondary" onClick={onCancel}>
          Back
        </button>
      </>
    );
  }

  const { secret } = setup.data;
  return (
    <form onSubmit={submit}>
      <ol className="text-sm" style={{ listStyle: 'decimal', paddingLeft: 20 }}>
        <li>Open your authenticator app and add an account.</li>
        <li className="mt-1">Scan this QR code, or type the key below.</li>
        <li className="mt-1">Enter the 6-digit code the app shows.</li>
      </ol>

      <div className="mt-4 flex flex-wrap items-start gap-6">
        <div
          style={{ background: '#fff', padding: 8, borderRadius: 8, border: '1px solid var(--border)' }}
        >
          {qrSrc ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={qrSrc} width={200} height={200} alt="QR code for your authenticator app" />
          ) : (
            <div style={{ width: 200, height: 200 }} />
          )}
        </div>

        <div style={{ flex: '1 1 240px', minWidth: 0 }}>
          <div className="field">
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

          <div className="field">
            <label htmlFor="mfa-enable-code">
              Code from your app <span className="req">*</span>
            </label>
            <input
              id="mfa-enable-code"
              className="input"
              style={{ width: 160, letterSpacing: '0.2em' }}
              inputMode="numeric"
              autoComplete="one-time-code"
              placeholder="123456"
              value={code}
              onChange={(e) => setCode(digitsOnly(e.target.value))}
              aria-invalid={!!error}
              aria-describedby={error ? 'mfa-enable-error' : undefined}
              autoFocus
            />
            {error && (
              <div id="mfa-enable-error" className="err" role="alert">
                {error}
              </div>
            )}
          </div>

          <div className="flex gap-2">
            <button type="submit" className="btn btn-primary" disabled={enable.isPending}>
              {enable.isPending ? 'Checking…' : 'Turn on'}
            </button>
            <button type="button" className="btn btn-secondary" onClick={onCancel}>
              Cancel
            </button>
          </div>
        </div>
      </div>
    </form>
  );
}

/** Shown once, straight after enabling. Leaving needs "I've saved these". */
function RecoveryCodesStep({
  codes,
  email,
  onDone,
}: {
  codes: string[];
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
      `${getBrandPreset().appName} recovery codes for ${email}`,
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
      <div className="banner success">Two-step sign-in is on.</div>
      <p className="text-sm">
        Save these recovery codes somewhere safe. If you lose your phone, each one signs you in once
        in place of a code. <strong>You won&apos;t see them again.</strong>
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

function DisableStep({ onCancel, onDisabled }: { onCancel: () => void; onDisabled: () => void }) {
  const disable = useDisableMfa();
  const { addToast } = useUIStore();
  const [password, setPassword] = useState('');
  const [useRecovery, setUseRecovery] = useState(false);
  const [code, setCode] = useState('');
  const [recoveryCode, setRecoveryCode] = useState('');
  const [error, setError] = useState('');

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (useRecovery ? !recoveryCode.trim() : code.length !== 6) {
      setError(useRecovery ? 'Enter a recovery code.' : 'Enter the 6-digit code from your app.');
      return;
    }
    setError('');
    disable.mutate(
      {
        ...(password ? { password } : {}),
        ...(useRecovery ? { recoveryCode: recoveryCode.trim() } : { code }),
      },
      {
        onSuccess: () => {
          addToast('Two-step sign-in is off', 'success');
          onDisabled();
        },
        onError: (err) => setError(errorText(err, 'Couldn’t turn it off.')),
      },
    );
  };

  return (
    <form onSubmit={submit} style={{ maxWidth: 360 }}>
      <p className="text-sm mb-4">
        Confirm it&apos;s you. After this, signing in needs only your password.
      </p>
      <div className="field">
        <label htmlFor="mfa-disable-password">Password</label>
        <input
          id="mfa-disable-password"
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
          <label htmlFor="mfa-disable-recovery">
            Recovery code <span className="req">*</span>
          </label>
          <input
            id="mfa-disable-recovery"
            className="input w-full"
            autoComplete="off"
            placeholder="xxxxx-xxxxx"
            value={recoveryCode}
            onChange={(e) => setRecoveryCode(e.target.value)}
          />
        </div>
      ) : (
        <div className="field">
          <label htmlFor="mfa-disable-code">
            Code from your app <span className="req">*</span>
          </label>
          <input
            id="mfa-disable-code"
            className="input"
            style={{ width: 160, letterSpacing: '0.2em' }}
            inputMode="numeric"
            autoComplete="one-time-code"
            placeholder="123456"
            value={code}
            onChange={(e) => setCode(digitsOnly(e.target.value))}
          />
        </div>
      )}
      <button
        type="button"
        className="text-[12.5px] font-medium text-(--focus) hover:underline"
        onClick={() => {
          setUseRecovery((v) => !v);
          setError('');
        }}
      >
        {useRecovery ? 'Use a code from my app instead' : 'Use a recovery code instead'}
      </button>

      {error && (
        <div className="banner error mt-4" role="alert">
          {error}
        </div>
      )}

      <div className="mt-4 flex gap-2">
        <button type="submit" className="btn btn-danger" disabled={disable.isPending}>
          {disable.isPending ? 'Turning off…' : 'Turn off'}
        </button>
        <button type="button" className="btn btn-secondary" onClick={onCancel}>
          Cancel
        </button>
      </div>
    </form>
  );
}
