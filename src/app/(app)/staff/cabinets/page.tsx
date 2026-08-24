'use client';

import React, { useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useStore, effStatus, cabById, userById } from '@/store/useStore';
import { useCabinets } from '@/apis/hooks/useCabinets';
import { useDocuments } from '@/apis/hooks/useDocuments';
import { useWorkflows } from '@/apis/hooks/useWorkflows';
import { useStartWorkflowInstance } from '@/apis/hooks/useWorkflowInstances';
import { documentsService } from '@/apis/services/documents.service';
import { useQueryClient } from '@tanstack/react-query';
import { useCabinetFolders } from '@/apis/hooks/useFolders';
import { useUIStore } from '@/store/useUIStore';
import { Icon } from '@/components/ui/Icons';
import { StatusBadge, ConfBadge, UrgBadge } from '@/components/ui/Badges';
import { exportCsv } from '@/utils/exportCsv';
import { Table, Column } from '@/components/ui/Table';

export default function CabinetBrowserPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const queryClient = useQueryClient();
  const { session, users } = useStore();
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

  const { data: cabinetsData } = useCabinets();
  const cabinets = cabinetsData?.data || [];

  const { data: documentsData } = useDocuments({
    cabinetId: activeCab || undefined,
    folderId: activeFolder || undefined,
  });
  const docs = documentsData?.data || [];

  const { data: activeCabFoldersData } = useCabinetFolders(activeCab || undefined);
  const activeCabFolders = activeCabFoldersData?.data || [];

  const { data: workflowsData } = useWorkflows();
  const workflows = workflowsData?.data || [];
  const { mutateAsync: startWorkflow } = useStartWorkflowInstance();

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
        <div className="mt4 flex jce" style={{ gap: '8px' }}>
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

  const handleRouteModal = () => {
    let selValue = workflows.length > 0 ? workflows[0].id : '';
    openModal({
      title: `Route ${selected.length} document(s)`,
      body: (
        <div className="field">
          <label>Select Workflow</label>
          <select
            className="input"
            onChange={(e) => (selValue = e.target.value)}
            defaultValue={selValue}
          >
            {workflows.map((w: any) => (
              <option key={w.id} value={w.id}>
                {w.name}
              </option>
            ))}
          </select>
          {workflows.length === 0 && (
            <div className="help text-error mt4">
              No workflows available. Please create one first.
            </div>
          )}
        </div>
      ),
      actions: [
        { label: 'Cancel' },
        {
          label: 'Route',
          kind: 'btn-primary',
          disabled: workflows.length === 0,
          onClick: () => {
            if (!selValue) return;
            setIsSubmitting(true);
            (async () => {
              try {
                await Promise.all(
                  selected.map((d) => startWorkflow({ workflowId: selValue, documentId: d.id })),
                );
                addToast(`${selected.length} document(s) routed to workflow`, 'success');
                setSelected([]);
                closeModal();
              } catch (err: any) {
                addToast(err.message || 'Failed to route documents', 'error');
              } finally {
                setIsSubmitting(false);
              }
            })();
          },
        },
      ],
    });
  };

  const cols: Column<any>[] = [
    {
      key: 'title',
      label: 'Title',
      sortable: true,
      render: (d) => <span style={{ fontWeight: 600 }}>{d.title}</span>,
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
      key: 'assignee',
      label: 'Assignee',
      render: (d) => <span>{userById(users, d.assignee).name}</span>,
    },
    {
      key: 'created',
      label: 'Created',
      sortable: true,
      render: (d) => <span>{new Date(d.created).toLocaleDateString('en-GB')}</span>,
    },
  ];

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

        {/* List Card */}
        <div>
          <div className="flex jcb aic mb8" style={{ gap: '10px', flexWrap: 'wrap' }}>
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
                    {activeCabFolders.find((f: any) => f.id === activeFolder)?.name || ''}
                  </span>
                </>
              )}
            </div>

            <div className="seg" role="group" aria-label="View mode">
              <button className={view === 'list' ? 'active' : ''} onClick={() => setView('list')}>
                List
              </button>
              <button className={view === 'grid' ? 'active' : ''} onClick={() => setView('grid')}>
                Grid
              </button>
            </div>
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

          {!docs.length ? (
            <div className="card">
              <div className="empty">
                <Icon name="folder" size={32} />
                <div className="h3 mt16 mb8">This folder is empty</div>
                <p className="caption mb16">Upload a document to get started.</p>
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
                      style={{
                        fontWeight: 700,
                        fontSize: '12px',
                        lineHeight: 1.4,
                        marginBottom: '7px',
                      }}
                    >
                      {d.title}
                    </div>
                    <div className="flex g8 wrap">
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
