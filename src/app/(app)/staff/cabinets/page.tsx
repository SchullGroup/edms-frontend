'use client';

import React, { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useQueryClient } from '@tanstack/react-query';
import { cabById, useStore } from '@/store/useStore';
import { useCabinets } from '@/apis/hooks/useCabinets';
import { useAllDocuments, useDocuments, useDocumentSearch } from '@/apis/hooks/useDocuments';
import {
  cabinetFoldersQuery,
  useCreateFolder,
  useDeleteFolder,
  useFolderAncestry,
  useFolderLevel,
  useUpdateFolder,
} from '@/apis/hooks/useFolders';
import { documentsService, DocumentFilters } from '@/apis/services/documents.service';
import { foldersService } from '@/apis/services/folders.service';
import { useRouteToWorkflow } from '@/hooks/useRouteToWorkflow';
import { foldersAsPaths } from '@/utils/folders';
import { useUIStore } from '@/store/useUIStore';
import { usePermissions } from '@/hooks/usePermissions';
import { documentStatusLabel } from '@/utils/helpers';
import { Icon } from '@/components/ui/Icons';
import { StatusBadge, ConfBadge, UrgBadge } from '@/components/ui/Badges';
import { Combobox } from '@/components/ui/Combobox';
import { Pagination } from '@/components/ui/Pagination';
import { RowActionsMenu, RowAction } from '@/components/ui/RowActionsMenu';
import { exportCsv } from '@/utils/exportCsv';
import { Skeleton, SkeletonTable } from '@/components/common/Skeleton';
import {
  CABINET_BYPASS_ROLE,
  cabinetAllows,
  useMyCabinetAccess,
} from '@/components/cabinets/cabinetAccess';
import { CabinetSchemaCard, useCanManageSchema } from '@/components/cabinets/CabinetSchemaCard';
import { CabinetAccessCard, useCanGrantAccess } from '@/components/cabinets/CabinetAccessCard';
import { FolderSecurityBadges } from '@/components/cabinets/FolderSecurityBadges';
import type { Folder } from '@/types/models';

/** Sentinel `activeFolder` for documents with no folder: `GET /documents` can't filter
 *  `folderId=null`, so the cabinet is walked once and filtered here. */
const UNFILED = '__unfiled__';

/** Documents per page (the API caps `limit` at 100). */
const DOC_PAGE_SIZE = 50;
const SEARCH_DEBOUNCE_MS = 300;

type Option = readonly [string, string];
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

interface ListFilters {
  status: string;
  confidentiality: string;
  urgency: string;
}
const NO_FILTERS: ListFilters = { status: '', confidentiality: '', urgency: '' };

const TABLE_COLUMNS = ['', 'Name', 'Status', 'Confidentiality', 'Urgency', 'Uploaded by', 'Created', ''];

/** high/critical only, per spec — low/normal get no flash. */
function urgencyRowClass(urgency: string): string {
  const tier = urgency?.toLowerCase();
  if (tier === 'critical') return 'urg-row-critical';
  if (tier === 'high') return 'urg-row-high';
  return '';
}

const formatDate = (iso?: string | null) => (iso ? new Date(iso).toLocaleDateString('en-GB') : '—');

