'use client';

import React, { Suspense, useEffect, useMemo } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useUIStore } from '@/store/useUIStore';
import { useCreateControlException } from '@/apis/hooks/useControlExceptions';
import { useAuditEntry } from '@/apis/hooks/useAudit';
import { ControlExceptionForm } from '@/components/controlExceptions/ControlExceptionForm';
import { SkeletonPage } from '@/components/common/Skeleton';
import { Icon } from '@/components/ui/Icons';
import { auditActionLabel } from '@/constants/auditVocabulary';
import type { AuditEntry } from '@/types/models';

/** The finding's starting description and document, taken from one audit-trail entry. */
function prefillFromAudit(a: AuditEntry) {
  const actor = a.actorType === 'system' || !a.actorId ? 'System' : a.actor?.name || 'Unknown user';
  const when = new Date(a.occurredAt).toLocaleString('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
  const object = a.objectId ? `\nObject: ${a.objectType} ${a.objectId}` : '';
  const isDocument = a.objectType === 'document' && !!a.objectId;
  return {
    description: `Seen in the audit trail: ${auditActionLabel(a.action)} by ${actor}, ${when}.${object}\nAudit entry #${a.seq}\n\n`,
    // Labelled by id: loading the document for its title would log a view by the auditor.
    documentId: isDocument ? (a.objectId as string) : undefined,
    documentOption: isDocument
      ? {
          value: a.objectId as string,
          label: `Document ${(a.objectId as string).slice(0, 8).toUpperCase()}`,
          hint: 'From the audit entry',
        }
      : undefined,
  };
}

/** Raises a finding as `open`; reporting it to management is a step on its page. */
export default function NewControlExceptionPage() {
  // useSearchParams needs a Suspense boundary above it.
  return (
    <Suspense fallback={<SkeletonPage columns={['Field', 'Value']} rows={4} />}>
      <NewFinding />
    </Suspense>
  );
}

function NewFinding() {
  const router = useRouter();
  const fromAudit = useSearchParams().get('fromAudit') ?? undefined;
  const { setPageTitle } = useUIStore();
  const createException = useCreateControlException();
  const auditEntry = useAuditEntry(fromAudit);
  const prefill = useMemo(
    () => (auditEntry.data ? prefillFromAudit(auditEntry.data) : undefined),
    [auditEntry.data],
  );

  useEffect(() => {
    setPageTitle('Raise finding');
  }, [setPageTitle]);

  // The form reads its starting values once, so wait for the entry before showing it.
  if (fromAudit && auditEntry.isLoading) {
    return <SkeletonPage columns={['Field', 'Value']} rows={4} />;
  }

  return (
    <div>
      <div className="page-head">
        <div>
          <div className="page-title">Raise an audit finding</div>
          <div className="page-sub">Saved as open. You can still edit it until you report it.</div>
        </div>
      </div>
      {fromAudit && auditEntry.isError && (
        <div className="banner warning">
          <Icon name="alert" size={15} />
          <span>The audit entry couldn&apos;t be loaded, so describe the event yourself.</span>
        </div>
      )}
      <ControlExceptionForm
        prefill={prefill}
        submitLabel="Raise finding"
        onCancel={() => (fromAudit ? router.back() : router.push('/control-exceptions'))}
        onSubmit={async (values) => {
          const created = await createException.mutateAsync(values);
          router.push(`/control-exceptions/${created.id}`);
        }}
      />
    </div>
  );
}
