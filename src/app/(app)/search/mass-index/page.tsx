'use client';

import React, { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useQueries } from '@tanstack/react-query';
import { useStore } from '@/store/useStore';
import { useUIStore } from '@/store/useUIStore';
import { usePermissions } from '@/hooks/usePermissions';
import { cabinetsService } from '@/apis/services/cabinets.service';
import { documentsService, type MetadataBatchItem } from '@/apis/services/documents.service';
import { cabinetKeys } from '@/apis/hooks/useCabinets';
import {
  documentKeys,
  MetadataBatchError,
  useUpdateMetadataBatch,
} from '@/apis/hooks/useDocuments';
import { cabinetAllows, cabinetLevelFor } from '@/components/cabinets/cabinetAccess';
import {
  MetadataFieldInput,
  isMetadataValueMissing,
  toInputValue,
} from '@/components/documents/MetadataFieldInput';
import { Skeleton } from '@/components/common/Skeleton';
import {
  loadMassIndexSelection,
  saveMassIndexSelection,
  type MassIndexItem,
} from '@/utils/massIndexSelection';
import type {
  Cabinet,
  CabinetAccessPermission,
  CabinetMetadataField,
  DocumentMetadataField,
} from '@/types/models';

interface Problem {
  fieldId: string;
  text: string;
}

/** Values typed so far: document id → field id → value, as the field's input produces it. */
type Edits = Record<string, Record<string, string>>;

interface Row {
  item: MassIndexItem;
  metadata: DocumentMetadataField[] | undefined;
  loading: boolean;
  failed: boolean;
}

interface Group {
  cabinetId: string;
  cabinet: Cabinet | undefined;
  loading: boolean;
  level: CabinetAccessPermission | null;
  fields: CabinetMetadataField[];
  rows: Row[];
}

const savedValue = (row: Row, field: CabinetMetadataField) =>
  toInputValue(field, row.metadata?.find((m) => m.fieldId === field.id)?.value);

