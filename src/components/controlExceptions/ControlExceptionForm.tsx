'use client';

import React, { useMemo, useState } from 'react';
import { usePermissions } from '@/hooks/usePermissions';
import { useDepartments } from '@/apis/hooks/useDepartments';
import { departmentOptions } from '@/apis/utils/managementAggregation';
import { DocumentPicker } from '@/components/documents/DocumentPicker';
import {
  CATEGORIES,
  CATEGORY_LABEL,
  SEVERITIES,
  SEVERITY_LABEL,
} from '@/components/controlExceptions/controlExceptionLabels';
import type {
  ControlException,
  ControlExceptionCategory,
  ControlExceptionInput,
  ControlExceptionSeverity,
} from '@/types/models';

interface ControlExceptionFormProps {
  /** The exception being edited; omitted when raising a new one. */
  initial?: ControlException;
  submitLabel: string;
  onSubmit: (values: ControlExceptionInput) => Promise<unknown>;
  onCancel: () => void;
}

/** Raise or edit a control exception. Both live on their own page, not in a modal. */
export function ControlExceptionForm({
  initial,
  submitLabel,
  onSubmit,
  onCancel,
}: ControlExceptionFormProps) {
  const { hasPermission } = usePermissions();
  const canLinkDocuments = hasPermission('document', 'view');
  const { data: deptData } = useDepartments();
  const departments = useMemo(() => departmentOptions(deptData?.data ?? []), [deptData]);

  const [title, setTitle] = useState(initial?.title ?? '');
  const [description, setDescription] = useState(initial?.description ?? '');
  const [category, setCategory] = useState<ControlExceptionCategory | ''>(initial?.category ?? '');
  const [severity, setSeverity] = useState<ControlExceptionSeverity>(initial?.severity ?? 'medium');
  const [departmentId, setDepartmentId] = useState(initial?.departmentId ?? '');
  const [documentId, setDocumentId] = useState(initial?.documentId ?? '');
  const [submitting, setSubmitting] = useState(false);
  const [showErrors, setShowErrors] = useState(false);

  const errors = {
    title: title.trim() ? null : 'Give the exception a title.',
    description: description.trim() ? null : 'Describe what was found.',
    category: category ? null : 'Pick a category.',
  };
  const err = (msg: string | null) => (showErrors && msg ? <div className="err">{msg}</div> : null);

  const submit = async () => {
    if (errors.title || errors.description || errors.category) {
      setShowErrors(true);
      return;
    }
    setSubmitting(true);
    try {
      // Editing sends null to unlink; a new exception just leaves the link out.
      await onSubmit({
        title: title.trim(),
        description: description.trim(),
        category: category as ControlExceptionCategory,
        severity,
        departmentId: departmentId || (initial ? null : undefined),
        documentId: documentId || (initial ? null : undefined),
      });
    } catch {
      // The mutation hook has already shown the error.
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div
      className="grid"
      style={{ gridTemplateColumns: 'minmax(0, 2fr) minmax(0, 1fr)', alignItems: 'start' }}
    >
      <div>
        <div className="card mb-4">
          <div className="card-head">
            <span className="h3">What was found</span>
          </div>
          <div className="card-body">
            <div className="field">
              <label htmlFor="ce-title">
                Title <span className="req">*</span>
              </label>
              <input
                id="ce-title"
                className="input"
                maxLength={200}
                value={title}
                placeholder="e.g. Office supplies contract awarded on a single quote"
                onChange={(e) => setTitle(e.target.value)}
              />
              {err(errors.title)}
            </div>
            <div className="field">
              <label htmlFor="ce-description">
                Description <span className="req">*</span>
              </label>
              <textarea
                id="ce-description"
                className="input"
                style={{ minHeight: 200, lineHeight: 1.6 }}
                maxLength={5000}
                value={description}
                placeholder="What happened, what control it bypassed, and the evidence you saw."
                onChange={(e) => setDescription(e.target.value)}
              />
              {err(errors.description)}
            </div>
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
          <button type="button" className="btn btn-primary" onClick={submit} disabled={submitting}>
            {submitting && <span className="btn-spinner" aria-hidden="true" />}
            {submitLabel}
          </button>
        </div>
      </div>

      <div>
        <div className="card mb-4">
          <div className="card-head">
            <span className="h3">Classification</span>
          </div>
          <div className="card-body">
            <div className="field">
              <label htmlFor="ce-category">
                Category <span className="req">*</span>
              </label>
              <select
                id="ce-category"
                className="input"
                value={category}
                onChange={(e) => setCategory(e.target.value as ControlExceptionCategory)}
              >
                <option value="">Select a category…</option>
                {CATEGORIES.map((c) => (
                  <option key={c} value={c}>
                    {CATEGORY_LABEL[c]}
                  </option>
                ))}
              </select>
              {err(errors.category)}
            </div>
            <div className="field">
              <label htmlFor="ce-severity">Severity</label>
              <select
                id="ce-severity"
                className="input"
                value={severity}
                onChange={(e) => setSeverity(e.target.value as ControlExceptionSeverity)}
              >
                {SEVERITIES.map((s) => (
                  <option key={s} value={s}>
                    {SEVERITY_LABEL[s]}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>

        <div className="card mb-4">
          <div className="card-head">
            <span className="h3">Where it was seen</span>
          </div>
          <div className="card-body">
            <div className="field">
              <label htmlFor="ce-department">Department</label>
              <select
                id="ce-department"
                className="input"
                value={departmentId}
                onChange={(e) => setDepartmentId(e.target.value)}
              >
                <option value="">Not tied to a department</option>
                {departments.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.label}
                  </option>
                ))}
              </select>
            </div>
            {canLinkDocuments && (
              <div className="field">
                <label>Document</label>
                <DocumentPicker
                  value={documentId}
                  onChange={setDocumentId}
                  initialOption={
                    initial?.document
                      ? {
                          value: initial.document.id,
                          label: initial.document.title,
                          hint: initial.document.referenceNumber,
                        }
                      : null
                  }
                  ariaLabel="Document"
                />
                {documentId && (
                  <button
                    type="button"
                    className="btn btn-ghost btn-sm mt-2"
                    onClick={() => setDocumentId('')}
                  >
                    Remove document
                  </button>
                )}
              </div>
            )}
            <div className="help">
              Both are optional. Link them when the exception can be pinned to one.
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
