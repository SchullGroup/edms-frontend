'use client';

import React, { useState } from 'react';
import type { UserGroupInput } from '@/types/models';

interface UserGroupFormProps {
  initial?: { name: string; description: string | null };
  submitLabel: string;
  pending: boolean;
  /** Resolves on success; rejects with the API error, shown above the buttons. */
  onSubmit: (input: UserGroupInput) => Promise<unknown>;
  onCancel: () => void;
  errorMessage: (err: unknown) => string;
}

/** Name and description of a user group; shared by the new and edit pages. */
export function UserGroupForm({
  initial,
  submitLabel,
  pending,
  onSubmit,
  onCancel,
  errorMessage,
}: UserGroupFormProps) {
  const [name, setName] = useState(initial?.name ?? '');
  const [description, setDescription] = useState(initial?.description ?? '');
  const [showErrors, setShowErrors] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);

  const nameError = !name.trim() ? 'Enter a name.' : null;

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setServerError(null);
    if (nameError) {
      setShowErrors(true);
      return;
    }
    const trimmed = description.trim();
    try {
      await onSubmit({
        name: name.trim(),
        // On edit, clearing the box clears the saved description.
        description: trimmed || (initial?.description ? null : undefined),
      });
    } catch (err) {
      setServerError(errorMessage(err));
    }
  };

  return (
    <form style={{ maxWidth: 640 }} onSubmit={submit} noValidate>
      <div className="card mb-4">
        <div className="card-body">
          <div className="field">
            <label htmlFor="ug-name">
              Name <span className="req">*</span>
            </label>
            <input
              id="ug-name"
              className="input"
              maxLength={120}
              value={name}
              placeholder="e.g. Finance reviewers"
              onChange={(e) => setName(e.target.value)}
              aria-invalid={showErrors && !!nameError}
            />
            {showErrors && nameError && <div className="err">{nameError}</div>}
          </div>
          <div className="field">
            <label htmlFor="ug-description">Description</label>
            <textarea
              id="ug-description"
              className="input"
              rows={3}
              maxLength={1000}
              value={description}
              placeholder="Who is in it and what they review"
              onChange={(e) => setDescription(e.target.value)}
            />
          </div>
          {serverError && <div className="banner error mt-2">{serverError}</div>}
        </div>
      </div>

      <div className="flex gap-2" style={{ justifyContent: 'flex-end' }}>
        <button type="button" className="btn btn-secondary" onClick={onCancel} disabled={pending}>
          Cancel
        </button>
        <button type="submit" className="btn btn-primary" disabled={pending}>
          {pending && <span className="btn-spinner" aria-hidden="true" />}
          {submitLabel}
        </button>
      </div>
    </form>
  );
}
