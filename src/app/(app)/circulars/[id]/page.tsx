'use client';

import React, { use, useEffect } from 'react';
import Link from 'next/link';
import { useUIStore } from '@/store/useUIStore';
import { useAcknowledgeCircular, useCircularInboxItem } from '@/apis/hooks/useCirculars';
import { ConfBadge, UrgBadge } from '@/components/ui/Badges';
import { Icon } from '@/components/ui/Icons';
import { ErrorMessage } from '@/components/common/ErrorMessage';
import { Skeleton, SkeletonText } from '@/components/common/Skeleton';
import { CircularAttachmentList } from '@/components/circulars/CircularAttachmentList';
import { AckStateBadge, circularReference } from '@/components/circulars/circularLabels';
import { fmtDate, fmtDateTime } from '@/utils/helpers';

/**
 * Reading a circular you were sent. The backend's circular notifications
 * (published, reminder) link here. Opening it records the read receipt.
 */
export default function CircularReaderPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { setPageTitle } = useUIStore();
  const { data: c, isLoading, isError, error, refetch } = useCircularInboxItem(id);
  const acknowledge = useAcknowledgeCircular();

  useEffect(() => {
    setPageTitle('Circular');
  }, [setPageTitle]);

  if (isLoading) return <ReaderSkeleton />;

  if (isError || !c) {
    const status = (error as any)?.response?.status;
    return (
      <div>
        <BackLink />
        <ErrorMessage
          message={
            status === 404
              ? "This circular isn't available. It may have been withdrawn, or it wasn't sent to you."
              : 'Failed to load this circular.'
          }
          retry={status === 404 ? undefined : () => refetch()}
        />
      </div>
    );
  }

  const inForce = c.status === 'published';
  const canAcknowledge = c.requiresAcknowledgement && !c.receipt.acknowledgedAt && inForce;
  const overdue =
    canAcknowledge && !!c.acknowledgementDueAt && new Date(c.acknowledgementDueAt) < new Date();

  return (
    <div style={{ maxWidth: 860 }}>
      <BackLink />

      {c.supersededBy && (
        <div className="card card-pad mb-4" role="note">
          <b>This version has been replaced.</b>{' '}
          <Link href={`/circulars/${c.supersededBy.id}`}>
            Read version {c.supersededBy.versionNumber}
          </Link>
          {c.requiresAcknowledgement ? ' — that is the one to acknowledge.' : '.'}
        </div>
      )}
      {c.status === 'expired' && !c.supersededBy && (
        <div className="card card-pad mb-4" role="note">
          This circular expired{c.expiresAt ? ` on ${fmtDate(c.expiresAt)}` : ''}.
        </div>
      )}

      <div className="page-head" style={{ marginBottom: 14 }}>
        <div style={{ minWidth: 0 }}>
          <div className="caption mb-2">
            {circularReference(c)}
            {c.category ? ` · ${c.category}` : ''}
          </div>
          <div className="page-title">{c.title}</div>
          <div className="page-sub">
            Published {fmtDate(c.publishedAt)}
            {c.publisher?.name ? ` by ${c.publisher.name}` : ''}
            {c.department?.name ? ` · ${c.department.name}` : ''}
            {c.expiresAt && inForce ? ` · in force until ${fmtDate(c.expiresAt)}` : ''}
          </div>
        </div>
        <div className="flex gap-2 flex-wrap items-center">
          <ConfBadge level={c.confidentiality} />
          {c.urgency !== 'normal' && <UrgBadge level={c.urgency} />}
        </div>
      </div>

      <div className="card card-pad mb-4">
        <div style={{ whiteSpace: 'pre-wrap', lineHeight: 1.7, fontSize: 14 }}>{c.body}</div>
      </div>

      <CircularAttachmentList attachments={c.attachments} />

      {c.requiresAcknowledgement && (
        <div
          className="card card-pad flex justify-between items-center flex-wrap gap-3"
          style={overdue ? { boxShadow: 'inset 3px 0 0 var(--status-overdue)' } : undefined}
        >
          <div>
            {c.receipt.acknowledgedAt ? (
              <>
                <div className="h3">You acknowledged this circular</div>
                <div className="caption">{fmtDateTime(c.receipt.acknowledgedAt)}</div>
              </>
            ) : canAcknowledge ? (
              <>
                <div className="h3">Your acknowledgement is required</div>
                <div className="caption">
                  {c.acknowledgementDueAt
                    ? `${overdue ? 'Was due' : 'Due'} ${fmtDateTime(c.acknowledgementDueAt)}. `
                    : ''}
                  Acknowledging confirms you have read and understood it.
                </div>
              </>
            ) : (
              <>
                <div className="h3">No longer open for acknowledgement</div>
                <div className="caption">
                  {c.status === 'superseded'
                    ? 'Acknowledge the newer version instead.'
                    : 'This circular is no longer in force.'}
                </div>
              </>
            )}
          </div>
          {canAcknowledge ? (
            <button
              className="btn btn-accent"
              disabled={acknowledge.isPending}
              onClick={() => acknowledge.mutate(c.id)}
            >
              {acknowledge.isPending && <span className="btn-spinner" aria-hidden="true" />}
              <Icon name="check" size={14} /> I have read and understood this
            </button>
          ) : (
            <AckStateBadge
              requiresAcknowledgement={c.requiresAcknowledgement}
              acknowledgedAt={c.receipt.acknowledgedAt}
            />
          )}
        </div>
      )}
    </div>
  );
}

function BackLink() {
  return (
    <Link
      href="/circulars"
      className="caption flex items-center gap-1 mb-4"
      style={{ width: 'fit-content' }}
    >
      <span style={{ display: 'inline-flex', transform: 'rotate(180deg)' }}>
        <Icon name="chevR" size={12} />
      </span>
      All circulars
    </Link>
  );
}

function ReaderSkeleton() {
  return (
    <div style={{ maxWidth: 860 }} role="status" aria-busy="true" aria-label="Loading circular">
      <div aria-hidden="true">
        <Skeleton height={11} width={110} style={{ marginBottom: 20 }} />
        <Skeleton height={11} width={160} style={{ marginBottom: 10 }} />
        <Skeleton height={26} width="60%" style={{ marginBottom: 10 }} />
        <Skeleton height={12} width="40%" style={{ marginBottom: 24 }} />
        <div className="card card-pad mb-4">
          <SkeletonText lines={8} />
        </div>
        <Skeleton height={70} radius={12} style={{ width: '100%' }} />
      </div>
    </div>
  );
}
