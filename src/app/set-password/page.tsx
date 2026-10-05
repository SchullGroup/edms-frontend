'use client';

import React, { Suspense, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useMutation } from '@tanstack/react-query';
import { authService } from '@/apis/services/auth.service';
import { useUIStore } from '@/store/useUIStore';
import { AuthShell } from '@/components/auth/AuthShell';
import { PasswordInput } from '@/components/auth/PasswordInput';

const MIN_LENGTH = 8;

export default function ResetPasswordPage() {
  // useSearchParams needs a Suspense boundary above it — see
  // node_modules/next/dist/docs/01-app/03-api-reference/04-functions/use-search-params.md
  return (
    <Suspense
      fallback={
        <AuthShell>
          <div className="page-title mb-1">Reset password</div>
          <p className="page-sub">Loading…</p>
        </AuthShell>
      }
    >
      <ResetPasswordForm />
    </Suspense>
  );
}

function ResetPasswordForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams.get('token');
  const { addToast } = useUIStore();

  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [done, setDone] = useState(false);

  const resetPasswordMutation = useMutation({
    mutationFn: () => authService.resetPassword({ token: token as string, password: newPassword }),
    onSuccess: () => {
      setDone(true);
      addToast('Password reset. Please sign in.', 'success');
    },
    onError: (err: any) => {
      addToast(
        err.response?.data?.message || 'Could not reset your password. The link may have expired.',
        'error',
      );
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newPassword || !confirmPassword) {
      addToast('Please fill in both password fields', 'error');
      return;
    }
    if (newPassword.length < MIN_LENGTH) {
      addToast(`Password must be at least ${MIN_LENGTH} characters`, 'error');
      return;
    }
    if (newPassword !== confirmPassword) {
      addToast('Passwords do not match', 'error');
      return;
    }
    resetPasswordMutation.mutate();
  };

  if (!token) {
    return (
      <AuthShell>
        <div className="page-title mb-1">Invalid reset link</div>
        <p className="page-sub mb-6">
          This password reset link is missing its token, so it can't be used. Request a new one
          below.
        </p>
        <Link href="/forgot-password" className="btn btn-primary w-full justify-center py-3">
          Request a new link
        </Link>
      </AuthShell>
    );
  }

  if (done) {
    return (
      <AuthShell>
        <div className="page-title mb-1">Password reset</div>
        <p className="page-sub mb-6">
          Your password has been changed. You can now sign in with your new password.
        </p>
        <Link href="/" className="btn btn-primary w-full justify-center py-3">
          Go to sign in
        </Link>
      </AuthShell>
    );
  }

  return (
    <AuthShell>
      <div className="page-title mb-1">Reset password</div>
      <p className="page-sub mb-6">Choose a new password for your account.</p>

      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <div>
          <label className="mb-2 block text-[13px] font-medium">New password</label>
          <PasswordInput
            value={newPassword}
            onChange={setNewPassword}
            autoComplete="new-password"
            required
            autoFocus
          />
          <p className="mt-1.5 text-[12px] text-(--muted)">At least {MIN_LENGTH} characters.</p>
        </div>

        <div>
          <label className="mb-2 block text-[13px] font-medium">Confirm new password</label>
          <PasswordInput
            value={confirmPassword}
            onChange={setConfirmPassword}
            autoComplete="new-password"
            required
          />
        </div>

        <button
          type="submit"
          className="btn btn-primary mt-2 w-full justify-center py-3"
          disabled={resetPasswordMutation.isPending}
        >
          {resetPasswordMutation.isPending ? 'Resetting…' : 'Reset password'}
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
