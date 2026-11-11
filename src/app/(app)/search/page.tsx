'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useStore } from '@/store/useStore';
import { useUIStore } from '@/store/useUIStore';
import { documentStatusLabel } from '@/utils/helpers';
import { useDocuments, useDocumentSearch } from '@/apis/hooks/useDocuments';
import { useCabinets } from '@/apis/hooks/useCabinets';
import { useCabinetFolders } from '@/apis/hooks/useFolders';
import { useDepartments } from '@/apis/hooks/useDepartments';
import type { DocumentFilters } from '@/apis/services/documents.service';
import { foldersAsPaths } from '@/utils/folders';
import { DateField } from '@/components/ui/DatePicker';
import { departmentOptions } from '@/apis/utils/managementAggregation';
import { useDebouncedCallback } from '@/hooks/useDebouncedCallback';
import { useRouteToWorkflow } from '@/hooks/useRouteToWorkflow';
import { usePermissions } from '@/hooks/usePermissions';
import {
  MASS_INDEX_MAX,
  saveMassIndexSelection,
  type MassIndexItem,
} from '@/utils/massIndexSelection';
import { DOCUMENT_TYPES } from '@/constants/documentTypes';
import { WORKSTREAMS, workstreamLabel } from '@/constants/documentWorkstreams';
import { Icon } from '@/components/ui/Icons';
import { Pagination } from '@/components/ui/Pagination';
import { ErrorMessage } from '@/components/common/ErrorMessage';
import { exportCsv } from '@/utils/exportCsv';
import { StatusBadge, ConfBadge, UrgBadge } from '@/components/ui/Badges';
import type { Document, SavedSearch } from '@/types/models';
import { SkeletonTaskRows } from '@/components/common/Skeleton';

type Filters = SavedSearch['filters'];
type Option = readonly [value: string, label: string];

const PAGE_SIZE = 20;

// Backend enum values → labels. One value per filter: `GET /documents` takes a
// single value for each, so these are pick-one groups, not checkboxes.
const STATUS_OPTIONS: Option[] = [
  ['pending', 'Pending'],
  ['in_progress', 'In Progress'],
  ['on_hold', 'On Hold'],
  ['closed', 'Closed'],
];
const CONFIDENTIALITY_OPTIONS: Option[] = [
  ['public', 'Public'],
  ['internal', 'Internal'],
  ['confidential', 'Confidential'],
  ['restricted', 'Restricted'],
  ['top_secret', 'Top Secret'],
];
const URGENCY_OPTIONS: Option[] = [
  ['critical', 'Critical'],
  ['high', 'High'],
  ['normal', 'Normal'],
  ['low', 'Low'],
];
const TYPE_OPTIONS: Option[] = DOCUMENT_TYPES.map((t) => [t, t] as const);
const WORKSTREAM_OPTIONS: Option[] = WORKSTREAMS.map((w) => [w.value, w.label] as const);

/** Reads a filter from the URL, accepting the enum (`in_progress`) or its label
 *  (`In Progress`). Unknown values — e.g. the old `status=Overdue`, which isn't a
 *  document status — are ignored rather than filtering everything out. */
function fromParam(raw: string | null, options: Option[]): string | undefined {
  if (!raw) return undefined;
  const norm = raw.trim().toLowerCase().replace(/[\s-]+/g, '_');
  return options.find(([v, l]) => v === norm || l.toLowerCase() === raw.trim().toLowerCase())?.[0];
}

/** A "YYYY-MM-DD" day from the URL; anything else is ignored. */
function dayParam(raw: string | null): string | undefined {
  return raw && /^\d{4}-\d{2}-\d{2}$/.test(raw) && !Number.isNaN(Date.parse(raw)) ? raw : undefined;
}

/** Local midnight of `day` (+ `addDays`) as an ISO instant: the API reads a bare date as UTC. */
function dayStartIso(day: string, addDays = 0): string {
  const [y, m, d] = day.split('-').map(Number);
  return new Date(y, m - 1, d + addDays).toISOString();
}

