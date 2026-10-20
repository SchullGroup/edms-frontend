'use client';

import React from 'react';
import { useDocumentSummary } from '@/apis/hooks/useDocuments';
import { SkeletonText } from '@/components/common/Skeleton';
import { fmtDateTime } from '@/utils/helpers';

interface Props {
  documentId: string;
}

/** The current version's AI summary (`GET /documents/:id/summary`), written after OCR.
 *  A failed one can be retried and a finished one regenerated (`POST`, same access). */
export function DocumentSummaryPanel({ documentId }: Props) {
  const {
    data,
    isLoading,
    isError,
    error,
    isFetching,
    checkAgain,
    requestNew,
    isRequesting,
    requestError,
  } = useDocumentSummary(documentId);

  const checkAgainButton = (
    <button className="btn btn-ghost btn-sm" onClick={() => checkAgain()} disabled={isFetching}>
      {isFetching ? 'Checking…' : 'Check again'}
    </button>
  );
  const requestButton = (label: string) => (
    <button className="btn btn-ghost btn-sm" onClick={requestNew} disabled={isRequesting}>
      {isRequesting ? 'Asking…' : label}
    </button>
  );

  let body: React.ReactNode;
  if (isLoading) {
    body = <SkeletonText lines={4} />;
  } else if (isError) {
    body =
      (error as any)?.response?.status === 404 ? (
        <div className="caption">There&apos;s no file to summarize yet.</div>
      ) : (
        <div className="caption flex items-center gap-2 flex-wrap">
          Couldn&apos;t load the summary. {checkAgainButton}
        </div>
      );
  } else if (!data) {
    body = null;
  } else if (data.summaryStatus === 'completed' && data.summary) {
    body = (
      <>
        <SummaryText text={data.summary} />
        <div className="caption mt-2 flex items-center gap-2 flex-wrap">
          <span>
            Written by AI from version {data.versionNumber}
            {data.generatedAt ? ` on ${fmtDateTime(data.generatedAt)}` : ''}. Check important
            details against the document.
          </span>
          {requestButton('Regenerate')}
        </div>
      </>
    );
  } else if (data.ocrStatus === 'failed') {
    body = (
      <div className="caption">
        No summary: the text in this file couldn&apos;t be read, so there&apos;s nothing to
        summarize.
      </div>
    );
  } else if (data.summaryStatus === 'skipped') {
    body = <div className="caption">No summary: no readable text was found in this file.</div>;
  } else if (data.summaryStatus === 'failed') {
    // A failed regeneration keeps the earlier summary.
    body = data.summary ? (
      <>
        <SummaryText text={data.summary} />
        <div className="caption mt-2 flex items-center gap-2 flex-wrap">
          A new summary couldn&apos;t be written, so this is the earlier one.{' '}
          {requestButton('Try again')}
        </div>
      </>
    ) : (
      <div className="caption flex items-center gap-2 flex-wrap">
        The summary couldn&apos;t be written. {requestButton('Try again')}
      </div>
    );
  } else if (data.summary) {
    // Regenerating: the earlier summary stays until the new one replaces it.
    body = (
      <>
        <SummaryText text={data.summary} />
        <div className="caption mt-2 flex items-center gap-2 flex-wrap" aria-live="polite">
          Writing a new summary. This one stays until it&apos;s ready. {checkAgainButton}
        </div>
      </>
    );
  } else {
    // pending or processing: OCR first, then the summary.
    body = (
      <div aria-live="polite">
        <SkeletonText lines={3} />
        <div className="caption mt-2 flex items-center gap-2 flex-wrap">
          {data.ocrStatus === 'completed'
            ? 'Writing the summary. This usually takes under a minute.'
            : 'Reading the text in this file first. The summary follows.'}
          {checkAgainButton}
        </div>
      </div>
    );
  }

  const requestErrorText = summaryRequestError(requestError);

  return (
    <div className="card">
      <div className="card-head">
        <span className="h3">AI summary</span>
      </div>
      <div className="card-body">
        {body}
        {requestErrorText && (
          <div className="caption mt-2" role="alert">
            {requestErrorText}
          </div>
        )}
      </div>
    </div>
  );
}

/** What to say when `POST /documents/:id/summary` fails; null when the panel
 *  already shows the outcome (the two 409s switch it to in progress). */
function summaryRequestError(err: any): string | null {
  if (!err) return null;
  const code = err.response?.data?.code;
  if (code === 'SUMMARY_IN_PROGRESS' || code === 'OCR_IN_PROGRESS') return null;
  if (code === 'NO_EXTRACTABLE_TEXT') return "There's no readable text in this file to summarize.";
  if (code === 'SUMMARY_UNAVAILABLE') {
    return "AI summaries aren't available right now. Try again later.";
  }
  return "Couldn't ask for a new summary. Try again in a moment.";
}

/** The summary is plain text: an opening sentence, then "- " bullet lines. */
function SummaryText({ text }: { text: string }) {
  const blocks: React.ReactNode[] = [];
  let bullets: string[] = [];
  const flush = () => {
    if (!bullets.length) return;
    blocks.push(
      <ul key={blocks.length} style={{ margin: '6px 0 0', paddingLeft: 18, listStyle: 'disc' }}>
        {bullets.map((b, i) => (
          <li key={i} style={{ marginTop: 4 }}>
            {b}
          </li>
        ))}
      </ul>,
    );
    bullets = [];
  };

  for (const raw of text.split('\n')) {
    const line = raw.trim();
    if (!line) continue;
    const bullet = line.match(/^[-*•]\s+(.*)$/);
    if (bullet) {
      bullets.push(bullet[1]);
    } else {
      flush();
      blocks.push(
        <p key={blocks.length} style={{ margin: blocks.length ? '8px 0 0' : 0 }}>
          {line}
        </p>,
      );
    }
  }
  flush();

  return <div style={{ fontSize: 13, lineHeight: 1.55 }}>{blocks}</div>;
}
