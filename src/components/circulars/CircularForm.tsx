'use client';

import React, { useMemo, useRef, useState } from 'react';
import { Combobox } from '@/components/ui/Combobox';
import { DateTimeField } from '@/components/ui/DatePicker';
import { Icon } from '@/components/ui/Icons';
import { useDocuments } from '@/apis/hooks/useDocuments';
import { useMultipartUploader } from '@/apis/hooks/useMultipartUploader';
import { calculateChecksum } from '@/apis/services/s3.service';
import { resolveUploadMimeType } from '@/constants/uploadTypes';
import { usePermissions } from '@/hooks/usePermissions';
import { useUIStore } from '@/store/useUIStore';
import type {
  Circular,
  CircularAttachmentInput,
  CircularAudience,
  CreateCircularRequest,
  DocumentConfidentiality,
  DocumentUrgency,
} from '@/types/models';
import { AudienceEditor, cleanAudience, isAudienceEmpty } from './AudienceEditor';
import { CONFIDENTIALITY_OPTIONS, URGENCY_OPTIONS, formatFileSize } from './circularLabels';

/** An attachment as held by the form — already uploaded, or a document link. */
type DraftAttachment =
  | { key: string; kind: 'document'; documentId: string; title: string }
  | {
      key: string;
      kind: 'file';
      fileUrl: string;
      fileName: string;
      mimeType: string;
      fileSize?: number;
      checksum: string;
    };

/** The form's output. `attachments` is only present when the list was changed,
 *  because a PATCH that sends it replaces the whole list. */
export type CircularFormValues = Omit<
  CreateCircularRequest,
  'attachments' | 'category' | 'acknowledgementDueAt' | 'expiresAt'
> & {
  attachments?: CircularAttachmentInput[];
  /** `null` (edit only) clears a value the draft already had. */
  category?: string | null;
  acknowledgementDueAt?: string | null;
  expiresAt?: string | null;
};

interface CircularFormProps {
  initial?: Circular;
  submitLabel: string;
  onSubmit: (values: CircularFormValues) => Promise<unknown>;
  onCancel: () => void;
}

