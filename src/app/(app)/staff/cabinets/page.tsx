'use client';

import React, { useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { cabById, userById, useStore } from '@/store/useStore';
import { useCabinets } from '@/apis/hooks/useCabinets';
import { useDocuments, useAllDocuments } from '@/apis/hooks/useDocuments';
import { useRouteToWorkflow } from '@/hooks/useRouteToWorkflow';
import { useUsers } from '@/apis/hooks/useUsers';
import { documentsService } from '@/apis/services/documents.service';
import { useQueryClient } from '@tanstack/react-query';
import {
  useCabinetFolders,
  useCreateFolder,
  useUpdateFolder,
  useDeleteFolder,
} from '@/apis/hooks/useFolders';
import { childFolders, folderAncestry, foldersAsPaths } from '@/utils/folders';
import { useUIStore } from '@/store/useUIStore';
import { usePermissions } from '@/hooks/usePermissions';
import { documentStatusLabel } from '@/utils/helpers';
import { Icon } from '@/components/ui/Icons';
import { StatusBadge, ConfBadge, UrgBadge } from '@/components/ui/Badges';
import { exportCsv } from '@/utils/exportCsv';
import { Table, Column } from '@/components/ui/Table';
import { Skeleton, SkeletonTable, SkeletonTreeRows } from '@/components/common/Skeleton';
import { cabinetAllows, useMyCabinetAccess } from '@/components/cabinets/cabinetAccess';
import { CabinetSchemaCard, useCanManageSchema } from '@/components/cabinets/CabinetSchemaCard';
import { CabinetAccessCard, useCanGrantAccess } from '@/components/cabinets/CabinetAccessCard';

/** Sentinel `activeFolder` value for "documents in this cabinet with no
 *  folder" — `GET /documents` has no `folderId=null` filter (only exact
 *  match), so this bucket is walked and filtered client-side, same approach
 *  as `UnfiledDocuments` in `admin/cabinets/page.tsx`. */
const UNFILED = '__unfiled__';

/** high/critical only, per spec — low/normal get no flash. */
function urgencyRowClass(urgency: string): string {
  const tier = urgency?.toLowerCase();
  if (tier === 'critical') return 'urg-row-critical';
  if (tier === 'high') return 'urg-row-high';
  return '';
}

export default function CabinetBrowserPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const queryClient = useQueryClient();
  const { data: usersData } = useUsers();
  const users = usersData?.data || [];
  const { setPageTitle, openModal, openConfirm, addToast } = useUIStore();
  const { auditAction } = useStore();
  const { can } = usePermissions();

  const [activeCab, setActiveCab] = useState<string | null>(searchParams?.get('cab') || null);
  const [activeFolder, setActiveFolder] = useState<string | null>(
    searchParams?.get('folder') || null,
  );
  const [view, setView] = useState<'list' | 'grid'>('list');
  const [selected, setSelected] = useState<any[]>([]);
  const [cabTab, setCabTab] = useState<'folders' | 'schema' | 'access'>('folders');

  useEffect(() => {
    setPageTitle('Cabinet Browser');
  }, [setPageTitle]);

  const { data: cabinetsData, isLoading: isLoadingCabinets } = useCabinets();
  const cabinets = cabinetsData?.data || [];

  const showingUnfiled = activeFolder === UNFILED;
  const showingRealFolder = !!activeFolder && !showingUnfiled;

  // Real folder selected: server-side filtered, paginated as normal.
  const { data: documentsData, isLoading: isLoadingDocs } = useDocuments(
    { cabinetId: activeCab || undefined, folderId: showingRealFolder ? activeFolder! : undefined },
    { enabled: showingRealFolder },
  );

  // Cabinet selected but no folder yet, or the "Unfiled" bucket is open:
  // walk the whole cabinet once to (a) know whether an Unfiled card should
  // even show at the folder-listing step, and (b) supply its contents if
  // the user has opened it. One query serves both — never runs for a real
  // folder (that's server-filtered above) or with no cabinet selected.
  const { data: cabinetAllDocs, isLoading: isLoadingCabinetAllDocs } = useAllDocuments(
    { cabinetId: activeCab || undefined },
    { enabled: !!activeCab && !showingRealFolder },
  );
  const unfiledDocs = (cabinetAllDocs || []).filter((d: any) => !d.folderId);

  const docs = showingUnfiled ? unfiledDocs : documentsData?.data || [];
  const isLoadingDocList = showingUnfiled ? isLoadingCabinetAllDocs : isLoadingDocs;

  const { data: activeCabFoldersData, isLoading: isLoadingFolders } = useCabinetFolders(
    activeCab || undefined,
  );
  const activeCabFolders = activeCabFoldersData?.data || [];
  const activeCabinet = activeCab ? cabById(cabinets, activeCab) : undefined;
  // Folders nest through `parentId`; the API returns them flat.
  const subFolders = showingRealFolder ? childFolders(activeCabFolders, activeFolder) : [];
  const openFolder = showingRealFolder
    ? activeCabFolders.find((f: any) => f.id === activeFolder)
    : undefined;

  const { routeDocuments, canRoute } = useRouteToWorkflow();

  const [isSubmitting, setIsSubmitting] = useState(false);

  // Every action below needs a role permission AND a level on this cabinet —
  // the two checks the API makes — so each shows only when both pass.
  const myLevel = useMyCabinetAccess(activeCab);
  const canCreateFolder = can('folder', 'create') && cabinetAllows(myLevel, 'upload');
  const canRenameFolder = can('folder', 'edit') && cabinetAllows(myLevel, 'edit');
  const canDeleteFolder = can('folder', 'delete') && cabinetAllows(myLevel, 'delete');
  const canMoveDocuments = can('document', 'edit') && cabinetAllows(myLevel, 'edit');
  const canManageSchema = useCanManageSchema(activeCabinet);
  const canGrantAccess = useCanGrantAccess(activeCabinet);

  useEffect(() => {
    setCabTab('folders');
  }, [activeCab]);

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
          <label>Name</label>
          <input
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
              .then(() => {
                auditAction('FOLDER_CREATE', activeCabinet.id, 'Added folder ' + name.trim());
              })
              .catch(() => false);
          },
        },
      ],
    });
  };

  const handleRenameFolder = (f: any) => {
    let name = f.name;
    openModal({
      title: `Rename folder "${f.name}"`,
      body: (
        <div className="field">
          <label>Folder name</label>
          <input
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
              .then(() => {
                auditAction('FOLDER_EDIT', f.cabinetId, `Renamed folder → ${name.trim()}`);
              })
              .catch(() => false);
          },
        },
      ],
    });
  };

  const handleDeleteFolder = (f: any) => {
    if ((f._count?.documents ?? 0) > 0) {
      addToast('Folder contains documents — move them first', 'error');
      return;
    }
    // The API would leave its sub-folders orphaned at the top level.
    if (childFolders(activeCabFolders, f.id).length > 0) {
      addToast('Folder has sub-folders — delete or move them first', 'error');
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
            auditAction('FOLDER_DELETE', f.cabinetId, 'Deleted ' + f.name);
            setActiveFolder(f.parentId ?? null);
            setSelected([]);
          })
          .catch(() => false),
    });
  };

  /**
   * Moves the selected documents to another folder in the same cabinet. The API
   * can't move a document between cabinets (`PATCH /documents/{id}` ignores
   * `cabinetId`) or take it out of a folder (`folderId` can't be null), so the
   * picker offers neither — only this cabinet's other folders.
   */
  const handleMoveModal = () => {
    const docs = selected;
    const destinations = foldersAsPaths(activeCabFolders)
      .filter((f: any) => f.id !== activeFolder)
      .map((f) => ({ id: f.id, name: f.path }));
    let destFolderId = '';
    openModal({
      title: docs.length > 1 ? `Move ${docs.length} documents` : `Move “${docs[0].title}”`,
      body: (
        <MoveDocumentsModalBody
          folders={destinations}
          onChange={(folderId) => (destFolderId = folderId)}
        />
      ),
      actions: [
        { label: 'Cancel' },
        {
          label: docs.length > 1 ? `Move ${docs.length}` : 'Move',
          kind: 'btn-primary',
          onClick: () => {
            if (!destFolderId) {
              addToast('Choose a destination folder', 'error');
              return false;
            }
            setIsSubmitting(true);
            return Promise.all(
              docs.map((d) => documentsService.update(d.id, { folderId: destFolderId })),
            )
              .then(() => {
                docs.forEach((d) => auditAction('DOCUMENT_MOVE', d.id, `Moved “${d.title}”`));
                addToast(
                  docs.length > 1 ? `${docs.length} documents moved` : 'Document moved',
                  'success',
                );
                setSelected([]);
              })
              .catch((err: any) => {
                addToast(err.response?.data?.message || 'Failed to move documents', 'error');
                return false;
              })
              .finally(() => {
                // Promise.all rejects on the first failure while others may
                // still have landed, so refetch either way. Folder and cabinet
                // queries carry the document counts shown on the cards.
                queryClient.invalidateQueries({ queryKey: ['documents'] });
                queryClient.invalidateQueries({ queryKey: ['folders'] });
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
      selected.map((d) => ({ id: d.id, title: d.title })),
      { onSuccess: () => setSelected([]) },
    );

  const cols: Column<any>[] = [
    {
      key: 'title',
      label: 'Title',
      sortable: true,
      render: (d) => (
        <span className="flex items-center gap-2">
          <span style={{ fontWeight: 600 }}>{d.title}</span>
        </span>
      ),
    },
    { key: 'type', label: 'Type', sortable: true },
    { key: 'status', label: 'Status', render: (d) => <StatusBadge status={documentStatusLabel(d)} /> },
    {
      key: 'confidentiality',
      label: 'Confidentiality',
      render: (d) => <ConfBadge level={d.confidentiality} />,
    },
    { key: 'urgency', label: 'Urgency', render: (d) => <UrgBadge level={d.urgency} /> },
    {
      key: 'createdBy',
      label: 'Uploaded by',
      render: (d) => <span>{userById(users, d.createdBy)?.name || 'Unknown'}</span>,
    },
    {
      key: 'createdAt',
      label: 'Created',
      sortable: true,
      render: (d) => <span>{new Date(d.createdAt).toLocaleDateString('en-GB')}</span>,
    },
  ];

  // This page previously had no loading state at all — the tree and table
  // simply rendered empty until the fetch resolved.
  if (isLoadingCabinets) return <CabinetBrowserSkeleton />;

  return (
    <div>
      <div className="page-head">
        <div>
          <div className="page-title">Cabinet Browser</div>
          <div className="page-sub">
            Navigate cabinets and folders; select rows for bulk actions.
          </div>
        </div>
        <div className="actions">
          <button className="btn btn-accent" onClick={() => router.push('/upload')}>
            <span style={{ marginRight: '4px' }}>
              <Icon name="upload" size={15} />
            </span>{' '}
            Upload
          </button>
        </div>
      </div>

      <div className="cab-layout">
        {/* Tree */}
        <div className="card tree">
          <div
            className={`tree-item ${!activeCab ? 'active' : ''}`}
            onClick={() => {
              setActiveCab(null);
              setActiveFolder(null);
              setSelected([]);
            }}
          >
            <span style={{ marginRight: '8px' }}>
              <Icon name="grid" size={15} />
            </span>{' '}
            All cabinets
          </div>
          {cabinets.map((c: any) => (
            <React.Fragment key={c.id}>
              <div
                className={`tree-item ${activeCab === c.id && !activeFolder ? 'active' : ''}`}
                onClick={() => {
                  setActiveCab(c.id);
                  setActiveFolder(null);
                  setSelected([]);
                }}
              >
                <span style={{ marginRight: '8px' }}>
                  <Icon name="cabinet" size={15} />
                </span>{' '}
                {c.name}
              </div>
              {activeCab === c.id && activeCabFolders.length > 0 && (
                <div className="tree-kids">
                  {foldersAsPaths(activeCabFolders).map((f: any) => {
                    const depth = folderAncestry(activeCabFolders, f.id).length - 1;
                    return (
                      <div
                        key={f.id}
                        className={`tree-item ${activeFolder === f.id ? 'active' : ''}`}
                        style={depth ? { paddingLeft: `${12 + depth * 14}px` } : undefined}
                        onClick={() => {
                          setActiveFolder(f.id);
                          setSelected([]);
                        }}
                      >
                        <span style={{ marginRight: '8px' }}>
                          <Icon name="folder" size={14} />
                        </span>{' '}
                        {f.name}
                      </div>
                    );
                  })}
                </div>
              )}
            </React.Fragment>
          ))}
        </div>

        {/* Main panel */}
        <div className="min-w-0">
          <div className="flex flex-wrap justify-between items-center gap-2.5 mb-2">
            <div className="crumbs">
              <a
                onClick={() => {
                  setActiveCab(null);
                  setActiveFolder(null);
                  setSelected([]);
                }}
              >
                Cabinets
              </a>
              {activeCab && (
                <>
                  <span className="sep">›</span>
                  {activeFolder ? (
                    <a
                      onClick={() => {
                        setActiveFolder(null);
                        setSelected([]);
                      }}
                    >
                      {cabById(cabinets, activeCab)?.name}
                    </a>
                  ) : (
                    <span className="cur">{cabById(cabinets, activeCab)?.name}</span>
                  )}
                </>
              )}
              {showingUnfiled && (
                <>
                  <span className="sep">›</span>
                  <span className="cur">Unfiled documents</span>
                </>
              )}
              {showingRealFolder &&
                folderAncestry(activeCabFolders, activeFolder!).map((f: any) => (
                  <React.Fragment key={f.id}>
                    <span className="sep">›</span>
                    {f.id === activeFolder ? (
                      <span className="cur">{f.name}</span>
                    ) : (
                      <a
                        onClick={() => {
                          setActiveFolder(f.id);
                          setSelected([]);
                        }}
                      >
                        {f.name}
                      </a>
                    )}
                  </React.Fragment>
                ))}
            </div>

            {activeCab && !activeFolder && canCreateFolder && cabTab === 'folders' && (
              <button className="btn btn-secondary btn-sm" onClick={() => handleNewFolder()}>
                + New folder
              </button>
            )}

            {activeFolder && (
              <div className="flex items-center gap-3">
                {openFolder && canCreateFolder && (
                  <button
                    className="btn btn-ghost btn-sm"
                    onClick={() => handleNewFolder(openFolder)}
                  >
                    + New sub-folder
                  </button>
                )}
                {openFolder && canRenameFolder && (
                  <button
                    className="btn btn-ghost btn-sm"
                    onClick={() => handleRenameFolder(openFolder)}
                  >
                    Rename folder
                  </button>
                )}
                {openFolder && canDeleteFolder && (
                  <button
                    className="btn btn-ghost btn-sm"
                    onClick={() => handleDeleteFolder(openFolder)}
                  >
                    Delete folder
                  </button>
                )}
                <div className="urg-legend">
                  <span>
                    <span className="urg-dot critical" /> Critical
                  </span>
                  <span>
                    <span className="urg-dot high" /> High
                  </span>
                </div>
                <div className="seg" role="group" aria-label="View mode">
                  <button
                    className={view === 'list' ? 'active' : ''}
                    onClick={() => setView('list')}
                  >
                    List
                  </button>
                  <button
                    className={view === 'grid' ? 'active' : ''}
                    onClick={() => setView('grid')}
                  >
                    Grid
                  </button>
                </div>
              </div>
            )}
          </div>

          {selected.length > 0 && (
            <div className="bulkbar">
              <b>{selected.length} selected</b>
              {canMoveDocuments && (
                <button
                  className="btn btn-secondary btn-sm"
                  onClick={handleMoveModal}
                  disabled={isSubmitting}
                >
                  Move
                </button>
              )}
              {canRoute && (
                <button
                  className="btn btn-secondary btn-sm"
                  onClick={handleRouteModal}
                  disabled={isSubmitting}
                >
                  Route
                </button>
              )}
              <button
                className="btn btn-secondary btn-sm"
                onClick={() => exportCsv('Cabinet_Selected_Documents', selected)}
                disabled={isSubmitting}
              >
                Export
              </button>
              <button
                className="btn btn-secondary btn-sm"
                style={{ marginLeft: 'auto' }}
                onClick={() => setSelected([])}
              >
                Clear
              </button>
            </div>
          )}

          {subFolders.length > 0 && (
            <div className="flex gap-2 mb-2" style={{ flexWrap: 'wrap' }}>
              {subFolders.map((f: any) => (
                <button
                  key={f.id}
                  className="btn btn-secondary btn-sm"
                  onClick={() => {
                    setActiveFolder(f.id);
                    setSelected([]);
                  }}
                >
                  <Icon name="folder" size={13} /> {f.name}
                  <span className="caption">{f._count?.documents ?? 0}</span>
                </button>
              ))}
            </div>
          )}

          {!activeCab ? (
            <div className="card">
              {cabinets.length === 0 ? (
                <div className="empty">
                  <Icon name="cabinet" size={32} />
                  <div className="h3 mt-4 mb-2">No cabinets yet</div>
                  <p className="caption mb-4">An administrator sets these up.</p>
                </div>
              ) : (
                <div className="doc-grid">
                  {cabinets.map((c: any) => (
                    <div
                      key={c.id}
                      className="doc-card"
                      onClick={() => {
                        setActiveCab(c.id);
                        setActiveFolder(null);
                        setSelected([]);
                      }}
                    >
                      <div className="doc-thumb">
                        <Icon name="cabinet" size={28} />
                      </div>
                      <div style={{ fontWeight: 700, fontSize: '12.5px', lineHeight: 1.4 }}>
                        {c.name}
                      </div>
                      {c.department?.name && (
                        <div className="caption" style={{ marginTop: '4px' }}>
                          {c.department.name}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          ) : !activeFolder ? (
            <>
              {(canManageSchema || canGrantAccess) && (
                <div className="tabs mb-4" role="tablist" aria-label="Cabinet sections">
                  <button
                    role="tab"
                    aria-selected={cabTab === 'folders'}
                    className={`tab ${cabTab === 'folders' ? 'active' : ''}`}
                    onClick={() => setCabTab('folders')}
                  >
                    Folders
                  </button>
                  {canManageSchema && (
                    <button
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
                <div className="card">
                  {isLoadingFolders || isLoadingCabinetAllDocs ? (
                    <div className="doc-grid">
                      {Array.from({ length: 6 }).map((_, i) => (
                        <div
                          key={i}
                          className="doc-card"
                          style={{ cursor: 'default' }}
                          aria-hidden="true"
                        >
                          <Skeleton
                            height={70}
                            radius={10}
                            style={{ width: '100%', marginBottom: '11px' }}
                          />
                          <Skeleton height={12} width="70%" />
                        </div>
                      ))}
                    </div>
                  ) : activeCabFolders.length === 0 && unfiledDocs.length === 0 ? (
                    <div className="empty">
                      <Icon name="folder" size={32} />
                      <div className="h3 mt-4 mb-2">No folders in this cabinet yet</div>
                      {canCreateFolder ? (
                        <button className="btn btn-primary btn-sm" onClick={() => handleNewFolder()}>
                          + New folder
                        </button>
                      ) : (
                        <p className="caption mb-4">
                          Folders are set up by whoever manages this cabinet.
                        </p>
                      )}
                    </div>
                  ) : (
                    <div className="doc-grid">
                      {childFolders(activeCabFolders, null).map((f: any) => (
                        <div
                          key={f.id}
                          className="doc-card"
                          onClick={() => {
                            setActiveFolder(f.id);
                            setSelected([]);
                          }}
                        >
                          <div className="doc-thumb">
                            <Icon name="folder" size={28} />
                          </div>
                          <div style={{ fontWeight: 700, fontSize: '12.5px', lineHeight: 1.4 }}>
                            {f.name}
                          </div>
                          <div className="caption" style={{ marginTop: '4px' }}>
                            {f._count?.documents ?? 0} doc{f._count?.documents === 1 ? '' : 's'}
                          </div>
                        </div>
                      ))}
                      {unfiledDocs.length > 0 && (
                        <div
                          className="doc-card"
                          onClick={() => {
                            setActiveFolder(UNFILED);
                            setSelected([]);
                          }}
                        >
                          <div className="doc-thumb">
                            <Icon name="doc" size={28} />
                          </div>
                          <div style={{ fontWeight: 700, fontSize: '12.5px', lineHeight: 1.4 }}>
                            Unfiled documents
                          </div>
                          <div className="caption" style={{ marginTop: '4px' }}>
                            {unfiledDocs.length} doc{unfiledDocs.length === 1 ? '' : 's'}
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}
            </>
          ) : isLoadingDocList ? (
            <div className="card">
              {view === 'grid' ? (
                <div className="doc-grid">
                  {Array.from({ length: 8 }).map((_, i) => (
                    <div key={i} className="doc-card" style={{ cursor: 'default' }} aria-hidden="true">
                      <Skeleton height={70} radius={10} style={{ width: '100%', marginBottom: '11px' }} />
                      <Skeleton height={12} width="80%" style={{ marginBottom: '7px' }} />
                      <Skeleton height={16} width="45%" />
                    </div>
                  ))}
                </div>
              ) : (
                <SkeletonTable
                  columns={['', 'Title', 'Type', 'Status', 'Confidentiality', 'Urgency', 'Uploaded by', 'Created']}
                />
              )}
            </div>
          ) : !docs.length ? (
            <div className="card">
              <div className="empty">
                <Icon name="folder" size={32} />
                <div className="h3 mt-4 mb-2">
                  {showingUnfiled ? 'No unfiled documents' : 'This folder is empty'}
                </div>
                <p className="caption mb-4">Upload a document to get started.</p>
                <button className="btn btn-primary btn-sm" onClick={() => router.push('/upload')}>
                  Upload
                </button>
              </div>
            </div>
          ) : view === 'grid' ? (
            <div className="card">
              <div className="doc-grid">
                {docs.map((d) => (
                  <div
                    key={d.id}
                    className={`doc-card ${urgencyRowClass(d.urgency)}`}
                    onClick={() => router.push(`/doc/${d.id}`)}
                  >
                    <div className="doc-thumb">
                      <Icon name="doc" size={28} />
                    </div>
                    <div
                      className="flex items-center gap-2"
                      style={{
                        fontWeight: 700,
                        fontSize: '12px',
                        lineHeight: 1.4,
                        marginBottom: '7px',
                      }}
                    >
                      <span>{d.title}</span>
                    </div>
                    <div className="flex gap-2 flex-wrap">
                      <StatusBadge status={documentStatusLabel(d)} />
                      <ConfBadge level={d.confidentiality} />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div className="card">
              <Table
                cols={cols}
                rows={docs}
                selectable
                onSelect={(sel) => setSelected(sel)}
                onRow={(d) => router.push(`/doc/${d.id}`)}
                rowClassName={(d) => urgencyRowClass(d.urgency)}
              />
            </div>
          )}
        </div>
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
      <label>Destination folder</label>
      <select
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

/** Mirrors the real `.cab-layout` shell — tree sidebar + document table. */
function CabinetBrowserSkeleton() {
  return (
    <div>
      <div className="page-head">
        <div>
          <div className="page-title">Cabinet Browser</div>
          <div className="page-sub">
            Navigate cabinets and folders; select rows for bulk actions.
          </div>
        </div>
      </div>

      <div className="cab-layout">
        <div className="card tree">
          <SkeletonTreeRows rows={7} />
        </div>

        <div className="min-w-0">
          <div className="card">
            <SkeletonTable
              columns={['', 'Title', 'Type', 'Status', 'Confidentiality', 'Urgency', 'Uploaded by', 'Created']}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
