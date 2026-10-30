'use client';

import React, { use, useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useUIStore } from '@/store/useUIStore';
import { usePermissions } from '@/hooks/usePermissions';
import {
  useAcknowledgeControlException,
  useControlException,
  useReportControlException,
  useResolveControlException,
} from '@/apis/hooks/useControlExceptions';
import { Icon } from '@/components/ui/Icons';
import { ErrorMessage } from '@/components/common/ErrorMessage';
import { SkeletonPage } from '@/components/common/Skeleton';
import {
  CATEGORY_LABEL,
  ControlExceptionStatusBadge,
  SeverityBadge,
} from '@/components/controlExceptions/controlExceptionLabels';
import { fmtDateTime } from '@/utils/helpers';
import type { ControlException } from '@/types/models';

/** The four lifecycle steps, done or still to come. */
function timeline(ce: ControlException) {
  return [
    { label: 'Raised', at: ce.raisedAt, by: ce.raiser?.name },
    { label: 'Reported to the permanent secretary', at: ce.reportedAt },
    { label: 'Acknowledged', at: ce.acknowledgedAt },
    { label: 'Resolved', at: ce.resolvedAt },
  ];
}

/**
 * One exception: what was found, where, and the action its status allows —
 * the auditor edits and reports an open one; management acknowledges and resolves.
 */
