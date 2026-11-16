import type { MfaMethod } from '@/types/models';

/** Plain MFA wording, kept free of UI imports so hooks can use it. */
export const METHOD_LABEL: Record<MfaMethod, string> = {
  authenticator: 'Authenticator app',
  email: 'Email',
  sms: 'Text message',
};

const OTP_ERROR_TEXT: Record<string, string> = {
  MFA_OTP_COOLDOWN: 'A code was sent less than a minute ago. Wait a moment, then send a new one.',
  MFA_OTP_RATE_LIMITED: 'Too many codes requested. Try again in an hour, or use a recovery code.',
  MFA_OTP_DELIVERY_FAILED: 'We couldn’t send the code. Try again in a moment.',
  MFA_OTP_NOT_CONFIGURED: 'Email codes aren’t set up on this server yet.',
  MFA_SMS_NOT_CONFIGURED: 'Text-message codes aren’t set up on this server yet.',
  MFA_PHONE_NOT_REGISTERED: 'No phone number is registered for you. Ask your administrator to add one.',
  MFA_LOCKED: 'Too many wrong codes. Wait a few minutes, then try again.',
};

/** The backend's message, reworded for the emailed and texted code errors. */
export const mfaErrorText = (err: any, fallback: string): string => {
  const data = err?.response?.data;
  return OTP_ERROR_TEXT[data?.code] || data?.message || fallback;
};