function FilterGroup({
  title,
  options,
  value,
  onChange,
}: {
  title: string;
  options: Option[];
  value: string | undefined;
  onChange: (value: string | undefined) => void;
}) {
  return (
    <div className="facet-group" role="radiogroup" aria-label={title}>
      <div className="flex justify-between items-center">
        <span className="fg-title">{title}</span>
        {value && (
          <button
            type="button"
            className="btn btn-ghost btn-sm"
            style={{ marginTop: '-9px' }}
            onClick={() => onChange(undefined)}
          >
            Clear
          </button>
        )}
      </div>
      {options.map(([v, label]) => (
        <label className="facet-opt" key={v}>
          <input
            type="radio"
            name={`filter-${title}`}
            checked={value === v}
            readOnly
            // onClick, not onChange: a checked radio never fires onChange, and
            // clicking the selected option should clear it.
            onClick={() => onChange(value === v ? undefined : v)}
          />
          {label}
        </label>
      ))}
    </div>
  );
}

export default function SearchPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const me = useStore((s) => s.currentUser);
  const savedByUser = useStore((s) => s.savedSearches);
  const addSavedSearch = useStore((s) => s.addSavedSearch);
  const removeSavedSearch = useStore((s) => s.removeSavedSearch);
  const { setPageTitle, openModal, addToast } = useUIStore();
  const saved = me ? (savedByUser[me.id] ?? []) : [];

  // Picking documents to route or index together. The selection survives paging, new
  // searches and filter changes on purpose — it's how documents from different
  // folders and cabinets end up in one workflow.
  const { routeDocuments, canRoute } = useRouteToWorkflow();
  const { can } = usePermissions();
  const canIndex = can('document_metadata', 'edit');
  const canSelect = canRoute || canIndex;
  type Picked = Pick<
    Document,
    'id' | 'title' | 'status' | 'createdBy' | 'cabinetId' | 'referenceNumber'
  >;
  const [selected, setSelected] = useState<Map<string, Picked>>(() => new Map());
  const pick = (d: Picked): Picked => ({
    id: d.id,
    title: d.title,
    status: d.status,
    createdBy: d.createdBy,
    cabinetId: d.cabinetId,
    referenceNumber: d.referenceNumber,
  });
  const toggleSelected = (d: Picked, on: boolean) =>
    setSelected((cur) => {
      const next = new Map(cur);
      if (on) next.set(d.id, pick(d));
      else next.delete(d.id);
      return next;
    });
  const indexSelected = () => {
    if (selected.size > MASS_INDEX_MAX) {
      addToast(`Index up to ${MASS_INDEX_MAX} documents at a time`, 'error');
      return;
    }
    const items: MassIndexItem[] = [...selected.values()].map((d) => ({
      id: d.id,
      title: d.title,
      referenceNumber: d.referenceNumber,
      cabinetId: d.cabinetId,
    }));
    if (!saveMassIndexSelection(items)) {
      addToast("Couldn't pass the selection on. Check that this browser allows site storage.", 'error');
      return;
    }
    router.push('/search/mass-index');
  };

  const { data: cabinetsData } = useCabinets();
  const cabinets = useMemo(() => cabinetsData?.data ?? [], [cabinetsData]);
  const cabinetName = useMemo(
    () => new Map(cabinets.map((c: any) => [c.id, c.name as string])),
    [cabinets],
  );

  const { data: departmentsData } = useDepartments();
  const deptOptions = useMemo<Option[]>(
    () => departmentOptions(departmentsData?.data ?? []).map((d) => [d.id, d.label] as const),
    [departmentsData],
  );

  // `input` is what's typed; `q` is the debounced value actually searched.
  const urlQ = searchParams?.get('q') ?? '';
  const [input, setInput] = useState(urlQ);
  const [q, setQ] = useState(urlQ.trim());
  const [page, setPage] = useState(1);
  const [filters, setFilters] = useState<Filters>(() => ({
    cabinetId: searchParams?.get('cabinet') || undefined,
    departmentId: searchParams?.get('dept') || undefined,
    documentType: fromParam(searchParams?.get('type') ?? null, TYPE_OPTIONS),
    workstream: fromParam(
      searchParams?.get('workstream') ?? null,
      WORKSTREAM_OPTIONS,
    ) as Filters['workstream'],
    status: fromParam(searchParams?.get('status') ?? null, STATUS_OPTIONS) as Filters['status'],
    confidentiality: fromParam(
      searchParams?.get('confidentiality') ?? searchParams?.get('conf') ?? null,
      CONFIDENTIALITY_OPTIONS,
    ) as Filters['confidentiality'],
    urgency: fromParam(searchParams?.get('urgency') ?? null, URGENCY_OPTIONS) as Filters['urgency'],
    folderId: (searchParams?.get('cabinet') && searchParams?.get('folder')) || undefined,
    from: dayParam(searchParams?.get('from') ?? null),
    to: dayParam(searchParams?.get('to') ?? null),
  }));

  // Folders of the picked cabinet, each with its path ("Finance / Invoices").
  const foldersQuery = useCabinetFolders(filters.cabinetId);
  const folderOptions = useMemo(
    () => foldersAsPaths(foldersQuery.data?.data ?? []),
    [foldersQuery.data],
  );

  // A folder from the URL or a saved search may have been deleted or hidden since.
  useEffect(() => {
    if (!filters.folderId || !foldersQuery.isSuccess) return;
    if (folderOptions.some((f) => f.id === filters.folderId)) return;
    setFilters((f) => ({ ...f, folderId: undefined }));
    addToast('The folder in this search is no longer available', 'info');
  }, [filters.folderId, foldersQuery.isSuccess, folderOptions, addToast]);

  // The end day is inclusive here and exclusive in the API, so it's sent as the next midnight.
  const rangeInvalid = !!(filters.from && filters.to && filters.from > filters.to);
  const apiFilters = useMemo<DocumentFilters>(() => {
    const { from, to, ...rest } = filters;
    if (rangeInvalid) return rest;
    return {
      ...rest,
      from: from ? dayStartIso(from) : undefined,
      to: to ? dayStartIso(to, 1) : undefined,
    };
  }, [filters, rangeInvalid]);

  useEffect(() => {
    setPageTitle('Search');
  }, [setPageTitle]);

  // The sidebar search box navigates to /search?q=… — follow it even when
  // we're already on this page.
  useEffect(() => {
    setInput(urlQ);
    setQ(urlQ.trim());
    setPage(1);
  }, [urlQ]);

  const searchText = useDebouncedCallback((value: string) => {
    setQ(value.trim());
    setPage(1);
  }, 350);

  // Text search (`GET /documents/search`) takes the same filters as the list
  // endpoint since edms-backend PR #51, so both queries see the same narrowing.
  const textMode = q.length > 0;
  const listQuery = useDocuments(
    { ...apiFilters, page, limit: PAGE_SIZE },
    { enabled: !textMode },
  );
  const searchQuery = useDocumentSearch(q, { ...apiFilters, page, limit: PAGE_SIZE });
  const active = textMode ? searchQuery : listQuery;
  const results: Document[] = active.data?.data ?? [];
  const pagination = active.data?.pagination;
  const total = pagination?.total ?? results.length;

  const allOnPageSelected = results.length > 0 && results.every((d) => selected.has(d.id));
  const setPageSelected = (on: boolean) =>
    setSelected((cur) => {
      const next = new Map(cur);
      results.forEach((d) => (on ? next.set(d.id, pick(d)) : next.delete(d.id)));
      return next;
    });

  const setFilter = <K extends keyof Filters>(key: K, value: Filters[K]) => {
    setFilters((f) => ({ ...f, [key]: value }));
    setPage(1);
  };
  const hasFilters = Object.values(filters).some(Boolean);

  const saveSearch = () => {
    if (!me) return;
    let name = q ? `“${q}”` : 'My filter';
    openModal({
      title: 'Save this search',
      body: (
        <div className="field">
          <label>Name</label>
          <input
            className="input"
            defaultValue={name}
            placeholder="e.g. Critical finance invoices"
            onChange={(e) => (name = e.target.value)}
          />
        </div>
      ),
      actions: [
        { label: 'Cancel' },
        {
          label: 'Save',
          kind: 'btn-primary',
          onClick: () => {
            const kept = Object.fromEntries(
              Object.entries(filters).filter(([, v]) => v),
            ) as Filters;
            addSavedSearch(me.id, {
              id: `ss-${Date.now()}`,
              name: name.trim() || 'My filter',
              q,
              filters: kept,
            });
            addToast('Search saved', 'success');
          },
        },
      ],
    });
  };

  const applySaved = (ss: SavedSearch) => {
    let next = { ...ss.filters };
    // A saved cabinet or department may have been deleted since, or be one this
    // user can't see.
    if (next.cabinetId && cabinets.length && !cabinetName.has(next.cabinetId)) {
      next = { ...next, cabinetId: undefined, folderId: undefined };
      addToast('The cabinet in this saved search is no longer available', 'info');
    }
    if (
      next.departmentId &&
      deptOptions.length &&
      !deptOptions.some(([id]) => id === next.departmentId)
    ) {
      next = { ...next, departmentId: undefined };
      addToast('The department in this saved search is no longer available', 'info');
    }
    setInput(ss.q);
    setQ(ss.q);
    setFilters(next);
    setPage(1);
  };

  return (
    <div>
      <div className="page-head">
        <div>
          <div className="page-title">Search</div>
          <div className="page-sub">
            Search document titles and scanned text, or browse everything with filters.
          </div>
        </div>
      </div>

      <div className="mb-4">
        <input
          className="input"
          type="search"
          value={input}
          aria-label="Search documents"
          placeholder="Search titles and document text…"
          style={{ height: '44px', fontSize: '14px' }}
          onChange={(e) => {
            setInput(e.target.value);
            searchText(e.target.value);
          }}
        />
      </div>

      <div className="search-layout">
        <div className="card">
          <div className="facet-group">
            <div className="flex justify-between items-center">
              <span className="fg-title" style={{ marginBottom: 0 }}>
                Saved searches
              </span>
              <button
                className="btn btn-ghost btn-sm"
                title="Save current search"
                disabled={!me || (!q && !hasFilters) || rangeInvalid}
                onClick={saveSearch}
              >
                + Save
              </button>
            </div>
            {saved.length === 0 && (
              <div className="caption" style={{ marginTop: '6px' }}>
                Searches you save appear here.
              </div>
            )}
            {saved.map((ss) => (
              <div
                className="facet-opt"
                style={{ justifyContent: 'space-between' }}
                key={ss.id}
              >
                <button
                  type="button"
                  className="btn btn-ghost btn-sm"
                  style={{ fontWeight: 600, padding: 0 }}
                  onClick={() => applySaved(ss)}
                >
                  {ss.name}
                </button>
                <button
                  className="tag"
                  style={{ border: 0, cursor: 'pointer' }}
                  aria-label={`Delete saved search ${ss.name}`}
                  onClick={() => {
                    if (me) removeSavedSearch(me.id, ss.id);
                    addToast('Saved search removed', 'info');
                  }}
                >
                  ×
                </button>
              </div>
            ))}
          </div>

          <FilterGroup
            title="Cabinet"
            options={cabinets.map((c: any) => [c.id, c.name] as const)}
            value={filters.cabinetId}
            onChange={(v) => {
              // A folder belongs to one cabinet, so it can't outlive the cabinet change.
              setFilters((f) => ({ ...f, cabinetId: v, folderId: undefined }));
              setPage(1);
            }}
          />
          {filters.cabinetId && (
            <div className="facet-group">
              <div className="flex justify-between items-center">
                <span className="fg-title">Folder</span>
                {filters.folderId && (
                  <button
                    type="button"
                    className="btn btn-ghost btn-sm"
                    style={{ marginTop: '-9px' }}
                    onClick={() => setFilter('folderId', undefined)}
                  >
                    Clear
                  </button>
                )}
              </div>
              <select
                className="input"
                aria-label="Folder"
                // The sidebar is narrow; the hover shows a long path in full.
                title={folderOptions.find((f) => f.id === filters.folderId)?.path}
                value={filters.folderId ?? ''}
                disabled={foldersQuery.isLoading || !folderOptions.length}
                onChange={(e) => setFilter('folderId', e.target.value || undefined)}
              >
                <option value="">
                  {foldersQuery.isLoading
                    ? 'Loading folders…'
                    : folderOptions.length
                      ? 'Any folder'
                      : 'No folders in this cabinet'}
                </option>
                {folderOptions.map((f) => (
                  <option key={f.id} value={f.id}>
                    {f.path}
                  </option>
                ))}
              </select>
              {filters.folderId && (
                <div className="caption" style={{ marginTop: '6px' }}>
                  Documents filed in this folder itself, not its sub-folders.
                </div>
              )}
            </div>
          )}
          <FilterGroup
            title="Department"
            options={deptOptions}
            value={filters.departmentId}
            onChange={(v) => setFilter('departmentId', v)}
          />
          <div className="facet-group">
            <div className="flex justify-between items-center">
              <span className="fg-title">Created</span>
              {(filters.from || filters.to) && (
                <button
                  type="button"
                  className="btn btn-ghost btn-sm"
                  style={{ marginTop: '-9px' }}
                  onClick={() => {
                    setFilters((f) => ({ ...f, from: undefined, to: undefined }));
                    setPage(1);
                  }}
                >
                  Clear
                </button>
              )}
            </div>
            <div className="field" style={{ marginBottom: 0 }}>
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'auto 1fr',
                  gap: '8px',
                  alignItems: 'center',
                }}
              >
                <span className="caption">From</span>
                <DateField
                  compact
                  aria-label="Created from"
                  placeholder="Any date"
                  value={filters.from ?? ''}
                  onChange={(v) => setFilter('from', v || undefined)}
                />
                <span className="caption">To</span>
                <DateField
                  compact
                  aria-label="Created to"
                  placeholder="Any date"
                  value={filters.to ?? ''}
                  min={filters.from}
                  onChange={(v) => setFilter('to', v || undefined)}
                />
              </div>
              {rangeInvalid && (
                <div className="err" role="alert">
                  The end date is before the start date, so the dates aren't applied.
                </div>
              )}
            </div>
          </div>
          <FilterGroup
            title="Type"
            options={TYPE_OPTIONS}
            value={filters.documentType}
            onChange={(v) => setFilter('documentType', v)}
          />
          <FilterGroup
            title="Workstream"
            options={WORKSTREAM_OPTIONS}
            value={filters.workstream}
            onChange={(v) => setFilter('workstream', v as Filters['workstream'])}
          />
          <FilterGroup
            title="Status"
            options={STATUS_OPTIONS}
            value={filters.status}
            onChange={(v) => setFilter('status', v as Filters['status'])}
          />
          <FilterGroup
            title="Confidentiality"
            options={CONFIDENTIALITY_OPTIONS}
            value={filters.confidentiality}
            onChange={(v) => setFilter('confidentiality', v as Filters['confidentiality'])}
          />
          <FilterGroup
            title="Urgency"
            options={URGENCY_OPTIONS}
            value={filters.urgency}
            onChange={(v) => setFilter('urgency', v as Filters['urgency'])}
          />
          {hasFilters && (
            <div className="facet-group">
              <button
                type="button"
                className="btn btn-secondary btn-sm"
                onClick={() => {
                  setFilters({});
                  setPage(1);
                }}
              >
                Clear all filters
              </button>
            </div>
          )}
        </div>

        <div className="min-w-0">
          <div className="flex justify-between items-center mb-2">
            <span className="muted" style={{ fontSize: '12.5px' }}>
              {active.isLoading
                ? 'Searching…'
                : `${total} result${total === 1 ? '' : 's'}${q ? ` for “${q}”` : ''}`}
            </span>
            <button
              className="btn btn-secondary btn-sm"
              disabled={!results.length}
              onClick={() =>
                exportCsv(
                  'Search_Results',
                  results.map((d) => ({
                    title: d.title,
                    type: d.documentType ?? '',
                    workstream: workstreamLabel(d.workstream) ?? '',
                    cabinet: cabinetName.get(d.cabinetId) ?? '',
                    status: documentStatusLabel(d),
                    confidentiality: d.confidentiality,
                    urgency: d.urgency,
                    created: d.createdAt,
                  })),
                )
              }
            >
              Export this page
            </button>
          </div>

          {selected.size > 0 && (
            <div className="bulkbar">
              <b>{selected.size} selected</b>
              <span style={{ fontSize: '12px', opacity: 0.75 }}>
                Kept as you search and change pages.
              </span>
              <span style={{ marginLeft: 'auto' }} />
              {canIndex && (
                <button className="btn btn-secondary btn-sm" onClick={indexSelected}>
                  Index selected
                </button>
              )}
              {canRoute && (
                <button
                  className="btn btn-primary btn-sm"
                  onClick={() =>
                    routeDocuments([...selected.values()], {
                      onSuccess: () => setSelected(new Map()),
                    })
                  }
                >
                  Route to workflow
                </button>
              )}
              <button className="btn btn-secondary btn-sm" onClick={() => setSelected(new Map())}>
                Clear selection
              </button>
            </div>
          )}

          {active.isError ? (
            <ErrorMessage message="Search failed." retry={active.refetch} />
          ) : active.isLoading && !results.length ? (
            <div className="card" role="status" aria-busy="true" aria-label="Searching">
              <SkeletonTaskRows rows={8} />
            </div>
          ) : !results.length ? (
            <div className="card">
              <div className="empty">
                <Icon name="search" size={32} />
                <div className="h3 mt-4 mb-2">No results</div>
                <p className="caption mb-4">
                  {q
                    ? `Nothing matched “${q}”. Try fewer words, or a different cabinet.`
                    : hasFilters
                      ? 'No documents match these filters.'
                      : 'No documents yet.'}
                </p>
              </div>
            </div>
          ) : (
            <div className="card">
              {canSelect && (
                <label
                  className="flex items-center gap-2"
                  style={{ padding: '10px 20px 0', cursor: 'pointer', fontSize: '12.5px' }}
                >
                  <input
                    type="checkbox"
                    checked={allOnPageSelected}
                    onChange={(e) => setPageSelected(e.target.checked)}
                  />
                  Select all on this page
                </label>
              )}
              <div className="rowlist">
                {results.map((d) => (
                  <div
                    className="task-row"
                    key={d.id}
                    onClick={() => router.push(`/doc/${d.id}`)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') router.push(`/doc/${d.id}`);
                    }}
                    role="button"
                    tabIndex={0}
                  >
                    {canSelect && (
                      <input
                        type="checkbox"
                        aria-label={`Select ${d.title}`}
                        checked={selected.has(d.id)}
                        onClick={(e) => e.stopPropagation()}
                        onKeyDown={(e) => e.stopPropagation()}
                        onChange={(e) => toggleSelected(d, e.target.checked)}
                        style={{ flexShrink: 0 }}
                      />
                    )}
                    <div className="task-main">
                      <div className="task-title">{d.title}</div>
                      <div className="caption" style={{ margin: '4px 0' }}>
                        {[
                          d.documentType,
                          workstreamLabel(d.workstream),
                          cabinetName.get(d.cabinetId),
                        ]
                          .filter(Boolean)
                          .join(' · ')}
                      </div>
                      <div className="task-meta">
                        <StatusBadge status={documentStatusLabel(d)} />
                        <ConfBadge level={d.confidentiality} />
                        <UrgBadge level={d.urgency} />
                        <span>· {new Date(d.createdAt).toLocaleDateString('en-GB')}</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
              {pagination && (
                <Pagination
                  page={pagination.page}
                  limit={pagination.limit}
                  total={pagination.total}
                  totalPages={
                    pagination.totalPages ?? Math.ceil(pagination.total / pagination.limit)
                  }
                  onPageChange={setPage}
                />
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
