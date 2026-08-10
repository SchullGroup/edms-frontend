'use client';

import React from 'react';
import { useRouter } from 'next/navigation';
import { Icon } from '@/components/ui/Icons';
import { useNavigation } from '@/hooks/useNavigation';

export default function UnauthorizedPage() {
  const router = useRouter();
  const nav = useNavigation();

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        height: '100%',
        padding: '24px',
        textAlign: 'center',
      }}
    >
      <div
        style={{
          width: '64px',
          height: '64px',
          borderRadius: '50%',
          backgroundColor: '#ffebeb',
          color: '#d92d20',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          marginBottom: '24px',
        }}
      >
        <Icon name="alert" size={32} />
      </div>
      <h1 style={{ fontSize: '24px', fontWeight: 600, marginBottom: '8px', color: 'var(--fg)' }}>
        Access Denied
      </h1>
      <p style={{ color: 'var(--fg-sub)', marginBottom: '32px', maxWidth: '400px' }}>
        You do not have the required roles or permissions to view this page. If you believe this is
        an error, please contact your platform administrator.
      </p>
      <div style={{ display: 'flex', gap: '12px' }}>
        <button className="btn btn-secondary" onClick={() => router.back()}>
          Go Back
        </button>
        {nav?.home && (
          <button className="btn btn-primary" onClick={() => router.push(nav.home)}>
            Return to Dashboard
          </button>
        )}
      </div>
    </div>
  );
}
