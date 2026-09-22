'use client';

import React, { useRef, useState } from 'react';
import {
  useDocumentVersions,
  useAddDocumentVersion,
  useRestoreDocumentVersion,
} from '@/apis/hooks/useDocuments';
import { useMultipartUploader } from '@/apis/hooks/useMultipartUploader';
import { calculateChecksum } from '@/apis/services/s3.service';
import { useUIStore } from '@/store/useUIStore';
import { Icon } from '@/components/ui/Icons';
import { fmtDate } from '@/utils/helpers';

interface Props {
  documentId: string;
  currentVersionId?: string | null;
  /** Reader — controls whether the panel renders at all. */
  canView: boolean;
  /** Writer — controls the "Restore" affordance. */
  canEdit: boolean;
  /** Controls the "New version" upload affordance specifically — true only
   *  once the previous stage has sent the document back with "Request
   *  changes" onto the caller's current task, so the file can't be silently
   *  swapped mid-review. */
  canUploadVersion: boolean;
  getUploaderName?: (userId: string) => string;
}

export function DocumentVersionsPanel({
  documentId,
  currentVersionId,
  canView,
  canEdit,
  canUploadVersion,
  getUploaderName,
}: Props) {
  const { data: versions, isLoading } = useDocumentVersions(canView ? documentId : '');
  const addVersion = useAddDocumentVersion();
  const restoreVersion = useRestoreDocumentVersion();
  const { startUpload, uploadProgress } = useMultipartUploader();
  const { openConfirm, addToast } = useUIStore();
  const fileRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);

  if (!canView) return null;

  const onPickFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    setBusy(true);
    try {
      const checksum = await calculateChecksum(file);
      const fileUrl = await startUpload({
        file,
        fileName: file.name,
        folderName: 'edmsDocuments',
      });
      await addVersion.mutateAsync({
        id: documentId,
        data: { fileUrl, mimeType: file.type, checksum, fileSize: file.size },
      });
    } catch (err: any) {
      addToast(err?.message || 'Failed to upload new version', 'error');
    } finally {
      setBusy(false);
    }
  };

  const confirmRestore = (versionId: string, versionNumber: number) => {
    openConfirm({
      title: `Restore version ${versionNumber}?`,
      message:
        'This makes the selected version the current one. A new version entry is created; nothing is deleted.',
      confirmLabel: 'Restore',
      onConfirm: async () => {
        await restoreVersion.mutateAsync({ id: documentId, versionId });
      },
    });
  };

  const sorted = [...(versions || [])].sort((a, b) => b.versionNumber - a.versionNumber);

  return (
    <div className="card">
      <div className="card-head flex justify-between items-center">
        <span className="h3">Versions</span>
        {canUploadVersion && (
          <>
            <input
              ref={fileRef}
              type="file"
              accept="application/pdf,image/*"
              style={{ display: 'none' }}
              onChange={onPickFile}
            />
            <button
              className="btn btn-secondary btn-sm"
              disabled={busy}
              onClick={() => fileRef.current?.click()}
            >
              <Icon name="upload" size={13} />{' '}
              {busy ? `Uploading ${uploadProgress}%` : 'New version'}
            </button>
          </>
        )}
      </div>
      <div className="card-body" style={{ paddingTop: '6px' }}>
        {canEdit && !canUploadVersion && (
          <div className="caption mb-2">
            New version uploads open once the previous stage requests changes on this document.
          </div>
        )}
        {isLoading && <div className="caption">Loading versions…</div>}
        {!isLoading && sorted.length === 0 && <div className="caption">No version history.</div>}
        {sorted.map((v) => {
          const isCurrent = v.id === currentVersionId;
          return (
            <div key={v.id} className="meta-row" style={{ alignItems: 'center' }}>
              <span className="k">
                v{v.versionNumber}
                {isCurrent && (
                  <span className="badge b-status-closed" style={{ marginLeft: 6 }}>
                    current
                  </span>
                )}
              </span>
              <span className="v flex items-center gap-2" style={{ justifyContent: 'flex-end' }}>
                <span className="caption">
                  {getUploaderName ? getUploaderName(v.uploadedBy) : v.uploadedBy} ·{' '}
                  {fmtDate(v.createdAt)}
                  {v.ocrStatus && v.ocrStatus !== 'completed' ? ` · OCR ${v.ocrStatus}` : ''}
                </span>
                {v.fileUrl && (
                  <a
                    className="btn btn-ghost btn-sm"
                    href={v.fileUrl}
                    target="_blank"
                    rel="noreferrer"
                    title="Open this version"
                  >
                    <Icon name="download" size={13} />
                  </a>
                )}
                {canEdit && !isCurrent && (
                  <button
                    className="btn btn-ghost btn-sm"
                    onClick={() => confirmRestore(v.id, v.versionNumber)}
                    disabled={restoreVersion.isPending}
                  >
                    Restore
                  </button>
                )}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
