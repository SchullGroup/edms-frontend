'use client';

import React, { useRef, useState } from 'react';
import { UPLOAD_ACCEPT, resolveUploadMimeType } from '@/constants/uploadTypes';
import {
  useDocumentVersions,
  useAddDocumentVersion,
  useRestoreDocumentVersion,
  useDownloadDocumentVersion,
} from '@/apis/hooks/useDocuments';
import { useMultipartUploader } from '@/apis/hooks/useMultipartUploader';
import { calculateChecksum } from '@/apis/services/s3.service';
import { canDownloadVersion } from '@/apis/services/files.service';
import { useUIStore } from '@/store/useUIStore';
import { Icon } from '@/components/ui/Icons';
import { fmtDate } from '@/utils/helpers';
import { SkeletonText } from '@/components/common/Skeleton';

/** The API's limit on a version's change note. */
const CHANGE_NOTE_MAX = 500;

interface Props {
  documentId: string;
  /** Names the saved file. */
  documentTitle: string;
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
}

export function DocumentVersionsPanel({
  documentId,
  documentTitle,
  currentVersionId,
  canView,
  canEdit,
  canUploadVersion,
}: Props) {
  const { data: versions, isLoading } = useDocumentVersions(canView ? documentId : '');
  const addVersion = useAddDocumentVersion();
  const restoreVersion = useRestoreDocumentVersion();
  const downloadVersion = useDownloadDocumentVersion();
  const { startUpload, uploadProgress } = useMultipartUploader();
  const { openConfirm, addToast } = useUIStore();
  const fileRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [pendingFile, setPendingFile] = useState<File | null>(null);
  const [changeNote, setChangeNote] = useState('');

  if (!canView) return null;

  const onPickFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (file) setPendingFile(file);
  };

  const cancelPending = () => {
    setPendingFile(null);
    setChangeNote('');
  };

  const uploadPending = async () => {
    if (!pendingFile) return;
    const file = pendingFile;
    const note = changeNote.trim();
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
        data: {
          fileUrl,
          mimeType: resolveUploadMimeType(file) ?? file.type,
          checksum,
          fileSize: file.size,
          ...(note && { changeNote: note }),
        },
      });
      cancelPending();
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
              accept={UPLOAD_ACCEPT}
              style={{ display: 'none' }}
              onChange={onPickFile}
            />
            <button
              className="btn btn-secondary btn-sm"
              disabled={busy || !!pendingFile}
              onClick={() => fileRef.current?.click()}
            >
              <Icon name="upload" size={13} /> New version
            </button>
          </>
        )}
      </div>
      <div className="card-body" style={{ paddingTop: '6px' }}>
        {canEdit && !canUploadVersion && (
          <div className="caption mb-2">
            New versions are uploaded on the workflow page, once a stage requests changes on this
            document.
          </div>
        )}
        {pendingFile && (
          <div className="mb-3">
            <div className="caption mb-2" style={{ wordBreak: 'break-word' }}>
              New version: <strong>{pendingFile.name}</strong>
            </div>
            <div className="field">
              <label htmlFor={`change-note-${documentId}`}>What changed? (optional)</label>
              <textarea
                id={`change-note-${documentId}`}
                rows={3}
                maxLength={CHANGE_NOTE_MAX}
                value={changeNote}
                disabled={busy}
                onChange={(e) => setChangeNote(e.target.value)}
                placeholder="e.g. Updated the totals on page 2"
              />
              <div className="caption" style={{ textAlign: 'right' }}>
                {changeNote.length}/{CHANGE_NOTE_MAX}
              </div>
            </div>
            <div className="flex gap-2" style={{ justifyContent: 'flex-end' }}>
              <button className="btn btn-ghost btn-sm" onClick={cancelPending} disabled={busy}>
                Cancel
              </button>
              <button className="btn btn-primary btn-sm" onClick={uploadPending} disabled={busy}>
                {busy ? `Uploading ${uploadProgress}%` : 'Upload version'}
              </button>
            </div>
          </div>
        )}
        {isLoading && <SkeletonText lines={3} />}
        {!isLoading && sorted.length === 0 && <div className="caption">No version history.</div>}
        {sorted.map((v) => {
          const isCurrent = v.id === currentVersionId;
          return (
            <div key={v.id} className="meta-row" style={{ flexDirection: 'column', gap: 4 }}>
              <div className="flex justify-between items-center gap-2">
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
                    {v.uploader?.name || 'Unknown user'} · {fmtDate(v.createdAt)}
                    {v.ocrStatus && v.ocrStatus !== 'completed' ? ` · OCR ${v.ocrStatus}` : ''}
                  </span>
                  {canDownloadVersion(v) && (
                    <button
                      className="btn btn-ghost btn-sm"
                      onClick={() =>
                        downloadVersion.mutate({
                          id: documentId,
                          versionId: v.id,
                          title: documentTitle,
                        })
                      }
                      disabled={downloadVersion.isPending}
                      title="Download this version"
                      aria-label={`Download version ${v.versionNumber}`}
                    >
                      <Icon name="download" size={13} />
                    </button>
                  )}
                  {v.originalUrl && (
                    <button
                      className="btn btn-ghost btn-sm"
                      onClick={() =>
                        downloadVersion.mutate({
                          id: documentId,
                          versionId: v.id,
                          title: documentTitle,
                          original: true,
                        })
                      }
                      disabled={downloadVersion.isPending}
                      title="Download the original file, without a watermark"
                    >
                      Original
                    </button>
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
              {v.changeNote && (
                <div className="caption" style={{ wordBreak: 'break-word' }}>
                  {v.changeNote}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
