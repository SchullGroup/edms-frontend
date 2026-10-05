'use client';

import React from 'react';
import Link from 'next/link';
import { Icon } from '@/components/ui/Icons';
import { ConfBadge } from '@/components/ui/Badges';
import type { CircularAttachment } from '@/types/models';
import { formatFileSize } from './circularLabels';

/**
 * Attachments as the backend presents them: an uploaded file carries a
 * short-lived signed `fileUrl`; a linked document is opened through the
 * document viewer, where the usual document permissions still apply.
 */
export function CircularAttachmentList({ attachments }: { attachments: CircularAttachment[] }) {
  if (!attachments.length) return null;

  return (
    <div className="card mb-4">
      <div className="card-head">
        <span className="h3">
          <Icon name="doc" size={16} /> Attachments ({attachments.length})
        </span>
      </div>
      <div className="card-body" style={{ paddingTop: 6, paddingBottom: 6 }}>
        {attachments.map((a) =>
          a.kind === 'document' && a.document ? (
            <div key={a.id} className="metric-li">
              <Link href={`/doc/${a.document.id}`} className="flex items-center gap-2">
                <Icon name="cabinet" size={14} />
                <span>
                  <b>{a.document.title}</b>
                  {a.document.referenceNumber && (
                    <span className="caption"> · {a.document.referenceNumber}</span>
                  )}
                </span>
              </Link>
              <ConfBadge level={a.document.confidentiality} />
            </div>
          ) : (
            <div key={a.id} className="metric-li">
              <span className="flex items-center gap-2" style={{ minWidth: 0 }}>
                <Icon name="doc" size={14} />
                <span style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {a.fileName ?? 'Attachment'}
                </span>
                <span className="caption">{formatFileSize(a.fileSize)}</span>
              </span>
              {a.fileUrl ? (
                <a
                  className="btn btn-secondary btn-sm"
                  href={a.fileUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  <Icon name="download" size={13} /> Download
                </a>
              ) : (
                <span className="caption">Unavailable</span>
              )}
            </div>
          ),
        )}
      </div>
    </div>
  );
}
