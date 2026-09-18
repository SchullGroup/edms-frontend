'use client';

import React, { useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { effStatus, cabById, userById } from '@/store/useStore';
import { useCabinets } from '@/apis/hooks/useCabinets';
import { useDocuments, useAllDocuments } from '@/apis/hooks/useDocuments';
import { useRouteToWorkflow } from '@/hooks/useRouteToWorkflow';
import { useUsers } from '@/apis/hooks/useUsers';
import { documentsService } from '@/apis/services/documents.service';
import { useQueryClient } from '@tanstack/react-query';
import { useCabinetFolders } from '@/apis/hooks/useFolders';
import { useUIStore } from '@/store/useUIStore';
import { Icon } from '@/components/ui/Icons';
import { StatusBadge, ConfBadge, UrgBadge } from '@/components/ui/Badges';
import { exportCsv } from '@/utils/exportCsv';
import { Table, Column } from '@/components/ui/Table';
import { Skeleton, SkeletonTable, SkeletonTreeRows } from '@/components/common/Skeleton';

/** Sentinel `activeFolder` value for "documents in this cabinet with no
 *  folder" — `GET /documents` has no `folderId=null` filter (only exact
 *  match), so this bucket is walked and filtered client-side, same approach
 *  as `UnfiledDocuments` in `admin/cabinets/page.tsx`. */
const UNFILED = '__unfiled__';

/** high/critical only, per spec — low/normal get no dot. */
function UrgencyDot({ urgency }: { urgency: string }) {
  const tier = urgency?.toLowerCase();
  if (tier !== 'high' && tier !== 'critical') return null;
  return <span className={`urg-dot ${tier}`} title={`Urgency: ${urgency}`} />;
}

export default function CabinetBrowserPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const queryClient = useQueryClient();
  const { data: usersData } = useUsers();
  const users = usersData?.data || [];
  const { setPageTitle, openModal, closeModal, addToast } = useUIStore();

  const [activeCab, setActiveCab] = useState<string | null>(searchParams?.get('cab') || null);
  const [activeFolder, setActiveFolder] = useState<string | null>(
    searchParams?.get('folder') || null,
  );
  const [view, setView] = useState<'list' | 'grid'>('list');
  const [selected, setSelected] = useState<any[]>([]);

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

  const { routeDocuments } = useRouteToWorkflow();

  const [isSubmitting, setIsSubmitting] = useState(false);

  const MoveModalBody = ({ cabinets, selectedDocs, onMove }: any) => {
    const [selCab, setSelCab] = useState(cabinets[0]?.id || '');
    const { data: folData } = useCabinetFolders(selCab);
    const folders = folData?.data || [];
    const [selFol, setSelFol] = useState('');

    return (
      <div className="field">
        <label>Destination Cabinet</label>
        <select
          className="input mb2"
          value={selCab}
          onChange={(e) => {
            setSelCab(e.target.value);
            setSelFol('');
          }}
        >
          {cabinets.map((c: any) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
        <label>Destination Folder (Optional)</label>
        <select className="input" value={selFol} onChange={(e) => setSelFol(e.target.value)}>
          <option value="">-- No Folder --</option>
          {folders.map((f: any) => (
            <option key={f.id} value={f.id}>
              {f.name}
            </option>
          ))}
        </select>
        <div className="mt-1 flex justify-end" style={{ gap: '8px' }}>
          <button className="btn" onClick={closeModal}>
            Cancel
          </button>
          <button className="btn btn-primary" onClick={() => onMove(selCab, selFol)}>
            Move
          </button>
        </div>
      </div>
    );
  };

  const handleMoveModal = () => {
    openModal({
      title: `Move ${selected.length} document(s)`,
      body: (
        <MoveModalBody
          cabinets={cabinets}
          selectedDocs={selected}
          onMove={(cab: string, fol: string) => {
            setIsSubmitting(true);
            (async () => {
              try {
                await Promise.all(
                  selected.map((d) =>
                    documentsService.update(d.id, { cabinetId: cab, folderId: fol || undefined }),
                  ),
                );
                queryClient.invalidateQueries({ queryKey: ['documents'] });
                addToast('Documents moved', 'success');
                setSelected([]);
                closeModal();
              } catch (err: any) {
                addToast(err.message || 'Failed to move documents', 'error');
              } finally {
                setIsSubmitting(false);
              }
            })();
          }}
        />
      ),
      actions: [],
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
          <UrgencyDot urgency={d.urgency} />
          <span style={{ fontWeight: 600 }}>{d.title}</span>
        </span>
      ),
    },
    { key: 'type', label: 'Type', sortable: true },
    { key: 'status', label: 'Status', render: (d) => <StatusBadge status={effStatus(d)} /> },
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
                  {activeCabFolders.map((f: any) => (
                    <div
                      key={f.id}
                      className={`tree-item ${activeFolder === f.id ? 'active' : ''}`}
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
                  ))}
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
              {activeFolder && (
                <>
                  <span className="sep">›</span>
                  <span className="cur">
                    {showingUnfiled
                      ? 'Unfiled documents'
                      : activeCabFolders.find((f: any) => f.id === activeFolder)?.name || ''}
                  </span>
                </>
              )}
            </div>

            {activeFolder && (
              <div className="flex items-center gap-3">
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
              <button
                className="btn btn-secondary btn-sm"
                onClick={handleMoveModal}
                disabled={isSubmitting}
              >
                Move
              </button>
              <button
                className="btn btn-secondary btn-sm"
                onClick={handleRouteModal}
                disabled={isSubmitting}
              >
                Route
              </button>
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
            <div className="card">
              {isLoadingFolders || isLoadingCabinetAllDocs ? (
                <div className="doc-grid">
                  {Array.from({ length: 6 }).map((_, i) => (
                    <div key={i} className="doc-card" style={{ cursor: 'default' }} aria-hidden="true">
                      <Skeleton height={70} radius={10} style={{ width: '100%', marginBottom: '11px' }} />
                      <Skeleton height={12} width="70%" />
                    </div>
                  ))}
                </div>
              ) : activeCabFolders.length === 0 && unfiledDocs.length === 0 ? (
                <div className="empty">
                  <Icon name="folder" size={32} />
                  <div className="h3 mt-4 mb-2">No folders in this cabinet yet</div>
                  <p className="caption mb-4">An administrator sets these up.</p>
                </div>
              ) : (
                <div className="doc-grid">
                  {activeCabFolders.map((f: any) => (
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
                  <div key={d.id} className="doc-card" onClick={() => router.push(`/doc/${d.id}`)}>
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
                      <UrgencyDot urgency={d.urgency} />
                      <span>{d.title}</span>
                    </div>
                    <div className="flex gap-2 flex-wrap">
                      <StatusBadge status={effStatus(d)} />
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
              />
            </div>
          )}
        </div>
      </div>
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
