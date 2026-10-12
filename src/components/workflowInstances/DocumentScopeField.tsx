'use client';

import React from 'react';

export interface ScopeDocument {
  id: string;
  title: string;
}

/**
 * "Apply to" for a task covering several documents: approve, reject and
 * review can act on some of them (edms-backend `919d0ef`). Everything starts
 * ticked; unticked documents stay at this stage in a new task for the same
 * person. `chosen` is mutated in place, like the other uncontrolled modal
 * bodies here.
 *
 * `documents` are the ones the caller has Action access to. `heldBack` counts
 * the task's other documents: they can't be picked, and stay waiting the same
 * way. With one document and none held back there's nothing to choose or say,
 * so it renders nothing.
 */
export function DocumentScopeField({
  documents,
  chosen,
  label,
  heldBack = 0,
}: {
  documents: ScopeDocument[];
  chosen: Set<string>;
  label: string;
  heldBack?: number;
}) {
  if (documents.length < 2 && heldBack === 0) return null;
  return (
    <div className="field">
      {documents.length > 1 && (
        <>
          <label>
            {label} <span className="req">*</span>
          </label>
          <div className="flex flex-col gap-2">
            {documents.map((d) => (
              <label key={d.id} className="flex items-center gap-2" style={{ fontWeight: 500 }}>
                <input
                  type="checkbox"
                  defaultChecked={chosen.has(d.id)}
                  onChange={(e) => (e.target.checked ? chosen.add(d.id) : chosen.delete(d.id))}
                />
                {d.title}
              </label>
            ))}
          </div>
          <div className="help">Unticked documents stay at this stage, in a new task for you.</div>
        </>
      )}
      {heldBack > 0 && <HeldBackNote count={heldBack} />}
    </div>
  );
}

/** Why some of the task's documents aren't on offer. */
export function HeldBackNote({ count }: { count: number }) {
  return (
    <div className="banner warning mt-2">
      {count === 1 ? '1 document' : `${count} documents`} in this task{' '}
      {count === 1 ? 'needs' : 'need'} Action access before you can act on{' '}
      {count === 1 ? 'it' : 'them'}. {count === 1 ? 'It stays' : 'They stay'} at this stage, in a
      new task for you.
    </div>
  );
}

/**
 * The request's `documents` for a scope. Omitted only when the action covers
 * the whole task: every offered document is chosen and none was held back
 * (the API's default is every document on the task, and one the caller can't
 * act on would make it refuse the lot). Otherwise the chosen ones, named.
 */
export function scopedDocuments(documents: ScopeDocument[], chosen: Set<string>, heldBack = 0) {
  if (heldBack === 0 && documents.every((d) => chosen.has(d.id))) return undefined;
  return documents.filter((d) => chosen.has(d.id)).map((d) => ({ documentId: d.id }));
}
