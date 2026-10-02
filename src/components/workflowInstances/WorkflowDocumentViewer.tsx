'use client';

import React, { useState } from 'react';
import { useDocument } from '@/apis/hooks/useDocuments';
import { useConfidentialityPolicy } from '@/hooks/useConfidentialityPolicy';
import { useRequestAccessPrompt } from '@/hooks/useRequestAccessPrompt';
import { DocumentViewerPanel } from '@/components/documents/DocumentViewerPanel';
import { ConfBadge } from '@/components/ui/Badges';
import { Icon } from '@/components/ui/Icons';
import { Skeleton } from '@/components/common/Skeleton';
import { documentFile } from '@/utils/documentFile';

export interface WorkflowDocumentViewerProps {
  documentId: string;
  /** From the task snapshot — shown when the document itself can't be loaded. */
  title: string;
  confidentiality: string;
  viewerId: string;
  viewerName: string;
}

/**
 * One workflow document in the viewer. A workflow can hold documents at
 * different confidentiality tiers, so a reviewer may be cleared for some and
 * not others: `GET /documents/:id` 403s for those, and the viewer is replaced
 * by an overlay explaining why with a "Request access" button — the rest of
 * the workflow stays usable.
 */
export function WorkflowDocumentViewer({
  documentId,
  title,
  confidentiality,
  viewerId,
  viewerName,
}: WorkflowDocumentViewerProps) {
  const [zoom, setZoom] = useState(1);
  const { data: doc, isLoading, error } = useDocument(documentId);
  const { policyFor } = useConfidentialityPolicy();
  const { promptRequestAccess, isRequesting } = useRequestAccessPrompt();
  const denied = (error as any)?.response?.status === 403;

  if (isLoading) {
    return <Skeleton height={620} radius={16} style={{ width: '100%' }} />;
  }

  if (denied || !doc) {
    return (
      <div className="viewer doc-viewer-col" style={{ position: 'relative' }}>
        <div className="viewer-bar">
          <span style={{ flex: 1 }}>Restricted</span>
        </div>
        <div className="viewer-page-wrap" aria-hidden="true">
          <div className="doc-page" style={{ filter: 'blur(6px)', opacity: 0.35 }} />
        </div>
        <div
          role="alert"
          style={{
            position: 'absolute',
            inset: 0,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: 16,
          }}
        >
          <div className="card" style={{ maxWidth: 420, width: '100%' }}>
            <div className="empty">
              <Icon name="lock" size={32} />
              <div className="h3 mt-4 mb-2">
                {denied ? "You don't have access to this document" : "This document couldn't be loaded"}
              </div>
              <div className="flex gap-2 items-center justify-center mb-2 flex-wrap">
                <b>{title}</b>
                <ConfBadge level={confidentiality} />
              </div>
              <p className="caption mb-4">
                {denied
                  ? 'Its confidentiality level is above what your role is cleared for. Request access to view it — the rest of this workflow is still available to you.'
                  : 'It may have been archived or removed. Try again later, or contact the document owner.'}
              </p>
              {denied && (
                <button
                  className="btn btn-primary"
                  disabled={isRequesting}
                  onClick={() => promptRequestAccess(documentId, title)}
                >
                  Request access
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    );
  }

  const { rawFileKey, fileUrl, fileMimeType } = documentFile(doc);
  const policy = policyFor(doc.confidentiality);
  const lockedByOther = !!doc.isCheckedOut && doc.checkoutLock?.lockedBy !== viewerId;

  return (
    <DocumentViewerPanel
      documentTitle={doc.title}
      confidentiality={doc.confidentiality}
      fileUrl={fileUrl}
      rawFileKey={rawFileKey}
      fileMimeType={fileMimeType}
      showWatermark={policy.watermark}
      watermarkText={`${doc.confidentiality} · ${viewerName}`}
      zoom={zoom}
      onZoomChange={setZoom}
      signatures={[]}
      sealed={false}
      lockedByOther={lockedByOther}
      onSignatureFieldClick={() => {}}
      getSignerName={() => 'User'}
    />
  );
}
