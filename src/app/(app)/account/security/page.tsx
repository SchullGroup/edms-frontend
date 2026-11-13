'use client';

import React, { useEffect } from 'react';
import { useUIStore } from '@/store/useUIStore';
import { useMfaSettings } from '@/apis/hooks/useAuth';
import { SkeletonTable } from '@/components/common/Skeleton';
import { METHOD_LABEL } from '@/components/security/mfaParts';
import type { MfaSettings } from '@/types/models';

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
    </div>
  );
}

function MfaStatus({ settings }: { settings: MfaSettings }) {
  if (!settings.mfaEnabled) {
    return settings.mfaRequired ? (
      <p className="text-sm">
        Your administrator requires two-step sign-in. You&apos;ll set it up the next time you sign
        in, with an authenticator app or a code by email.
      </p>
    ) : (
      <>
        <p className="text-sm">
          Two-step sign-in is off: you sign in with your password only.
        </p>
        <p className="caption mt-2">
          An administrator turns it on for your account. You then set it up the next time you sign
          in, with an authenticator app or a code by email.
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