/** Fill in metadata on many documents at once: one table per cabinet, saved in batches of 50. */
export default function MassIndexPage() {
  const { setPageTitle, addToast } = useUIStore();
  const { can } = usePermissions();
  const currentUser = useStore((s) => s.currentUser);
  const canIndex = can('document_metadata', 'edit');

  // Read after mount: session storage doesn't exist during the server render.
  const [items, setItems] = useState<MassIndexItem[] | null>(null);
  useEffect(() => setItems(loadMassIndexSelection()), []);
  useEffect(() => setPageTitle('Index documents'), [setPageTitle]);

  const [edits, setEdits] = useState<Edits>({});
  const [fill, setFill] = useState<Record<string, string>>({});
  const [progress, setProgress] = useState<number | null>(null);
  const [failure, setFailure] = useState<string | null>(null);
  const save = useUpdateMetadataBatch();

  const list = useMemo(() => items ?? [], [items]);
  const cabinetIds = useMemo(() => [...new Set(list.map((d) => d.cabinetId))], [list]);

  const cabinetQueries = useQueries({
    queries: cabinetIds.map((id) => ({
      queryKey: cabinetKeys.detail(id),
      queryFn: () => cabinetsService.getById(id),
      enabled: canIndex,
    })),
  });
  // `GET /documents/:id/metadata` isn't audited, unlike `GET /documents/:id`.
  const metadataQueries = useQueries({
    queries: list.map((d) => ({
      queryKey: documentKeys.metadata(d.id),
      queryFn: () => documentsService.getMetadata(d.id),
      enabled: canIndex,
      retry: false,
    })),
  });

  const groups: Group[] = cabinetIds.map((cabinetId, i) => {
    const cabinet = cabinetQueries[i]?.data;
    return {
      cabinetId,
      cabinet,
      loading: !!cabinetQueries[i]?.isLoading,
      level: cabinetLevelFor(cabinet, currentUser),
      fields: [...(cabinet?.metadataFields ?? [])].sort((a, b) => a.displayOrder - b.displayOrder),
      rows: list.flatMap((item, j) =>
        item.cabinetId === cabinetId
          ? [
              {
                item,
                metadata: metadataQueries[j]?.data,
                loading: !!metadataQueries[j]?.isLoading,
                failed: !!metadataQueries[j]?.isError,
              },
            ]
          : [],
      ),
    };
  });

  const valueOf = (row: Row, field: CabinetMetadataField) =>
    edits[row.item.id]?.[field.id] ?? savedValue(row, field);
  const changedFields = (row: Row, fields: CabinetMetadataField[]) =>
    fields.filter((f) => {
      const typed = edits[row.item.id]?.[f.id];
      return typed !== undefined && typed !== savedValue(row, f);
    });

  /** Checked here because the API's errors don't say which document they're about. */
  const problemsOf = (row: Row, fields: CabinetMetadataField[]): Problem[] =>
    fields.flatMap((f) => {
      const v = valueOf(row, f);
      const at = (text: string) => [{ fieldId: f.id, text }];
      if (isMetadataValueMissing(f, v)) return at(`${f.name} is required`);
      if (f.fieldType === 'number' && v.trim() && Number.isNaN(Number(v))) {
        return at(`${f.name} must be a number`);
      }
      // The API skips empty values, so a cleared field would keep its old value.
      if (!v.trim() && savedValue(row, f)) return at(`${f.name}: a saved value can't be removed`);
      return [];
    });

  const editable = (g: Group) => cabinetAllows(g.level, 'edit');
  const pending = groups.flatMap((g) =>
    editable(g)
      ? g.rows
          .filter((r) => r.metadata && changedFields(r, g.fields).length > 0)
          .map((r) => ({ row: r, group: g, problems: problemsOf(r, g.fields) }))
      : [],
  );
  const blocked = pending.filter((p) => p.problems.length > 0).length;
  const dirty = pending.length > 0;

  useEffect(() => {
    if (!dirty) return;
    const warn = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [dirty]);

  const setCell = (docId: string, fieldId: string, value: string) =>
    setEdits((cur) => ({ ...cur, [docId]: { ...cur[docId], [fieldId]: value } }));

  const applyToAll = (g: Group, field: CabinetMetadataField) => {
    const value = fill[field.id] ?? '';
    setEdits((cur) => {
      const next = { ...cur };
      g.rows.forEach((r) => (next[r.item.id] = { ...next[r.item.id], [field.id]: value }));
      return next;
    });
  };

  const removeRow = (docId: string) => {
    const rest = list.filter((d) => d.id !== docId);
    setItems(rest);
    saveMassIndexSelection(rest);
    setEdits(({ [docId]: _dropped, ...rest }) => rest);
  };

  const clearSaved = (ids: string[]) =>
    setEdits((cur) => {
      const next = { ...cur };
      ids.forEach((id) => delete next[id]);
      return next;
    });

  const submit = () => {
    const batch: MetadataBatchItem[] = pending.map(({ row, group }) => ({
      documentId: row.item.id,
      metadata: changedFields(row, group.fields).map((f) => ({
        fieldId: f.id,
        value: valueOf(row, f),
      })),
    }));
    setFailure(null);
    setProgress(0);
    save.mutate(
      { items: batch, onProgress: setProgress },
      {
        onSuccess: (saved) => {
          clearSaved(saved);
          addToast(
            `Saved metadata on ${saved.length} document${saved.length === 1 ? '' : 's'}`,
            'success',
          );
        },
        onError: (err) => {
          const saved = err instanceof MetadataBatchError ? err.saved : [];
          clearSaved(saved);
          setFailure(
            `${saved.length ? `Saved ${saved.length} of ${batch.length}. ` : ''}` +
              `The rest weren't saved: ${err.message}`,
          );
        },
        onSettled: () => setProgress(null),
      },
    );
  };

  const back = (
    <Link href="/search" className="btn btn-secondary btn-sm">
      Back to search
    </Link>
  );
  const explain = (message: string) => (
    <div className="card">
      <div className="card-body">
        <p>{message}</p>
        <div className="mt-2">{back}</div>
      </div>
    </div>
  );

  if (!canIndex) return explain("Your role can't change document metadata.");
  if (items === null) return <Skeleton height={240} radius={16} style={{ width: '100%' }} />;
  if (items.length === 0) {
    return explain('No documents picked. Select documents on Search, then choose Index selected.');
  }

  return (
    <div>
      <div className="page-head">
        <div>
          <div className="page-title">Index documents</div>
          <div className="page-sub">
            {`${items.length} document${items.length === 1 ? '' : 's'}. `}
            Fill in each document&apos;s metadata, then save them all at once.
          </div>
        </div>
        {back}
      </div>

      {groups.map((g) => (
        <CabinetTable
          key={g.cabinetId}
          group={g}
          editable={editable(g)}
          valueOf={valueOf}
          problemsOf={(r) => (changedFields(r, g.fields).length ? problemsOf(r, g.fields) : [])}
          isChanged={(r, f) => changedFields(r, [f]).length > 0}
          setCell={setCell}
          fill={fill}
          setFill={(fieldId, v) => setFill((cur) => ({ ...cur, [fieldId]: v }))}
          applyToAll={(f) => applyToAll(g, f)}
          removeRow={removeRow}
          disabled={save.isPending}
        />
      ))}

      <div className="bulkbar" style={{ position: 'sticky', bottom: 12 }}>
        <b>
          {progress !== null
            ? `Saving ${progress} of ${pending.length}…`
            : dirty
              ? `${pending.length} document${pending.length === 1 ? '' : 's'} changed`
              : 'No changes yet'}
        </b>
        {blocked > 0 && progress === null && (
          <span style={{ fontSize: '12px', opacity: 0.85 }}>
            Fix {blocked} document{blocked === 1 ? '' : 's'} marked in red first.
          </span>
        )}
        <button
          className="btn btn-primary btn-sm"
          style={{ marginLeft: 'auto' }}
          disabled={!dirty || blocked > 0 || save.isPending}
          onClick={submit}
        >
          {save.isPending ? 'Saving…' : 'Save all'}
        </button>
      </div>
      {failure && (
        <div className="card" role="alert">
          <div className="card-body" style={{ color: 'var(--status-overdue)' }}>
            {failure} Each batch of up to 50 is saved whole or not at all, so the documents still
            marked as changed have their old values.
          </div>
        </div>
      )}
    </div>
  );
}

interface TableProps {
  group: Group;
  editable: boolean;
  valueOf: (row: Row, field: CabinetMetadataField) => string;
  problemsOf: (row: Row) => Problem[];
  isChanged: (row: Row, field: CabinetMetadataField) => boolean;
  setCell: (docId: string, fieldId: string, value: string) => void;
  fill: Record<string, string>;
  setFill: (fieldId: string, value: string) => void;
  applyToAll: (field: CabinetMetadataField) => void;
  removeRow: (docId: string) => void;
  disabled: boolean;
}

function CabinetTable({
  group,
  editable,
  valueOf,
  problemsOf,
  isChanged,
  setCell,
  fill,
  setFill,
  applyToAll,
  removeRow,
  disabled,
}: TableProps) {
  const { cabinet, fields, rows, level } = group;
  const name = cabinet?.name ?? 'Cabinet';

  let notice: string | null = null;
  if (!group.loading && !cabinet) notice = "This cabinet couldn't be loaded.";
  else if (cabinet && level && !editable) {
    notice = `Indexing needs Edit access on ${name}. Yours is ${level}, so these documents will be left out.`;
  } else if (cabinet && fields.length === 0) {
    notice = 'This cabinet has no metadata fields to fill in.';
  }

  return (
    <div className="card mb-4">
      <div className="card-head">
        <div>
          <div className="h3">{name}</div>
          <div className="caption">{`${rows.length} document${rows.length === 1 ? '' : 's'}`}</div>
        </div>
      </div>
      {group.loading ? (
        <div className="card-body">
          <Skeleton height={120} radius={10} style={{ width: '100%' }} />
        </div>
      ) : notice ? (
        <div className="card-body">
          <p className="caption">{notice}</p>
          <ul className="caption" style={{ marginTop: 6, paddingLeft: 18 }}>
            {rows.map((r) => (
              <li key={r.item.id}>{r.item.title}</li>
            ))}
          </ul>
        </div>
      ) : (
        <div className="tbl-wrap">
          <table className="tbl">
            <thead>
              <tr>
                <th style={{ minWidth: 220 }}>Document</th>
                {fields.map((f) => (
                  <th key={f.id} style={{ minWidth: 180 }}>
                    {f.name}
                    {f.isRequired && ' *'}
                  </th>
                ))}
                <th aria-label="Remove" />
              </tr>
            </thead>
            <tbody>
              {rows.length > 1 && (
                <tr style={{ background: 'var(--panel-2)' }}>
                  <td>
                    <b>All rows</b>
                    <div className="caption">Type a value, then Apply to fill the column.</div>
                  </td>
                  {fields.map((f) => (
                    <td key={f.id}>
                      <div className="flex items-center gap-2">
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <MetadataFieldInput
                            field={f}
                            value={fill[f.id] ?? ''}
                            onChange={(v) => setFill(f.id, v)}
                          />
                        </div>
                        <button
                          className="btn btn-ghost btn-sm"
                          disabled={disabled}
                          onClick={() => applyToAll(f)}
                          aria-label={`Apply to every ${f.name}`}
                        >
                          Apply
                        </button>
                      </div>
                    </td>
                  ))}
                  <td />
                </tr>
              )}
              {rows.map((r) => {
                const problems = problemsOf(r);
                return (
                  <tr key={r.item.id}>
                    <td>
                      <Link href={`/doc/${r.item.id}`} target="_blank" style={{ fontWeight: 500 }}>
                        {r.item.title}
                      </Link>
                      {r.item.referenceNumber && (
                        <div className="caption">{r.item.referenceNumber}</div>
                      )}
                      {r.failed && (
                        <div className="caption" style={{ color: 'var(--status-overdue)' }}>
                          Couldn&apos;t load this document&apos;s metadata; it will be left out.
                        </div>
                      )}
                      {problems.map((p) => (
                        <div
                          key={p.fieldId}
                          className="caption"
                          style={{ color: 'var(--status-overdue)' }}
                        >
                          {p.text}
                        </div>
                      ))}
                    </td>
                    {fields.map((f) => (
                      <td
                        key={f.id}
                        style={
                          isChanged(r, f)
                            ? { boxShadow: 'inset 3px 0 0 var(--status-progress)' }
                            : undefined
                        }
                      >
                        {r.loading ? (
                          <Skeleton height={32} radius={8} style={{ width: '100%' }} />
                        ) : r.metadata ? (
                          <MetadataFieldInput
                            field={f}
                            value={valueOf(r, f)}
                            invalid={problems.some((p) => p.fieldId === f.id)}
                            onChange={(v) => setCell(r.item.id, f.id, v)}
                          />
                        ) : null}
                      </td>
                    ))}
                    <td>
                      <button
                        className="btn btn-ghost btn-sm"
                        disabled={disabled}
                        onClick={() => removeRow(r.item.id)}
                        aria-label={`Leave out ${r.item.title}`}
                      >
                        Remove
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
