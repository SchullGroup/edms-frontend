'use client';

import React, { useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useStore, effStatus, cabById, folderName, userById } from '@/store/useStore';
import { useUIStore } from '@/store/useUIStore';
import { Icon } from '@/components/ui/Icons';
import { StatusBadge, ConfBadge, UrgBadge } from '@/components/ui/Badges';
import { Table, Column } from '@/components/ui/Table';

export default function CabinetBrowserPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { documents, cabinets, session, users, auditAction, updateDocument } = useStore();
  const { setPageTitle, openModal, closeModal, addToast } = useUIStore();

  const [activeCab, setActiveCab] = useState<string | null>(searchParams?.get('cab') || null);
  const [activeFolder, setActiveFolder] = useState<string | null>(searchParams?.get('folder') || null);
  const [view, setView] = useState<'list' | 'grid'>('list');
  const [selected, setSelected] = useState<any[]>([]);

  useEffect(() => {
    setPageTitle('Cabinet Browser');
  }, [setPageTitle]);

  const docsIn = () => {
    return documents.filter(d => 
      (!activeCab || d.cabinet === activeCab) && 
      (!activeFolder || d.folder === activeFolder)
    );
  };

  const docs = docsIn();

  const handleMoveModal = () => {
    let selValue = '';
    openModal({
      title: `Move ${selected.length} document(s)`,
      body: (
        <div className="field">
          <label>Destination folder</label>
          <select className="input" onChange={e => selValue = e.target.value}>
            {cabinets.flatMap((c: any) => c.folders.map((f: any) => (
              <option key={`${c.id}|${f.id}`} value={`${c.id}|${f.id}`}>{c.name} › {f.name}</option>
            )))}
          </select>
        </div>
      ),
      actions: [
        { label: 'Cancel' },
        {
          label: 'Move',
          kind: 'btn-primary',
          onClick: () => {
            const val = selValue || `${cabinets[0].id}|${cabinets[0].folders[0].id}`;
            const [cab, fol] = val.split('|');
            selected.forEach(d => {
              updateDocument(d.id, { cabinet: cab, folder: fol });
              auditAction('MOVE', d.id, `Moved to ${cabById(cabinets, cab)?.name}`);
            });
            addToast('Documents moved', 'success');
            setSelected([]);
            closeModal();
          }
        }
      ]
    });
  };

  const cols: Column<any>[] = [
    { key: 'title', label: 'Title', sortable: true, render: d => <span style={{ fontWeight: 600 }}>{d.title}</span> },
    { key: 'type', label: 'Type', sortable: true },
    { key: 'status', label: 'Status', render: d => <StatusBadge status={effStatus(d)} /> },
    { key: 'confidentiality', label: 'Confidentiality', render: d => <ConfBadge level={d.confidentiality} /> },
    { key: 'urgency', label: 'Urgency', render: d => <UrgBadge level={d.urgency} /> },
    { key: 'assignee', label: 'Assignee', render: d => <span>{userById(users, d.assignee).name}</span> },
    { key: 'created', label: 'Created', sortable: true, render: d => <span>{new Date(d.created).toLocaleDateString('en-GB')}</span> },
  ];

  return (
    <div>
      <div className="page-head">
        <div>
          <div className="page-title">Cabinet Browser</div>
          <div className="page-sub">Navigate cabinets and folders; select rows for bulk actions.</div>
        </div>
        <div className="actions">
          <button className="btn btn-accent" onClick={() => router.push('/upload')}>
            <span style={{ marginRight: '4px' }}><Icon name="upload" size={15} /></span> Upload
          </button>
        </div>
      </div>

      <div className="cab-layout">
        {/* Tree */}
        <div className="card tree">
          <div className={`tree-item ${!activeCab ? 'active' : ''}`} onClick={() => { setActiveCab(null); setActiveFolder(null); setSelected([]); }}>
            <span style={{ marginRight: '8px' }}><Icon name="grid" size={15} /></span> All cabinets
          </div>
          {cabinets.map((c: any) => (
            <React.Fragment key={c.id}>
              <div 
                className={`tree-item ${activeCab === c.id && !activeFolder ? 'active' : ''}`}
                onClick={() => { setActiveCab(c.id); setActiveFolder(null); setSelected([]); }}
              >
                <span style={{ marginRight: '8px' }}><Icon name="cabinet" size={15} /></span> {c.name}
                <span className="caption" style={{ marginLeft: 'auto' }}>
                  {documents.filter(d => d.cabinet === c.id).length}
                </span>
              </div>
              {activeCab === c.id && (
                <div className="tree-kids">
                  {c.folders.map((f: any) => (
                    <div 
                      key={f.id}
                      className={`tree-item ${activeFolder === f.id ? 'active' : ''}`}
                      onClick={() => { setActiveFolder(f.id); setSelected([]); }}
                    >
                      <span style={{ marginRight: '8px' }}><Icon name="folder" size={14} /></span> {f.name}
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
              <a onClick={() => { setActiveCab(null); setActiveFolder(null); setSelected([]); }}>Cabinets</a>
              {activeCab && (
                <>
                  <span className="sep">›</span>
                  {activeFolder ? (
                    <a onClick={() => { setActiveFolder(null); setSelected([]); }}>{cabById(cabinets, activeCab)?.name}</a>
                  ) : (
                    <span className="cur">{cabById(cabinets, activeCab)?.name}</span>
                  )}
                </>
              )}
              {activeFolder && (
                <>
                  <span className="sep">›</span>
                  <span className="cur">{folderName(cabinets, activeCab!, activeFolder)}</span>
                </>
              )}
            </div>
            
            <div className="seg" role="group" aria-label="View mode">
              <button className={view === 'list' ? 'active' : ''} onClick={() => setView('list')}>List</button>
              <button className={view === 'grid' ? 'active' : ''} onClick={() => setView('grid')}>Grid</button>
            </div>
          </div>

          {selected.length > 0 && (
            <div className="bulkbar">
              <b>{selected.length} selected</b>
              <button className="btn btn-secondary btn-sm" onClick={handleMoveModal}>Move</button>
              <button className="btn btn-secondary btn-sm" onClick={() => {
                selected.forEach(d => auditAction('ROUTE', d.id, 'Routed into workflow from bulk action'));
                addToast(`${selected.length} document(s) routed into their default workflow`, 'success');
                setSelected([]);
              }}>Route</button>
              <button className="btn btn-secondary btn-sm" onClick={() => addToast('Export not implemented', 'info')}>Export</button>
              <button className="btn btn-secondary btn-sm" style={{ marginLeft: 'auto' }} onClick={() => setSelected([])}>Clear</button>
            </div>
          )}

          {!docs.length ? (
            <div className="card">
              <div className="empty">
                <Icon name="folder" size={32} />
                <div className="h3 mt16 mb8">This folder is empty</div>
                <p className="caption mb16">Upload a document to get started.</p>
                <button className="btn btn-primary btn-sm" onClick={() => router.push('/upload')}>Upload</button>
              </div>
            </div>
          ) : view === 'grid' ? (
            <div className="card">
              <div className="doc-grid">
                {docs.map(d => (
                  <div key={d.id} className="doc-card" onClick={() => router.push(`/doc/${d.id}`)}>
                    <div className="doc-thumb"><Icon name="doc" size={28} /></div>
                    <div style={{ fontWeight: 700, fontSize: '12px', lineHeight: 1.4, marginBottom: '7px' }}>{d.title}</div>
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