export default function CabinetBrowserPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const queryClient = useQueryClient();
  const { setPageTitle, openModal, openConfirm, addToast } = useUIStore();
  const { currentUser } = useStore();
  const { can } = usePermissions();

  const [activeCab, setActiveCab] = useState<string | null>(searchParams?.get('cab') || null);
  const [activeFolder, setActiveFolder] = useState<string | null>(
    searchParams?.get('folder') || null,
  );
  const [selected, setSelected] = useState<any[]>([]);
  const [cabTab, setCabTab] = useState<'contents' | 'schema' | 'access'>('contents');
  const [query, setQuery] = useState('');
  const [debouncedQuery, setDebouncedQuery] = useState('');
  const [filters, setFilters] = useState<ListFilters>(NO_FILTERS);

  useEffect(() => {
    setPageTitle('Cabinet Browser');
  }, [setPageTitle]);

  useEffect(() => {
    const t = window.setTimeout(() => setDebouncedQuery(query.trim()), SEARCH_DEBOUNCE_MS);
    return () => window.clearTimeout(t);
  }, [query]);

  /** Every navigation goes through here: it also drops the selection and the search. */
  const open = (cabinetId: string | null, folderId: string | null) => {
    setActiveCab(cabinetId);
    setActiveFolder(folderId);
    setSelected([]);
    setQuery('');
    setDebouncedQuery('');
    setFilters(NO_FILTERS);
  };

  useEffect(() => {
    setCabTab('contents');
  }, [activeCab]);

  const { data: cabinetsData, isLoading: isLoadingCabinets } = useCabinets();
  const cabinets = cabinetsData?.data || [];
  const activeCabinet = activeCab ? cabById(cabinets, activeCab) : undefined;
  // Client admins list only their own department's cabinets; Cabinet Designer covers the rest.
  // A `?cab=` link to another cabinet still opens it (Designer's delete guard, doc breadcrumbs).
  const ownDepartmentOnly = !!currentUser?.roles?.includes(CABINET_BYPASS_ROLE);
  const listedCabinets = ownDepartmentOnly
    ? cabinets.filter((c: any) => !!c.departmentId && c.departmentId === currentUser?.departmentId)
    : cabinets;
  const linkedOutside =
    ownDepartmentOnly && !!activeCabinet && !listedCabinets.includes(activeCabinet);
  const switcherCabinets = linkedOutside ? [...listedCabinets, activeCabinet] : listedCabinets;

  const showingUnfiled = activeFolder === UNFILED;
  const inFolder = !!activeFolder && !showingUnfiled;
  const searching =
    !!debouncedQuery || !!filters.status || !!filters.confidentiality || !!filters.urgency;

  // --- Where we are: the open folder and its ancestors ---
  const { data: ancestry = [], isLoading: isLoadingAncestry } = useFolderAncestry(
    activeCab ?? undefined,
    inFolder ? activeFolder! : undefined,
  );
  const openFolder = inFolder ? ancestry.find((f) => f.id === activeFolder) : undefined;

  // --- This level's folders, a batch at a time ---
  const level = useFolderLevel(activeCab ?? undefined, inFolder ? activeFolder : null, {
    enabled: !!activeCab && !showingUnfiled && !searching,
  });
  const levelFolders = useMemo(
    () => level.data?.pages.flatMap((p) => p.folders) ?? [],
    [level.data],
  );
  // Badges work over a folder's whole path, so the ancestors go in with this level.
  const pathFolders = useMemo(() => [...ancestry, ...levelFolders], [ancestry, levelFolders]);

  // --- Documents: the open folder's, or the whole cabinet's while searching at the top ---
  // The page belongs to the list it was chosen in; a new folder, search or filter starts at 1.
  const listKey = `${activeCab}|${activeFolder}|${debouncedQuery}|${filters.status}|${filters.confidentiality}|${filters.urgency}`;
  const [docPage, setDocPage] = useState({ key: listKey, page: 1 });
  const page = docPage.key === listKey ? docPage.page : 1;
  const goToDocPage = (next: number) => {
    setDocPage({ key: listKey, page: next });
    setSelected([]);
  };

  const docFilters: DocumentFilters = {
    cabinetId: activeCab || undefined,
    folderId: inFolder ? activeFolder! : undefined,
    status: (filters.status || undefined) as DocumentFilters['status'],
    confidentiality: (filters.confidentiality || undefined) as DocumentFilters['confidentiality'],
    urgency: (filters.urgency || undefined) as DocumentFilters['urgency'],
    page,
    limit: DOC_PAGE_SIZE,
  };
  const listsDocuments = !!activeCab && !showingUnfiled && (inFolder || searching);
  const browse = useDocuments(docFilters, { enabled: listsDocuments && !debouncedQuery });
  const search = useDocumentSearch(listsDocuments ? debouncedQuery : '', docFilters);
  const docResult = debouncedQuery ? search : browse;
  const docPagination = listsDocuments ? docResult.data?.pagination : undefined;
  const lastDocPage = Math.max(1, docPagination?.totalPages ?? 1);

  // Moving documents out can empty the last page; step back to the new last one.
  useEffect(() => {
    if (docPagination && page > lastDocPage) setDocPage({ key: listKey, page: lastDocPage });
  }, [docPagination, page, lastDocPage, listKey]);

  // Documents with no folder: walked once per cabinet, for the top-level row and its view.
  const { data: cabinetAllDocs, isLoading: isLoadingUnfiled } = useAllDocuments(
    { cabinetId: activeCab || undefined },
    { enabled: !!activeCab && !inFolder },
  );
  const unfiledDocs = useMemo(
    () => (cabinetAllDocs || []).filter((d: any) => !d.folderId),
    [cabinetAllDocs],
  );
  const unfiledShown = useMemo(() => {
    const q = debouncedQuery.toLowerCase();
    return unfiledDocs.filter(
      (d: any) =>
        (!q || d.title?.toLowerCase().includes(q)) &&
        (!filters.status || d.status === filters.status) &&
        (!filters.confidentiality || d.confidentiality === filters.confidentiality) &&
        (!filters.urgency || d.urgency === filters.urgency),
    );
  }, [unfiledDocs, debouncedQuery, filters]);

  const docs: any[] = showingUnfiled ? unfiledShown : listsDocuments ? docResult.data?.data || [] : [];
  const showFolderRows = !!activeCab && !showingUnfiled && !searching;
  const showUnfiledRow = showFolderRows && !inFolder && unfiledDocs.length > 0;
  const isLoadingList =
    (showFolderRows && level.isLoading) ||
    (listsDocuments && docResult.isLoading) ||
    (showingUnfiled && isLoadingUnfiled) ||
    (showFolderRows && !inFolder && isLoadingUnfiled);

  const { routeDocuments, canRoute } = useRouteToWorkflow();
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Every action below needs a role permission AND a level on this cabinet —
  // the two checks the API makes — so each shows only when both pass.
  const myLevel = useMyCabinetAccess(activeCab);
  const canCreateFolder = can('folder', 'create') && cabinetAllows(myLevel, 'upload');
  const canRenameFolder = can('folder', 'edit') && cabinetAllows(myLevel, 'edit');
  // Same gate as the access routes; the folder's own grants can still refuse (page explains).
  const canManageFolderAccess = canRenameFolder;
  const canDeleteFolder = can('folder', 'delete') && cabinetAllows(myLevel, 'delete');
  const canMoveDocuments = can('document', 'edit') && cabinetAllows(myLevel, 'edit');
  const canManageSchema = useCanManageSchema(activeCabinet);
  const canGrantAccess = useCanGrantAccess(activeCabinet);

  const createFolder = useCreateFolder();
  const updateFolder = useUpdateFolder();
  const deleteFolder = useDeleteFolder();

  const handleNewFolder = (parent?: { id: string; name: string }) => {
    if (!activeCabinet) return;
    let name = '';
    openModal({
      title: 'New folder in ' + (parent?.name ?? activeCabinet.name),
      body: (
        <div className="field">
          <label htmlFor="new-folder-name">Name</label>
          <input
            id="new-folder-name"
            className="input"
            placeholder="Folder name"
            maxLength={200}
            onChange={(e) => (name = e.target.value)}
          />
        </div>
      ),
      actions: [
        { label: 'Cancel' },
        {
          label: 'Add folder',
          kind: 'btn-primary',
          onClick: () => {
            if (!name.trim()) return false;
            return createFolder
              .mutateAsync({
                cabinetId: activeCabinet.id,
                data: { name: name.trim(), ...(parent ? { parentId: parent.id } : {}) },
              })
              .then(() => {})
              .catch(() => false);
          },
        },
      ],
    });
  };

  const handleRenameFolder = (f: Folder) => {
    let name = f.name;
    openModal({
      title: `Rename folder "${f.name}"`,
      body: (
        <div className="field">
          <label htmlFor="rename-folder-name">Folder name</label>
          <input
            id="rename-folder-name"
            className="input"
            defaultValue={f.name}
            maxLength={200}
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
            if (!name.trim() || name.trim() === f.name) return;
            return updateFolder
              .mutateAsync({ id: f.id, updates: { name: name.trim() } })
              .then(() => {})
              .catch(() => false);
          },
        },
      ],
    });
  };

  // Checks first: the API 409s on documents but would orphan sub-folders, hidden ones included.
  const handleDeleteFolder = async (f: Folder) => {
    try {
      const [kids, inside] = await Promise.all([
        foldersService.listPage(f.cabinetId, { parentId: f.id, limit: 1 }),
        documentsService.getAll({ cabinetId: f.cabinetId, folderId: f.id, limit: 1 }),
      ]);
      if ((inside.pagination?.total ?? 0) > 0) {
        addToast('Folder contains documents — move them first', 'error');
        return;
      }
      if (kids.folders.length > 0 || kids.nextCursor) {
        addToast('Folder has sub-folders — delete or move them first', 'error');
        return;
      }
    } catch {
      addToast("Couldn't check whether the folder is empty. Try again.", 'error');
      return;
    }
    openConfirm({
      title: `Delete folder "${f.name}"?`,
      message: 'The folder is empty and will be removed from the cabinet structure.',
      confirmLabel: 'Delete folder',
      danger: true,
      onConfirm: () =>
        deleteFolder
          .mutateAsync({ id: f.id, cabinetId: f.cabinetId })
          .then(() => {
            if (activeFolder === f.id) open(activeCab, f.parentId ?? null);
          })
          .catch(() => false),
    });
  };

  const folderActions = (f: Folder, opts: { includeOpen: boolean }): RowAction[] => [
    ...(opts.includeOpen
      ? [{ key: 'open', label: 'Open', onSelect: () => open(activeCab, f.id) }]
      : []),
    ...(canRenameFolder
      ? [{ key: 'rename', label: 'Rename', onSelect: () => handleRenameFolder(f) }]
      : []),
    ...(canManageFolderAccess
      ? [
          {
            key: 'access',
            label: 'Permissions',
            onSelect: () => router.push(`/staff/cabinets/${f.cabinetId}/folders/${f.id}/access`),
          },
        ]
      : []),
    ...(canDeleteFolder
      ? [
          {
            key: 'delete',
            label: 'Delete',
            danger: true,
            separatorBefore: true,
            onSelect: () => void handleDeleteFolder(f),
          },
        ]
      : []),
  ];

  /**
   * Moves the selected documents to another folder in the same cabinet. The API
   * can't move a document between cabinets (`PATCH /documents/{id}` ignores
   * `cabinetId`), so the picker offers only this cabinet's other folders.
   */
  const handleMoveModal = async () => {
    if (!activeCab) return;
    const moving = selected;
    let all: Folder[];
    try {
      all = await queryClient.fetchQuery(cabinetFoldersQuery(activeCab));
    } catch {
      addToast("Couldn't load this cabinet's folders. Try again.", 'error');
      return;
    }
    const destinations = foldersAsPaths(all)
      .filter((f) => f.id !== activeFolder)
      .map((f) => ({ id: f.id, name: f.path }));
    let destFolderId = '';
    openModal({
      title: moving.length > 1 ? `Move ${moving.length} documents` : `Move “${moving[0].title}”`,
      body: (
        <MoveDocumentsModalBody
          folders={destinations}
          onChange={(folderId) => (destFolderId = folderId)}
        />
      ),
      actions: [
        { label: 'Cancel' },
        {
          label: moving.length > 1 ? `Move ${moving.length}` : 'Move',
          kind: 'btn-primary',
          onClick: () => {
            if (!destFolderId) {
              addToast('Choose a destination folder', 'error');
              return false;
            }
            setIsSubmitting(true);
            return Promise.all(
              moving.map((d) => documentsService.update(d.id, { folderId: destFolderId })),
            )
              .then(() => {
                addToast(
                  moving.length > 1 ? `${moving.length} documents moved` : 'Document moved',
                  'success',
                );
                setSelected([]);
              })
              .catch((err: any) => {
                addToast(err.response?.data?.message || 'Failed to move documents', 'error');
                return false;
              })
              .finally(() => {
                // Promise.all rejects on the first failure while others may still have
                // landed, so refetch either way (cabinet queries carry document counts).
                queryClient.invalidateQueries({ queryKey: ['documents'] });
                queryClient.invalidateQueries({ queryKey: ['cabinets'] });
                setIsSubmitting(false);
              });
          },
        },
      ],
    });
  };

  const handleRouteModal = () =>
    routeDocuments(
      selected.map((d) => ({ id: d.id, title: d.title, status: d.status, createdBy: d.createdBy })),
      { onSuccess: () => setSelected([]) },
    );

  const isSelected = (d: any) => selected.some((s) => s.id === d.id);
  const toggleDoc = (d: any, checked: boolean) =>
    setSelected((cur) => (checked ? [...cur, d] : cur.filter((s) => s.id !== d.id)));
  const allDocsSelected = docs.length > 0 && docs.every(isSelected);

  const uploadHref = `/upload?cab=${activeCab ?? ''}${inFolder ? `&folder=${activeFolder}` : ''}`;
  const scopeLabel = inFolder
    ? (openFolder?.name ?? 'this folder')
    : showingUnfiled
      ? 'unfiled documents'
      : (activeCabinet?.name ?? 'this cabinet');

  if (isLoadingCabinets) return <CabinetBrowserSkeleton />;

  return (
    <div>
      <div className="page-head">
        <div>
          <div className="page-title">Cabinet Browser</div>
          <div className="page-sub">
            Folders and documents in one list; select documents for bulk actions.
          </div>
        </div>
      </div>

      {/* Location: cabinet switcher and folder path, with this level's actions */}
      <div className="flex flex-wrap justify-between items-center gap-3 mb-4">
        <div className="flex flex-wrap items-center gap-2.5 min-w-0">
          <button
            type="button"
            className="btn btn-ghost btn-sm"
            onClick={() => open(null, null)}
            aria-current={!activeCab ? 'page' : undefined}
          >
            <Icon name="grid" size={14} /> {ownDepartmentOnly ? 'My cabinets' : 'All cabinets'}
          </button>
          {switcherCabinets.length > 0 && (
            <div style={{ minWidth: 240 }}>
              <Combobox
                options={switcherCabinets.map((c: any) => ({
                  value: c.id,
                  label: c.name,
                  hint: c.department?.name ?? undefined,
                }))}
                value={activeCab ?? ''}
                onChange={(v) => open((v as string) || null, null)}
                placeholder="Choose a cabinet…"
                searchPlaceholder="Find a cabinet…"
                ariaLabel="Cabinet"
              />
            </div>
          )}
          {activeCab && (
            <nav className="crumbs" aria-label="Folder path" style={{ marginBottom: 0, fontSize: 13 }}>
              {(inFolder || showingUnfiled) && (
                <a onClick={() => open(activeCab, null)} role="link" tabIndex={0}>
                  Top level
                </a>
              )}
              {showingUnfiled && (
                <>
                  <span className="sep">/</span>
                  <span className="cur">Unfiled documents</span>
                </>
              )}
              {inFolder && isLoadingAncestry && (
                <>
                  <span className="sep">/</span>
                  <Skeleton height={12} width={120} />
                </>
              )}
              {inFolder &&
                ancestry.map((f) => (
                  <React.Fragment key={f.id}>
                    <span className="sep">/</span>
                    {f.id === activeFolder ? (
                      <span className="cur inline-flex items-center gap-2">
                        {f.name}
                        <FolderSecurityBadges folders={ancestry} id={f.id} />
                      </span>
                    ) : (
                      <a onClick={() => open(activeCab, f.id)} role="link" tabIndex={0}>
                        {f.name}
                      </a>
                    )}
                  </React.Fragment>
                ))}
            </nav>
          )}
        </div>

        {activeCab && cabTab === 'contents' && (
          <div className="flex flex-wrap items-center gap-2">
            {canCreateFolder && !showingUnfiled && (
              <button
                type="button"
                className="btn btn-secondary btn-sm"
                onClick={() => handleNewFolder(openFolder)}
                disabled={inFolder && !openFolder}
              >
                + New folder
              </button>
            )}
            {openFolder && canManageFolderAccess && (
              <Link
                className="btn btn-secondary btn-sm"
                href={`/staff/cabinets/${activeCab}/folders/${openFolder.id}/access`}
              >
                Permissions
              </Link>
            )}
            {openFolder && (
              <RowActionsMenu
                actions={folderActions(openFolder, { includeOpen: false }).filter(
                  (a) => a.key !== 'access',
                )}
                label={`More actions for ${openFolder.name}`}
              />
            )}
            {!showingUnfiled && (
              <button type="button" className="btn btn-accent btn-sm" onClick={() => router.push(uploadHref)}>
                <Icon name="upload" size={14} /> Upload here
              </button>
            )}
          </div>
        )}
      </div>

      {linkedOutside && (
        <div className="banner info">
          <span>
            {activeCabinet?.name} belongs to{' '}
            {activeCabinet?.department?.name ?? 'another department'}. You opened it from a
            link: this page lists only your department&rsquo;s cabinets. The rest are managed in{' '}
            <Link href="/admin/cabinets">Cabinet Designer</Link>.
          </span>
        </div>
      )}

      {!activeCab ? (
        <CabinetGrid
          cabinets={listedCabinets}
          ownDepartmentOnly={ownDepartmentOnly}
          onOpen={(id) => open(id, null)}
        />
      ) : (
        <>
          {(canManageSchema || canGrantAccess) && (
            <div className="tabs" role="tablist" aria-label="Cabinet sections">
              <button
                type="button"
                role="tab"
                aria-selected={cabTab === 'contents'}
                className={`tab ${cabTab === 'contents' ? 'active' : ''}`}
                onClick={() => setCabTab('contents')}
              >
                Contents
              </button>
              {canManageSchema && (
                <button
                  type="button"
                  role="tab"
                  aria-selected={cabTab === 'schema'}
                  className={`tab ${cabTab === 'schema' ? 'active' : ''}`}
                  onClick={() => setCabTab('schema')}
                >
                  Metadata schema
                </button>
              )}
              {canGrantAccess && (
                <button
                  type="button"
                  role="tab"
                  aria-selected={cabTab === 'access'}
                  className={`tab ${cabTab === 'access' ? 'active' : ''}`}
                  onClick={() => setCabTab('access')}
                >
                  Access
                </button>
              )}
            </div>
          )}

          {cabTab === 'schema' && canManageSchema && activeCabinet ? (
            <CabinetSchemaCard cabinet={activeCabinet} />
          ) : cabTab === 'access' && canGrantAccess && activeCabinet ? (
            <CabinetAccessCard cabinet={activeCabinet} />
          ) : (
            <>
              {/* Search and filters: this folder, or the whole cabinet at the top level */}
              <div className="flex flex-wrap items-center gap-2 mb-3">
                <label
                  className="input flex items-center gap-2"
                  style={{ flex: '1 1 240px', maxWidth: 380, cursor: 'text' }}
                >
                  <Icon name="search" size={14} />
                  <span className="sr-only">Search {scopeLabel}</span>
                  <input
                    type="search"
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    placeholder={inFolder ? 'Search this folder' : showingUnfiled ? 'Search unfiled documents' : 'Search this cabinet'}
                    style={{ flex: 1, minWidth: 0, border: 0, outline: 0, background: 'transparent', font: 'inherit', color: 'inherit' }}
                  />
                </label>
                <FilterSelect
                  label="Status"
                  options={STATUS_OPTIONS}
                  value={filters.status}
                  onChange={(status) => setFilters((f) => ({ ...f, status }))}
                />
                <FilterSelect
                  label="Confidentiality"
                  options={CONFIDENTIALITY_OPTIONS}
                  value={filters.confidentiality}
                  onChange={(confidentiality) => setFilters((f) => ({ ...f, confidentiality }))}
                />
                <FilterSelect
                  label="Urgency"
                  options={URGENCY_OPTIONS}
                  value={filters.urgency}
                  onChange={(urgency) => setFilters((f) => ({ ...f, urgency }))}
                />
                {(query || searching) && (
                  <button
                    type="button"
                    className="btn btn-ghost btn-sm"
                    onClick={() => {
                      setQuery('');
                      setDebouncedQuery('');
                      setFilters(NO_FILTERS);
                    }}
                  >
                    Clear
                  </button>
                )}
                <div className="urg-legend" style={{ marginLeft: 'auto' }}>
                  <span>
                    <span className="urg-dot critical" /> Critical
                  </span>
                  <span>
                    <span className="urg-dot high" /> High
                  </span>
                </div>
              </div>

              {selected.length > 0 && (
                <div className="bulkbar">
                  <b>{selected.length} selected</b>
                  {canMoveDocuments && (
                    <button
                      type="button"
                      className="btn btn-secondary btn-sm"
                      onClick={() => void handleMoveModal()}
                      disabled={isSubmitting}
                    >
                      Move
                    </button>
                  )}
                  {canRoute && (
                    <button
                      type="button"
                      className="btn btn-secondary btn-sm"
                      onClick={handleRouteModal}
                      disabled={isSubmitting}
                    >
                      Route
                    </button>
                  )}
                  <button
                    type="button"
                    className="btn btn-secondary btn-sm"
                    onClick={() => exportCsv('Cabinet_Selected_Documents', selected)}
                    disabled={isSubmitting}
                  >
                    Export
                  </button>
                  <button
                    type="button"
                    className="btn btn-secondary btn-sm"
                    style={{ marginLeft: 'auto' }}
                    onClick={() => setSelected([])}
                  >
                    Clear
                  </button>
                </div>
              )}

              <div className="card">
                {isLoadingList ? (
                  <SkeletonTable columns={TABLE_COLUMNS} />
                ) : (
                  <ContentsTable
                    folderRows={showFolderRows ? levelFolders : []}
                    pathFolders={pathFolders}
                    hasMoreFolders={showFolderRows && !!level.hasNextPage}
                    loadingMoreFolders={level.isFetchingNextPage}
                    onMoreFolders={() => void level.fetchNextPage()}
                    unfiledCount={showUnfiledRow ? unfiledDocs.length : 0}
                    docs={docs}
                    isSelected={isSelected}
                    allSelected={allDocsSelected}
                    onToggleAll={(checked) => setSelected(checked ? docs : [])}
                    onToggle={toggleDoc}
                    onOpenFolder={(id) => open(activeCab, id)}
                    onOpenUnfiled={() => open(activeCab, UNFILED)}
                    onOpenDoc={(id) => router.push(`/doc/${id}`)}
                    folderActions={(f) => folderActions(f, { includeOpen: true })}
                    empty={
                      searching ? (
                        <EmptyBlock
                          icon="search"
                          title="No documents match"
                          message={`Nothing in ${scopeLabel} matches the search and filters.`}
                        />
                      ) : showingUnfiled ? (
                        <EmptyBlock icon="doc" title="No unfiled documents" />
                      ) : inFolder ? (
                        <EmptyBlock
                          icon="folder"
                          title="This folder is empty"
                          message="Upload a document or add a sub-folder."
                        />
                      ) : (
                        <EmptyBlock
                          icon="folder"
                          title="No folders in this cabinet yet"
                          message={
                            canCreateFolder
                              ? 'Add a folder to start filing documents here.'
                              : 'Folders are set up by whoever manages this cabinet.'
                          }
                        />
                      )
                    }
                  />
                )}
                {docPagination && !isLoadingList && (
                  <Pagination
                    page={docPagination.page}
                    limit={docPagination.limit}
                    total={docPagination.total}
                    totalPages={lastDocPage}
                    onPageChange={goToDocPage}
                  />
                )}
              </div>
            </>
          )}
        </>
      )}
    </div>
  );
}

