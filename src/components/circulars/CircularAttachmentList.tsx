'use client';

import React from 'react';
import Link from 'next/link';
import { Icon } from '@/components/ui/Icons';
import { ConfBadge } from '@/components/ui/Badges';
import type { CircularAttachment } from '@/types/models';
import { filesService } from '@/apis/services/files.service';
import { useUIStore } from '@/store/useUIStore';
import { formatFileSize } from './circularLabels';

/**
 * Attachments as the backend presents them: an uploaded file carries a
 * short-lived `fileUrl`, fetched with the session; a linked document is opened
 * through the document viewer, where the usual document permissions still apply.
 */
export function CircularAttachmentList({ attachments }: { attachments: CircularAttachment[] }) {
  const { addToast } = useUIStore();
  if (!attachments.length) return null;

  const save = (url: string, name: string) =>
    filesService
      .save(url, name, 'original')
      .catch((err) => addToast(err.message || 'Failed to download the attachment', 'error'));

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
                <button
                  className="btn btn-secondary btn-sm"
                  onClick={() => save(a.fileUrl!, a.fileName ?? 'attachment')}
                >
                  <Icon name="download" size={13} /> Download
                </button>
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
