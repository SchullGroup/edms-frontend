/** `mfa-setup`: an admin now requires MFA; `security-changed`: MFA was enrolled or reset elsewhere. */
export type SessionEndReason = 'expired' | 'mfa-setup' | 'security-changed';

/** Query parameter the proxy adds to `/` when it ends a session for a security reason. */
export const SIGNED_OUT_PARAM = 'signedOut';

// The middleware's 403 has only `FORBIDDEN`; drop the message match once it sends a code of its own.
const MFA_SETUP_MESSAGE = 'MFA setup is required before accessing this account';

/** Why the backend refused this session, from an error response's status and body. Edge-safe. */
export function sessionEndReasonFrom(status: number | undefined, body: any): SessionEndReason | null {
  if (body?.code === 'MFA_SETUP_REQUIRED') return 'mfa-setup';
  if (status === 403 && body?.message === MFA_SETUP_MESSAGE) return 'mfa-setup';
  if (body?.code === 'SESSION_SECURITY_CHANGED') return 'security-changed';
  return null;
}

export const SESSION_END_COPY: Record<
  SessionEndReason,
  { title: string; body: string; action: string }
> = {
  expired: {
    title: 'Session ended',
    body: 'Your session has ended, most likely from being idle for a while. Sign in again to keep going.',
    action: 'Sign in again',
  },
  'mfa-setup': {
    title: 'Two-step sign-in required',
    body: 'Your administrator now requires two-step sign-in for your account. Sign in again to set it up.',
    action: 'Sign in to set it up',
  },
  'security-changed': {
    title: 'Signed out',
    body: 'Your two-step sign-in settings changed, so you were signed out. Sign in again to keep going.',
    action: 'Sign in again',
  },
};

export const isSessionEndReason = (v: string | null): v is SessionEndReason =>
  v === 'expired' || v === 'mfa-setup' || v === 'security-changed';