/** One table for a level: its sub-folders first, then the Unfiled row, then documents. */
function ContentsTable({
  folderRows,
  pathFolders,
  hasMoreFolders,
  loadingMoreFolders,
  onMoreFolders,
  unfiledCount,
  docs,
  isSelected,
  allSelected,
  onToggleAll,
  onToggle,
  onOpenFolder,
  onOpenUnfiled,
  onOpenDoc,
  folderActions,
  empty,
}: {
  folderRows: Folder[];
  pathFolders: Folder[];
  hasMoreFolders: boolean;
  loadingMoreFolders: boolean;
  onMoreFolders: () => void;
  unfiledCount: number;
  docs: any[];
  isSelected: (d: any) => boolean;
  allSelected: boolean;
  onToggleAll: (checked: boolean) => void;
  onToggle: (d: any, checked: boolean) => void;
  onOpenFolder: (id: string) => void;
  onOpenUnfiled: () => void;
  onOpenDoc: (id: string) => void;
  folderActions: (f: Folder) => RowAction[];
  empty: React.ReactNode;
}) {
  if (!folderRows.length && !unfiledCount && !docs.length) return <>{empty}</>;

  const nameButton: React.CSSProperties = {
    display: 'inline-flex',
    alignItems: 'center',
    gap: 8,
    border: 0,
    padding: 0,
    background: 'transparent',
    font: 'inherit',
    fontWeight: 600,
    color: 'var(--ink)',
    cursor: 'pointer',
    textAlign: 'left',
  };

  return (
    <div className="tbl-wrap">
      <table className="tbl">
        <thead>
          <tr>
            <th style={{ width: 34 }}>
              {docs.length > 0 && (
                <input
                  type="checkbox"
                  aria-label="Select all documents on this page"
                  checked={allSelected}
                  onChange={(e) => onToggleAll(e.target.checked)}
                />
              )}
            </th>
            <th>Name</th>
            <th>Status</th>
            <th>Confidentiality</th>
            <th>Urgency</th>
            <th>Uploaded by</th>
            <th>Created</th>
            <th style={{ width: 44 }}>
              <span className="sr-only">Actions</span>
            </th>
          </tr>
        </thead>
        <tbody>
          {folderRows.map((f) => (
            <tr key={f.id} className="clickable" onClick={(e) => {
              if (!(e.target as HTMLElement).closest('button, a[href]')) onOpenFolder(f.id);
            }}>
              <td />
              <td>
                <button type="button" style={nameButton} onClick={() => onOpenFolder(f.id)}>
                  <span style={{ color: 'var(--focus)', display: 'inline-flex' }}>
                    <Icon name="folder" size={15} />
                  </span>
                  {f.name}
                </button>
              </td>
              <td className="caption">Folder</td>
              <td>
                <FolderSecurityBadges folders={pathFolders} id={f.id} />
              </td>
              <td className="caption">—</td>
              <td className="caption">—</td>
              <td>{formatDate(f.createdAt)}</td>
              <td>
                <RowActionsMenu actions={folderActions(f)} label={`Actions for ${f.name}`} />
              </td>
            </tr>
          ))}
          {hasMoreFolders && (
            <tr>
              <td />
              <td colSpan={7}>
                <button
                  type="button"
                  className="btn btn-ghost btn-sm"
                  onClick={onMoreFolders}
                  disabled={loadingMoreFolders}
                  style={{ paddingLeft: 0, color: 'var(--focus)' }}
                >
                  {loadingMoreFolders ? 'Loading folders…' : 'Show more folders'}
                </button>
              </td>
            </tr>
          )}
          {unfiledCount > 0 && (
            <tr className="clickable" onClick={(e) => {
              if (!(e.target as HTMLElement).closest('button')) onOpenUnfiled();
            }}>
              <td />
              <td>
                <button type="button" style={nameButton} onClick={onOpenUnfiled}>
                  <span style={{ color: 'var(--muted)', display: 'inline-flex' }}>
                    <Icon name="doc" size={15} />
                  </span>
                  Unfiled documents
                </button>
              </td>
              <td className="caption" colSpan={6}>
                {unfiledCount} document{unfiledCount === 1 ? '' : 's'} in no folder
              </td>
            </tr>
          )}
          {docs.map((d) => (
            <tr
              key={d.id}
              className={`clickable ${isSelected(d) ? 'selected' : ''} ${urgencyRowClass(d.urgency)}`}
              onClick={(e) => {
                const t = e.target as HTMLElement;
                if (t.tagName !== 'INPUT' && !t.closest('button, a[href]')) onOpenDoc(d.id);
              }}
            >
              <td>
                <input
                  type="checkbox"
                  aria-label={`Select ${d.title}`}
                  checked={isSelected(d)}
                  onChange={(e) => onToggle(d, e.target.checked)}
                />
              </td>
              <td>
                <Link href={`/doc/${d.id}`} style={{ ...nameButton, textDecoration: 'none' }}>
                  <span style={{ color: 'var(--muted)', display: 'inline-flex' }}>
                    <Icon name="doc" size={15} />
                  </span>
                  {d.title}
                </Link>
              </td>
              <td>
                <StatusBadge status={documentStatusLabel(d)} />
              </td>
              <td>
                <ConfBadge level={d.confidentiality} />
              </td>
              <td>
                <UrgBadge level={d.urgency} />
              </td>
              <td>{d.creator?.name || 'Unknown user'}</td>
              <td>{formatDate(d.createdAt)}</td>
              <td />
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/** A pick-one filter: the API takes a single value per field. */
function FilterSelect({
  label,
  options,
  value,
  onChange,
}: {
  label: string;
  options: Option[];
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <select
      className="input"
      aria-label={label}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      style={{ width: 'auto', height: 34, borderRadius: 999, fontWeight: 600 }}
    >
      <option value="">{label}: any</option>
      {options.map(([v, l]) => (
        <option key={v} value={v}>
          {label}: {l}
        </option>
      ))}
    </select>
  );
}

function EmptyBlock({ icon, title, message }: { icon: string; title: string; message?: string }) {
  return (
    <div className="empty">
      <Icon name={icon as any} size={32} />
      <div className="h3 mt-4 mb-2">{title}</div>
      {message && <p className="caption mb-4">{message}</p>}
    </div>
  );
}

function CabinetGrid({
  cabinets,
  ownDepartmentOnly,
  onOpen,
}: {
  cabinets: any[];
  ownDepartmentOnly: boolean;
  onOpen: (id: string) => void;
}) {
  if (cabinets.length === 0) {
    return (
      <div className="card">
        {ownDepartmentOnly ? (
          <div className="empty">
            <Icon name="cabinet" size={32} />
            <div className="h3 mt-4 mb-2">No cabinets in your department yet</div>
            <p className="caption mb-4">
              This page lists only your own department&rsquo;s cabinets. Create one, or manage
              every other cabinet, in Cabinet Designer.
            </p>
            <Link href="/admin/cabinets" className="btn btn-secondary btn-sm">
              Open Cabinet Designer
            </Link>
          </div>
        ) : (
          <div className="empty">
            <Icon name="cabinet" size={32} />
            <div className="h3 mt-4 mb-2">No cabinets yet</div>
            <p className="caption mb-4">An administrator sets these up.</p>
          </div>
        )}
      </div>
    );
  }
  return (
    <div className="card">
      <div className="doc-grid">
        {cabinets.map((c: any) => (
          <button
            key={c.id}
            type="button"
            className="doc-card"
            style={{ textAlign: 'left', font: 'inherit', color: 'inherit' }}
            onClick={() => onOpen(c.id)}
          >
            <div className="doc-thumb">
              <Icon name="cabinet" size={28} />
            </div>
            <div style={{ fontWeight: 700, fontSize: '12.5px', lineHeight: 1.4 }}>{c.name}</div>
            {c.department?.name && (
              <div className="caption" style={{ marginTop: '4px' }}>
                {c.department.name}
              </div>
            )}
          </button>
        ))}
      </div>
    </div>
  );
}

/** Destination picker for moving documents within one cabinet. Reports the
 *  chosen folder through `onChange` (the modal's action reads it on submit). */
function MoveDocumentsModalBody({
  folders,
  onChange,
}: {
  folders: { id: string; name: string }[];
  onChange: (folderId: string) => void;
}) {
  const [folderId, setFolderId] = useState('');

  if (folders.length === 0) {
    return (
      <p className="caption" style={{ lineHeight: 1.6 }}>
        There are no other folders in this cabinet to move these documents into.
      </p>
    );
  }
  return (
    <div className="field">
      <label htmlFor="move-destination">Destination folder</label>
      <select
        id="move-destination"
        className="input"
        value={folderId}
        onChange={(e) => {
          setFolderId(e.target.value);
          onChange(e.target.value);
        }}
      >
        <option value="" disabled>
          Choose a folder…
        </option>
        {folders.map((f) => (
          <option key={f.id} value={f.id}>
            {f.name}
          </option>
        ))}
      </select>
      <div className="help">Documents can only be moved between folders in the same cabinet.</div>
    </div>
  );
}

/** Shown while the cabinets load: the location bar and the contents table. */
function CabinetBrowserSkeleton() {
  return (
    <div>
      <div className="page-head">
        <div>
          <div className="page-title">Cabinet Browser</div>
          <div className="page-sub">
            Folders and documents in one list; select documents for bulk actions.
          </div>
        </div>
      </div>
      <div className="flex items-center gap-3 mb-4">
        <Skeleton height={34} width={120} radius={10} />
        <Skeleton height={34} width={240} radius={10} />
      </div>
      <div className="card">
        <SkeletonTable columns={TABLE_COLUMNS} />
      </div>
    </div>
  );
}
