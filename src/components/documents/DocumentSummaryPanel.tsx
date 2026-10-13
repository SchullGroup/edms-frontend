'use client';

import React from 'react';
import { useDocumentSummary } from '@/apis/hooks/useDocuments';
import { SkeletonText } from '@/components/common/Skeleton';
import { fmtDateTime } from '@/utils/helpers';

interface Props {
  documentId: string;
}

/**
 * The AI summary of the document's current version (`GET /documents/:id/summary`).
 * The backend writes it in the background once OCR has read the file, so a new
 * document shows "being written" for a while and the hook polls briefly.
 */
export function DocumentSummaryPanel({ documentId }: Props) {
  const { data, isLoading, isError, error, isFetching, checkAgain } =
    useDocumentSummary(documentId);

  const checkAgainButton = (
    <button className="btn btn-ghost btn-sm" onClick={() => checkAgain()} disabled={isFetching}>
      {isFetching ? 'Checking…' : 'Check again'}
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
        <div className="caption mt-2">
          Written by AI from version {data.versionNumber}
          {data.generatedAt ? ` on ${fmtDateTime(data.generatedAt)}` : ''}. Check important
          details against the document.
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
    body = (
      <div className="caption flex items-center gap-2 flex-wrap">
        The summary couldn&apos;t be written. {checkAgainButton}
      </div>
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

  return (
    <div className="card">
      <div className="card-head">
        <span className="h3">AI summary</span>
      </div>
      <div className="card-body">{body}</div>
    </div>
  );
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