export default function ControlExceptionPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const { setPageTitle, openConfirm } = useUIStore();
  const { hasPermission } = usePermissions();
  const { data: ce, isLoading, isError, error, refetch } = useControlException(id);
  const reportException = useReportControlException();
  const acknowledgeException = useAcknowledgeControlException();
  const resolveException = useResolveControlException();

  const [resolving, setResolving] = useState(false);
  const [note, setNote] = useState('');
  const [noteError, setNoteError] = useState(false);

  useEffect(() => {
    setPageTitle('Control exception');
  }, [setPageTitle]);

  if (isLoading) return <SkeletonPage columns={['Field', 'Value']} rows={6} />;
  if (isError || !ce) {
    const notFound = (error as any)?.response?.status === 404;
    return (
      <ErrorMessage
        message={notFound ? 'This exception no longer exists.' : 'Failed to load this exception.'}
        retry={notFound ? undefined : () => refetch()}
      />
    );
  }

  const canEdit = ce.status === 'open' && hasPermission('control_exception', 'edit');
  const canReport = ce.status === 'open' && hasPermission('control_exception', 'report');
  const mayRespond = hasPermission('control_exception', 'respond');
  const canAcknowledge = ce.status === 'reported' && mayRespond;
  const canResolve = (ce.status === 'reported' || ce.status === 'acknowledged') && mayRespond;

  const confirmReport = () =>
    openConfirm({
      title: 'Report to the permanent secretary?',
      message:
        'Management will be notified and can acknowledge and resolve it. You won’t be able to edit it afterwards.',
      confirmLabel: 'Report',
      onConfirm: () =>
        reportException
          .mutateAsync(ce.id)
          .then(() => {})
          .catch(() => false),
    });

  const submitResolution = async () => {
    if (!note.trim()) {
      setNoteError(true);
      return;
    }
    try {
      await resolveException.mutateAsync({ id: ce.id, resolutionNote: note.trim() });
      setResolving(false);
      setNote('');
    } catch {
      // The mutation hook has already shown the error.
    }
  };

  return (
    <div>
      <div className="page-head">
        <div>
          <div className="caption mb-1">
            <Link href="/control-exceptions">Control exceptions</Link>
          </div>
          <div className="page-title">{ce.title}</div>
          <div className="flex gap-2 items-center mt-1">
            <ControlExceptionStatusBadge status={ce.status} />
            <SeverityBadge severity={ce.severity} />
            <span className="caption">{CATEGORY_LABEL[ce.category] ?? ce.category}</span>
          </div>
        </div>
        <div className="actions">
          {canEdit && (
            <button
              className="btn btn-secondary"
              onClick={() => router.push(`/control-exceptions/${ce.id}/edit`)}
            >
              <Icon name="edit" size={15} /> Edit
            </button>
          )}
          {canReport && (
            <button
              className="btn btn-primary"
              onClick={confirmReport}
              disabled={reportException.isPending}
            >
              <Icon name="send" size={15} /> Report to permanent secretary
            </button>
          )}
          {canAcknowledge && (
            <button
              className="btn btn-secondary"
              onClick={() => acknowledgeException.mutate(ce.id)}
              disabled={acknowledgeException.isPending}
            >
              {acknowledgeException.isPending && (
                <span className="btn-spinner" aria-hidden="true" />
              )}
              <Icon name="check" size={15} /> Acknowledge
            </button>
          )}
          {canResolve && !resolving && (
            <button className="btn btn-primary" onClick={() => setResolving(true)}>
              <Icon name="approve" size={15} /> Resolve
            </button>
          )}
        </div>
      </div>

      <div
        className="grid"
        style={{ gridTemplateColumns: 'minmax(0, 2fr) minmax(0, 1fr)', alignItems: 'start' }}
      >
        <div>
          {resolving && (
            <div className="card mb-4">
              <div className="card-head">
                <span className="h3">Resolve this exception</span>
              </div>
              <div className="card-body">
                <div className="field">
                  <label htmlFor="ce-resolution">
                    Resolution <span className="req">*</span>
                  </label>
                  <textarea
                    id="ce-resolution"
                    className="input"
                    style={{ minHeight: 120, lineHeight: 1.6 }}
                    maxLength={5000}
                    value={note}
                    autoFocus
                    placeholder="What was done about it, and by whom."
                    onChange={(e) => {
                      setNote(e.target.value);
                      setNoteError(false);
                    }}
                  />
                  {noteError && <div className="err">Say how it was resolved.</div>}
                </div>
                <div className="flex gap-2" style={{ justifyContent: 'flex-end' }}>
                  <button
                    className="btn btn-secondary"
                    onClick={() => setResolving(false)}
                    disabled={resolveException.isPending}
                  >
                    Cancel
                  </button>
                  <button
                    className="btn btn-primary"
                    onClick={submitResolution}
                    disabled={resolveException.isPending}
                  >
                    {resolveException.isPending && (
                      <span className="btn-spinner" aria-hidden="true" />
                    )}
                    Mark resolved
                  </button>
                </div>
              </div>
            </div>
          )}

          <div className="card mb-4">
            <div className="card-head">
              <span className="h3">What was found</span>
            </div>
            <div className="card-body" style={{ whiteSpace: 'pre-wrap', lineHeight: 1.6 }}>
              {ce.description}
            </div>
          </div>

          {ce.status === 'resolved' && ce.resolutionNote && (
            <div className="card mb-4">
              <div className="card-head">
                <span className="h3">Resolution</span>
              </div>
              <div className="card-body" style={{ whiteSpace: 'pre-wrap', lineHeight: 1.6 }}>
                {ce.resolutionNote}
              </div>
            </div>
          )}
        </div>

        <div>
          <div className="card mb-4">
            <div className="card-head">
              <span className="h3">Where it was seen</span>
            </div>
            <div className="card-body">
              <div className="meta-row">
                <span className="k">Department</span>
                <span className="v">{ce.department?.name ?? '—'}</span>
              </div>
              <div className="meta-row">
                <span className="k">Document</span>
                <span className="v">
                  {ce.document ? (
                    <Link href={`/doc/${ce.document.id}`}>
                      {ce.document.title}
                      <div className="caption">{ce.document.referenceNumber}</div>
                    </Link>
                  ) : (
                    '—'
                  )}
                </span>
              </div>
              <div className="meta-row">
                <span className="k">Workflow</span>
                <span className="v">
                  {ce.workflowInstanceId ? (
                    <Link href={`/workflow-instances/${ce.workflowInstanceId}`}>Open workflow</Link>
                  ) : (
                    '—'
                  )}
                </span>
              </div>
            </div>
          </div>

          <div className="card mb-4">
            <div className="card-head">
              <span className="h3">
                <Icon name="clock" size={16} /> History
              </span>
            </div>
            <div className="card-body">
              {timeline(ce).map((step) => (
                <div key={step.label} className="meta-row">
                  <span className="k" style={step.at ? undefined : { opacity: 0.5 }}>
                    {step.label}
                  </span>
                  <span className="v">
                    {step.at ? (
                      <>
                        {fmtDateTime(step.at)}
                        {step.by && <div className="caption">{step.by}</div>}
                      </>
                    ) : (
                      <span className="caption">Not yet</span>
                    )}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
