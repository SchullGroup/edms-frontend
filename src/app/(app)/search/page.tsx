'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useStore } from '@/store/useStore';
import { useUIStore } from '@/store/useUIStore';
import { documentStatusLabel } from '@/utils/helpers';
import { useDocuments, useDocumentSearch } from '@/apis/hooks/useDocuments';
import { useCabinets } from '@/apis/hooks/useCabinets';
import { useDebouncedCallback } from '@/hooks/useDebouncedCallback';
import { DOCUMENT_TYPES } from '@/constants/documentTypes';
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

/** Reads a filter from the URL, accepting the enum (`in_progress`) or its label
 *  (`In Progress`). Unknown values — e.g. the old `status=Overdue`, which isn't a
 *  document status — are ignored rather than filtering everything out. */
function fromParam(raw: string | null, options: Option[]): string | undefined {
  if (!raw) return undefined;
  const norm = raw.trim().toLowerCase().replace(/[\s-]+/g, '_');
  return options.find(([v, l]) => v === norm || l.toLowerCase() === raw.trim().toLowerCase())?.[0];
}

function FilterGroup({
  title,
  options,
  value,
  onChange,
  disabled,
}: {
  title: string;
  options: Option[];
  value: string | undefined;
  onChange: (value: string | undefined) => void;
  disabled?: boolean;
}) {
  return (
    <div className="facet-group" role="radiogroup" aria-label={title}>
      <div className="flex justify-between items-center">
        <span className="fg-title">{title}</span>
        {value && !disabled && (
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
        <label
          className="facet-opt"
          key={v}
          style={disabled ? { opacity: 0.5, cursor: 'not-allowed' } : undefined}
        >
          <input
            type="radio"
            name={`filter-${title}`}
            checked={value === v}
            disabled={disabled}
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

  const { data: cabinetsData } = useCabinets();
  const cabinets = useMemo(() => cabinetsData?.data ?? [], [cabinetsData]);
  const cabinetName = useMemo(
    () => new Map(cabinets.map((c: any) => [c.id, c.name as string])),
    [cabinets],
  );

  // `input` is what's typed; `q` is the debounced value actually searched.
  const urlQ = searchParams?.get('q') ?? '';
  const [input, setInput] = useState(urlQ);
  const [q, setQ] = useState(urlQ.trim());
  const [page, setPage] = useState(1);
  const [filters, setFilters] = useState<Filters>(() => ({
    cabinetId: searchParams?.get('cabinet') || undefined,
    documentType: fromParam(searchParams?.get('type') ?? null, TYPE_OPTIONS),
    status: fromParam(searchParams?.get('status') ?? null, STATUS_OPTIONS) as Filters['status'],
    confidentiality: fromParam(
      searchParams?.get('confidentiality') ?? searchParams?.get('conf') ?? null,
      CONFIDENTIALITY_OPTIONS,
    ) as Filters['confidentiality'],
    urgency: fromParam(searchParams?.get('urgency') ?? null, URGENCY_OPTIONS) as Filters['urgency'],
  }));

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

  // Text search (`GET /documents/search`) only accepts a cabinet filter; the
  // others need the list endpoint. So while there's text, only Cabinet applies.
  const textMode = q.length > 0;
  const listQuery = useDocuments(
    { ...filters, page, limit: PAGE_SIZE },
    { enabled: !textMode },
  );
  const searchQuery = useDocumentSearch(q, {
    cabinetId: filters.cabinetId,
    page,
    limit: PAGE_SIZE,
  });
  const active = textMode ? searchQuery : listQuery;
  const results: Document[] = active.data?.data ?? [];
  const pagination = active.data?.pagination;
  const total = pagination?.total ?? results.length;

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
    // A saved cabinet may have been deleted since, or be one this user can't see.
    if (next.cabinetId && cabinets.length && !cabinetName.has(next.cabinetId)) {
      next = { ...next, cabinetId: undefined };
      addToast('The cabinet in this saved search is no longer available', 'info');
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
                disabled={!me || (!q && !hasFilters)}
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

          {textMode && (
            <div className="facet-group caption">
              While searching text, only the Cabinet filter applies. Clear the search box to
              use the others.
            </div>
          )}

          <FilterGroup
            title="Cabinet"
            options={cabinets.map((c: any) => [c.id, c.name] as const)}
            value={filters.cabinetId}
            onChange={(v) => setFilter('cabinetId', v)}
          />
          <FilterGroup
            title="Type"
            options={TYPE_OPTIONS}
            value={filters.documentType}
            onChange={(v) => setFilter('documentType', v)}
            disabled={textMode}
          />
          <FilterGroup
            title="Status"
            options={STATUS_OPTIONS}
            value={filters.status}
            onChange={(v) => setFilter('status', v as Filters['status'])}
            disabled={textMode}
          />
          <FilterGroup
            title="Confidentiality"
            options={CONFIDENTIALITY_OPTIONS}
            value={filters.confidentiality}
            onChange={(v) => setFilter('confidentiality', v as Filters['confidentiality'])}
            disabled={textMode}
          />
          <FilterGroup
            title="Urgency"
            options={URGENCY_OPTIONS}
            value={filters.urgency}
            onChange={(v) => setFilter('urgency', v as Filters['urgency'])}
            disabled={textMode}
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
                    <div className="task-main">
                      <div className="task-title">{d.title}</div>
                      <div className="caption" style={{ margin: '4px 0' }}>
                        {[d.documentType, cabinetName.get(d.cabinetId)].filter(Boolean).join(' · ')}
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
