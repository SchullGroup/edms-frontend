'use client';

import React, { useState } from 'react';
import {
  useDocument,
  useDownloadDocumentVersion,
  usePrintDocument,
} from '@/apis/hooks/useDocuments';
import { useConfidentialityPolicy } from '@/hooks/useConfidentialityPolicy';
import { useConfidentialityClearance } from '@/hooks/useConfidentialityClearance';
import { useRequestAccessPrompt } from '@/hooks/useRequestAccessPrompt';
import { DocumentViewerPanel } from '@/components/documents/DocumentViewerPanel';
import { ConfBadge } from '@/components/ui/Badges';
import { Icon } from '@/components/ui/Icons';
import { Skeleton } from '@/components/common/Skeleton';
import { documentFile } from '@/utils/documentFile';
import type { DocumentAccessKind } from '@/types/models';

export interface WorkflowDocumentViewerProps {
  documentId: string;
  /** From the task snapshot — shown when the document itself can't be loaded. */
  title: string;
  /** Null for a Restricted document (the backend withholds it). */
  confidentiality: string | null;
  /** The workflow response says the viewer can't open this document: show the
   *  request card straight away instead of fetching it into a 403. */
  restricted?: boolean;
  /** What "Request access" may ask for, and which start ticked. Defaults to
   *  View access only. */
  requestKinds?: DocumentAccessKind[];
  requestChecked?: DocumentAccessKind[];
  viewerId: string;
  viewerName: string;
}

/**
 * One workflow document in the viewer. A reviewer can be refused a document
 * for two reasons: its confidentiality tier is above their role's clearance,
 * or it belongs to another department and they hold no access grant for it
 * (a workflow can mix documents from several departments). The workflow
 * response marks such a document restricted (edms-backend `3014b89`); for any
 * other refusal `GET /documents/:id` 403s. Either way the card offers "Request
 * access", which an administrator reviews. The rest of the workflow stays
 * usable.
 */
export function WorkflowDocumentViewer({
  documentId,
  title,
  confidentiality,
  restricted = false,
  requestKinds = ['view'],
  requestChecked,
  viewerId,
  viewerName,
}: WorkflowDocumentViewerProps) {
  const [zoom, setZoom] = useState(1);
  // An empty id disables the query: a Restricted document is never fetched.
  const { data: doc, isLoading, error } = useDocument(restricted ? '' : documentId);
  const { policyFor } = useConfidentialityPolicy();
  const { allows } = useConfidentialityClearance();
  const downloadVersion = useDownloadDocumentVersion();
  const printDocument = usePrintDocument();
  const { promptRequestAccess, isRequesting } = useRequestAccessPrompt();
  const denied = restricted || (error as any)?.response?.status === 403;

  if (!restricted && isLoading) {
    return <Skeleton height={620} radius={16} style={{ width: '100%' }} />;
  }

  if (denied || !doc) {
    return (
      <div className="viewer doc-viewer-col" style={{ position: 'relative' }}>
        <div className="viewer-bar">
          <span style={{ flex: 1 }}>
            {restricted ? 'Restricted document' : denied ? 'No access' : 'Unavailable'}
          </span>
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
                  ? `You haven’t been given access to this document yet, either because of its confidentiality level or because it belongs to another department. ${
                      requestKinds.length > 0
                        ? 'Request access: your request will be reviewed and you will be notified of the decision. '
                        : ''
                    }The rest of this workflow is still available to you.`
                  : 'It may have been archived or removed. Try again later, or contact the document owner.'}
              </p>
              {denied && requestKinds.length > 0 && (
                <button
                  className="btn btn-primary"
                  disabled={isRequesting}
                  onClick={() =>
                    promptRequestAccess(documentId, restricted ? undefined : title, {
                      kinds: requestKinds,
                      checked: requestChecked,
                    })
                  }
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
  const currentVersionId = doc.currentVersionId;
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
      canDownload={allows(doc, 'download')}
      onDownload={
        currentVersionId
          ? () => {
              const tab = window.open('', '_blank');
              if (tab) tab.opener = null;
              downloadVersion.mutate({ id: doc.id, versionId: currentVersionId, tab });
            }
          : undefined
      }
      canPrint={allows(doc, 'print')}
      ocrText={doc.currentVersion?.ocrText}
      ocrStatus={doc.currentVersion?.ocrStatus}
      onBeforePrint={() =>
        printDocument
          .mutateAsync(doc.id)
          .then(() => true)
          .catch(() => false)
      }
    />
  );
}
