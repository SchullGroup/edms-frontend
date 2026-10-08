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
 * person. Renders nothing for a single-document task. `chosen` is mutated in
 * place, like the other uncontrolled modal bodies here.
 */
export function DocumentScopeField({
  documents,
  chosen,
  label,
}: {
  documents: ScopeDocument[];
  chosen: Set<string>;
  label: string;
}) {
  if (documents.length < 2) return null;
  return (
    <div className="field">
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
    </div>
  );
}

/** The request's `documents` for a scope: omitted when every document is chosen
 *  (the API's default), else the chosen ones. */
export function scopedDocuments(documents: ScopeDocument[], chosen: Set<string>) {
  if (documents.every((d) => chosen.has(d.id))) return undefined;
  return documents.filter((d) => chosen.has(d.id)).map((d) => ({ documentId: d.id }));
}
