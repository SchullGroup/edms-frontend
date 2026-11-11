'use client';

import React, { useMemo, useState } from 'react';
import { useDocumentViewReport } from '@/apis/hooks/useDocumentViews';
import { DateField } from '@/components/ui/DatePicker';
import { SkeletonText } from '@/components/common/Skeleton';
import { exportCsv } from '@/utils/exportCsv';
import { fmtDateTime } from '@/utils/helpers';

interface Props {
  documentId: string;
  documentTitle: string;
}

/** The day this app started recording view sessions (ticket 06). */
const TRACKING_SINCE = '10 Nov 2026';

/** "45 s", "12 min", "1 h 05 min". */
export function fmtDuration(totalSeconds: number): string {
  if (totalSeconds < 60) return `${totalSeconds} s`;
  const minutes = Math.floor(totalSeconds / 60);
  if (minutes < 60) return `${minutes} min`;
  return `${Math.floor(minutes / 60)} h ${String(minutes % 60).padStart(2, '0')} min`;
}

/** "YYYY-MM-DD" → local midnight as ISO; `nextDay` makes an exclusive end for an inclusive "to". */
function dayStart(day: string, nextDay = false): string {
  const [y, m, d] = day.split('-').map(Number);
  return new Date(y, m - 1, d + (nextDay ? 1 : 0)).toISOString();
}

/** Who viewed the document and for how long (`GET /document-views/report`). Needs `audit:view`. */
export function DocumentViewTimePanel({ documentId, documentTitle }: Props) {
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const rangeInvalid = !!from && !!to && from > to;

  const range = useMemo(
    () => ({
      ...(from && { from: dayStart(from) }),
      ...(to && { to: dayStart(to, true) }),
    }),
    [from, to],
  );
  const report = useDocumentViewReport(documentId, range, { enabled: !rangeInvalid });
  const viewers = report.data?.viewers ?? [];
  const filtered = !!(from || to);

  const download = () =>
    exportCsv(
      `viewing-time_${documentTitle}`,
      viewers.map((v) => ({
        name: v.user?.name ?? 'Unknown user',
        email: v.user?.email ?? '',
        sessions: v.sessions,
        totalSeconds: v.totalSeconds,
        total: fmtDuration(v.totalSeconds),
        lastViewed: v.lastViewedAt ? fmtDateTime(v.lastViewedAt) : '',
      })),
      [
        { key: 'name', label: 'Viewer' },
        { key: 'email', label: 'Email' },
        { key: 'sessions', label: 'Sessions' },
        { key: 'totalSeconds', label: 'Total seconds' },
        { key: 'total', label: 'Total time' },
        { key: 'lastViewed', label: 'Last viewed' },
      ],
    );

  return (
    <div className="card">
      <div className="card-head flex justify-between items-center">
        <span className="h3">Viewing time</span>
        {viewers.length > 0 && (
          <button className="btn btn-ghost btn-sm" onClick={download}>
            Export CSV
          </button>
        )}
      </div>
      <div className="card-body" style={{ paddingTop: '6px' }}>
        <div className="flex items-center gap-2 flex-wrap mb-2">
          <span className="caption">From</span>
          <DateField
            compact
            aria-label="Viewed from"
            placeholder="Any date"
            value={from}
            onChange={setFrom}
          />
          <span className="caption">To</span>
          <DateField
            compact
            aria-label="Viewed to"
            placeholder="Any date"
            value={to}
            min={from || undefined}
            onChange={setTo}
          />
        </div>
        {rangeInvalid && (
          <div className="caption" role="alert" style={{ color: 'var(--status-overdue)' }}>
            The start date must be on or before the end date.
          </div>
        )}

        {!rangeInvalid && report.isLoading && <SkeletonText lines={3} />}
        {!rangeInvalid && report.isError && (
          <div className="caption">Couldn&apos;t load viewing time.</div>
        )}
        {!rangeInvalid && report.data && viewers.length === 0 && (
          <div className="caption">
            {filtered
              ? 'No one viewed this document in these dates.'
              : `No one has viewed this document since tracking began (${TRACKING_SINCE}).`}
          </div>
        )}

        {!rangeInvalid && report.data && viewers.length > 0 && (
          <>
            <div className="caption mb-2">
              {report.data.uniqueViewers} {report.data.uniqueViewers === 1 ? 'person' : 'people'} ·{' '}
              {fmtDuration(report.data.totalSeconds)} in total
            </div>
            <div
              tabIndex={0}
              aria-label="Viewers"
              style={{ maxHeight: 320, overflowY: 'auto', paddingRight: 4 }}
            >
              {viewers.map((v) => (
                <div
                  key={v.userId}
                  className="flex justify-between gap-2"
                  style={{ padding: '8px 0', borderTop: '1px solid var(--border)' }}
                >
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontWeight: 500, wordBreak: 'break-word' }}>
                      {v.user?.name ?? 'Unknown user'}
                    </div>
                    <div className="caption">
                      {v.sessions} {v.sessions === 1 ? 'session' : 'sessions'}
                      {v.lastViewedAt && ` · last ${fmtDateTime(v.lastViewedAt)}`}
                    </div>
                  </div>
                  <div style={{ fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap' }}>
                    {fmtDuration(v.totalSeconds)}
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