/** ISO timestamp → the "YYYY-MM-DDTHH:mm" local string `DateTimeField` works in. */
function toLocalInput(iso: string | null | undefined): string {
  if (!iso) return '';
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

const toIso = (local: string) => (local ? new Date(local).toISOString() : undefined);

function initialAttachments(c?: Circular): DraftAttachment[] {
  return (c?.attachments ?? []).flatMap<DraftAttachment>((a) => {
    if (a.kind === 'document' && a.document) {
      return [{ key: a.id, kind: 'document', documentId: a.document.id, title: a.document.title }];
    }
    // The backend reads only the URL's path to recover the storage key, so the
    // signed download URL round-trips even after it has expired.
    if (a.kind === 'file' && a.fileUrl && a.fileName && a.mimeType && a.checksum) {
      return [
        {
          key: a.id,
          kind: 'file',
          fileUrl: a.fileUrl,
          fileName: a.fileName,
          mimeType: a.mimeType,
          fileSize: a.fileSize ? Number(a.fileSize) : undefined,
          checksum: a.checksum,
        },
      ];
    }
    return [];
  });
}

export function CircularForm({ initial, submitLabel, onSubmit, onCancel }: CircularFormProps) {
  const { addToast } = useUIStore();
  const { hasPermission } = usePermissions();
  const canLinkDocuments = hasPermission('document', 'view');

  const [title, setTitle] = useState(initial?.title ?? '');
  const [category, setCategory] = useState(initial?.category ?? '');
  const [body, setBody] = useState(initial?.body ?? '');
  const [confidentiality, setConfidentiality] = useState<DocumentConfidentiality>(
    initial?.confidentiality ?? 'internal',
  );
  const [urgency, setUrgency] = useState<DocumentUrgency>(initial?.urgency ?? 'normal');
  const [audience, setAudience] = useState<CircularAudience>(
    initial?.audience ?? { allStaff: false, groups: [], userIds: [] },
  );
  const [requiresAck, setRequiresAck] = useState(initial?.requiresAcknowledgement ?? true);
  const [ackDue, setAckDue] = useState(toLocalInput(initial?.acknowledgementDueAt));
  const [remindersOn, setRemindersOn] = useState(
    initial ? initial.reminderIntervalHours !== null : true,
  );
  const [reminderHours, setReminderHours] = useState(initial?.reminderIntervalHours ?? 24);
  const [maxReminders, setMaxReminders] = useState(initial?.maxReminders ?? 3);
  const [expiresAt, setExpiresAt] = useState(toLocalInput(initial?.expiresAt));

  const [attachments, setAttachments] = useState<DraftAttachment[]>(() =>
    initialAttachments(initial),
  );
  const [attachmentsDirty, setAttachmentsDirty] = useState(false);
  const [uploadingName, setUploadingName] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [showErrors, setShowErrors] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const { startUpload, uploadProgress } = useMultipartUploader();
  const { data: docsData } = useDocuments({ limit: 100 }, { enabled: canLinkDocuments });
  const documentOptions = useMemo(
    () =>
      (docsData?.data ?? [])
        .filter((d) => !attachments.some((a) => a.kind === 'document' && a.documentId === d.id))
        .map((d) => ({ value: d.id, label: d.title, hint: d.referenceNumber ?? undefined })),
    [docsData, attachments],
  );

  const changeAttachments = (next: DraftAttachment[]) => {
    setAttachments(next);
    setAttachmentsDirty(true);
  };

  const handleFiles = async (files: FileList | null) => {
    if (!files?.length) return;
    for (const file of Array.from(files)) {
      setUploadingName(file.name);
      try {
        const checksum = await calculateChecksum(file);
        const fileUrl = await startUpload({
          file,
          fileName: file.name,
          folderName: 'edmsCirculars',
        });
        setAttachments((cur) => [
          ...cur,
          {
            key: `${Date.now()}-${file.name}`,
            kind: 'file',
            fileUrl,
            fileName: file.name,
            mimeType: resolveUploadMimeType(file) ?? file.type,
            fileSize: file.size,
            checksum,
          },
        ]);
        setAttachmentsDirty(true);
      } catch (err: any) {
        addToast(`${file.name}: ${err?.message || 'upload failed'}`, 'error');
      }
    }
    setUploadingName(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const errors = {
    title: !title.trim() ? 'Title is required' : null,
    body: !body.trim() ? 'Body is required' : null,
    audience: isAudienceEmpty(audience)
      ? 'Choose an audience: all staff, a department or role group, or named people'
      : null,
    dates:
      requiresAck && ackDue && expiresAt && new Date(ackDue) > new Date(expiresAt)
        ? 'The acknowledgement deadline must be on or before the expiry date'
        : null,
  };
  const hasErrors = Object.values(errors).some(Boolean);

  const submit = async () => {
    if (hasErrors) {
      setShowErrors(true);
      return;
    }
    // An empty optional field on create is simply omitted; on edit it is sent as null to clear it.
    const clear = initial ? null : undefined;
    const values: CircularFormValues = {
      title: title.trim(),
      body: body.trim(),
      category: category.trim() || clear,
      confidentiality,
      urgency,
      audience: cleanAudience(audience),
      requiresAcknowledgement: requiresAck,
      // Turning acknowledgement off makes the backend drop the deadline itself.
      acknowledgementDueAt: requiresAck ? (toIso(ackDue) ?? clear) : undefined,
      reminderIntervalHours: requiresAck && remindersOn ? reminderHours : null,
      maxReminders,
      expiresAt: toIso(expiresAt) ?? clear,
    };
    if (!initial || attachmentsDirty) {
      values.attachments = attachments.map((a) =>
        a.kind === 'document'
          ? { documentId: a.documentId }
          : {
              fileUrl: a.fileUrl,
              fileName: a.fileName,
              mimeType: a.mimeType,
              fileSize: a.fileSize,
              checksum: a.checksum,
            },
      );
    }
    setSubmitting(true);
    try {
      await onSubmit(values);
    } catch {
      // The mutation hook has already shown the error; keep the form as it is.
    } finally {
      setSubmitting(false);
    }
  };

  const err = (msg: string | null) => (showErrors && msg ? <div className="err">{msg}</div> : null);

  return (
    <div
      className="grid"
      style={{ gridTemplateColumns: 'minmax(0, 2fr) minmax(0, 1fr)', alignItems: 'start' }}
    >
      <div>
        <div className="card mb-4">
          <div className="card-head">
            <span className="h3">Content</span>
          </div>
          <div className="card-body">
            <div className="field">
              <label htmlFor="cir-title">
                Title <span className="req">*</span>
              </label>
              <input
                id="cir-title"
                className="input"
                maxLength={255}
                value={title}
                placeholder="e.g. Revised travel expense policy"
                onChange={(e) => setTitle(e.target.value)}
              />
              {err(errors.title)}
            </div>
            <div className="field">
              <label htmlFor="cir-category">Category</label>
              <input
                id="cir-category"
                className="input"
                maxLength={100}
                value={category}
                placeholder="e.g. Policy, HR, IT"
                onChange={(e) => setCategory(e.target.value)}
              />
            </div>
            <div className="field">
              <label htmlFor="cir-body">
                Body <span className="req">*</span>
              </label>
              <textarea
                id="cir-body"
                className="input"
                style={{ minHeight: 220, lineHeight: 1.6 }}
                maxLength={50000}
                value={body}
                placeholder="Write the circular…"
                onChange={(e) => setBody(e.target.value)}
              />
              {err(errors.body)}
            </div>
          </div>
        </div>

        <div className="card mb-4">
          <div className="card-head">
            <span className="h3">Audience</span>
          </div>
          <div className="card-body">
            <AudienceEditor value={audience} onChange={setAudience} />
            {err(errors.audience)}
            <div className="help mt-2">Recipients are fixed when the circular is published.</div>
          </div>
        </div>

        <div className="card mb-4">
          <div className="card-head">
            <span className="h3">
              <Icon name="doc" size={16} /> Attachments
            </span>
          </div>
          <div className="card-body">
            {attachments.map((a) => (
              <div key={a.key} className="metric-li">
                <span className="flex items-center gap-2" style={{ minWidth: 0 }}>
                  <Icon name={a.kind === 'document' ? 'cabinet' : 'doc'} size={14} />
                  <span>{a.kind === 'document' ? a.title : a.fileName}</span>
                  {a.kind === 'file' && (
                    <span className="caption">{formatFileSize(a.fileSize)}</span>
                  )}
                  {a.kind === 'document' && <span className="caption">Linked document</span>}
                </span>
                <button
                  type="button"
                  className="btn btn-ghost btn-sm"
                  aria-label={`Remove ${a.kind === 'document' ? a.title : a.fileName}`}
                  onClick={() => changeAttachments(attachments.filter((x) => x.key !== a.key))}
                >
                  <Icon name="x" size={13} />
                </button>
              </div>
            ))}
            {uploadingName && (
              <div className="metric-li">
                <span className="caption">Uploading {uploadingName}…</span>
                <span className="caption">{uploadProgress}%</span>
              </div>
            )}
            <div className="flex gap-2 flex-wrap mt-2" style={{ alignItems: 'center' }}>
              <input
                ref={fileInputRef}
                type="file"
                multiple
                hidden
                onChange={(e) => handleFiles(e.target.files)}
              />
              <button
                type="button"
                className="btn btn-secondary btn-sm"
                disabled={!!uploadingName || attachments.length >= 20}
                onClick={() => fileInputRef.current?.click()}
              >
                <Icon name="upload" size={13} /> Upload file
              </button>
              {canLinkDocuments && (
                <div style={{ flex: '1 1 220px' }}>
                  <Combobox
                    options={documentOptions}
                    value=""
                    disabled={attachments.length >= 20}
                    placeholder="Link an existing document…"
                    searchPlaceholder="Search documents…"
                    onChange={(id) => {
                      const doc = docsData?.data.find((d) => d.id === id);
                      if (doc) {
                        changeAttachments([
                          ...attachments,
                          { key: doc.id, kind: 'document', documentId: doc.id, title: doc.title },
                        ]);
                      }
                    }}
                  />
                </div>
              )}
            </div>
            <div className="help mt-2">
              Linked documents stay governed by their own permissions. Up to 20 attachments.
            </div>
          </div>
        </div>
      </div>

      <div>
        <div className="card mb-4">
          <div className="card-head">
            <span className="h3">Classification</span>
          </div>
          <div className="card-body">
            <div className="field">
              <label htmlFor="cir-conf">Confidentiality</label>
              <select
                id="cir-conf"
                className="input"
                value={confidentiality}
                onChange={(e) => setConfidentiality(e.target.value as DocumentConfidentiality)}
              >
                {CONFIDENTIALITY_OPTIONS.map(([v, l]) => (
                  <option key={v} value={v}>
                    {l}
                  </option>
                ))}
              </select>
            </div>
            <div className="field">
              <label htmlFor="cir-urg">Urgency</label>
              <select
                id="cir-urg"
                className="input"
                value={urgency}
                onChange={(e) => setUrgency(e.target.value as DocumentUrgency)}
              >
                {URGENCY_OPTIONS.map(([v, l]) => (
                  <option key={v} value={v}>
                    {l}
                  </option>
                ))}
              </select>
              <div className="help">
                High and critical are delivered straight away, not in digests.
              </div>
            </div>
            <div className="field" style={{ marginBottom: 0 }}>
              <label>Expires</label>
              <DateTimeField
                value={expiresAt}
                onChange={setExpiresAt}
                placeholder="Never"
                aria-label="Expiry date"
              />
              <div className="help">After this it moves to recipients&apos; archive.</div>
            </div>
          </div>
        </div>

        <div className="card mb-4">
          <div className="card-head">
            <span className="h3">Acknowledgement</span>
          </div>
          <div className="card-body">
            <label className="check mb-2">
              <input
                type="checkbox"
                checked={requiresAck}
                onChange={(e) => setRequiresAck(e.target.checked)}
              />
              Recipients must acknowledge it
            </label>
            {requiresAck && (
              <>
                <div className="field" style={{ marginTop: 12 }}>
                  <label>Acknowledge by</label>
                  <DateTimeField
                    value={ackDue}
                    onChange={setAckDue}
                    placeholder="No deadline"
                    aria-label="Acknowledgement deadline"
                  />
                  {err(errors.dates)}
                </div>
                <label className="check mb-2">
                  <input
                    type="checkbox"
                    checked={remindersOn}
                    onChange={(e) => setRemindersOn(e.target.checked)}
                  />
                  Remind people who haven&apos;t acknowledged
                </label>
                {remindersOn && (
                  <div className="grid cols-2" style={{ gap: 10, marginTop: 8 }}>
                    <div className="field" style={{ marginBottom: 0 }}>
                      <label htmlFor="cir-int">Every (hours)</label>
                      <input
                        id="cir-int"
                        type="number"
                        className="input"
                        min={1}
                        max={720}
                        value={reminderHours}
                        onChange={(e) =>
                          setReminderHours(Math.min(720, Math.max(1, Number(e.target.value) || 1)))
                        }
                      />
                    </div>
                    <div className="field" style={{ marginBottom: 0 }}>
                      <label htmlFor="cir-max">At most</label>
                      <input
                        id="cir-max"
                        type="number"
                        className="input"
                        min={0}
                        max={10}
                        value={maxReminders}
                        onChange={(e) =>
                          setMaxReminders(Math.min(10, Math.max(0, Number(e.target.value) || 0)))
                        }
                      />
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        </div>

        <div className="flex gap-2" style={{ justifyContent: 'flex-end' }}>
          <button
            type="button"
            className="btn btn-secondary"
            onClick={onCancel}
            disabled={submitting}
          >
            Cancel
          </button>
          <button
            type="button"
            className="btn btn-primary"
            onClick={submit}
            disabled={submitting || !!uploadingName}
          >
            {submitting && <span className="btn-spinner" aria-hidden="true" />}
            {submitLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
