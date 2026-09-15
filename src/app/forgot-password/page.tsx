'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useMutation } from '@tanstack/react-query';
import { authService } from '@/apis/services/auth.service';
import { useUIStore } from '@/store/useUIStore';
import { AuthShell } from '@/components/auth/AuthShell';
import { Icon } from '@/components/ui/Icons';

export default function ForgotPasswordPage() {
  const { addToast } = useUIStore();
  const [email, setEmail] = useState('');
  const [submitted, setSubmitted] = useState(false);

  const forgotPasswordMutation = useMutation({
    mutationFn: () => authService.forgotPassword(email),
    onSuccess: () => setSubmitted(true),
    onError: (err: any) => {
      addToast(
        err.response?.data?.message || 'Could not send the reset email. Please try again.',
        'error',
      );
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) {
      addToast('Please enter your email address', 'error');
      return;
    }
    forgotPasswordMutation.mutate();
  };

  if (submitted) {
    return (
      <AuthShell>
        <div className="flex flex-col items-center text-center">
          <div
            className="mb-4 flex h-12 w-12 items-center justify-center rounded-full"
            style={{ background: '#E1F4EC', color: '#17714F' }}
          >
            <Icon name="send" size={22} />
          </div>
          <div className="page-title mb-1">Check your email</div>
          <p className="page-sub mb-6">
            If an account exists for <b>{email}</b>, a password reset link is on its way. It may
            take a few minutes to arrive.
          </p>
          <Link href="/" className="text-[13px] font-medium text-(--focus) hover:underline">
            Back to sign in
          </Link>
        </div>
      </AuthShell>
    );
  }

  return (
    <AuthShell>
      <div className="page-title mb-1">Forgot password</div>
      <p className="page-sub mb-6">
        Enter the email address on your account and we'll send you a link to reset your password.
      </p>

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
            autoFocus
          />
        </div>

        <button
          type="submit"
          className="btn btn-primary mt-2 w-full justify-center py-3"
          disabled={forgotPasswordMutation.isPending}
        >
          {forgotPasswordMutation.isPending ? 'Sending…' : 'Send reset link'}
        </button>
      </form>

      <div className="mt-6 text-center">
        <Link href="/" className="text-[12.5px] font-medium text-(--focus) hover:underline">
          Back to sign in
        </Link>
      </div>
    </AuthShell>
  );
}
