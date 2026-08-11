'use client';

import React, { useState, useEffect } from 'react';
import { useStore } from '@/store/useStore';
import { useUIStore } from '@/store/useUIStore';
import { Table, Column } from '@/components/ui/Table';
import { Icon } from '@/components/ui/Icons';
import { useCabinets, useCreateCabinet, useUpdateCabinet } from '@/apis/hooks/useCabinets';
import { useDocuments } from '@/apis/hooks/useDocuments';

export default function CabinetDesignerPage() {
  const { auditAction } = useStore();
  const { setPageTitle, openModal, closeModal, openConfirm, addToast } = useUIStore();

  const { data: cabinetsData, isLoading: isLoadingCabinets } = useCabinets();
  const { data: documentsData } = useDocuments();
  const createCabinet = useCreateCabinet();
  const updateCabinet = useUpdateCabinet();

  const cabinets = cabinetsData?.data || [];
  const documents = documentsData?.data || [];

  const [activeCabId, setActiveCabId] = useState<string | undefined>(undefined);
  const [schema, setSchema] = useState<Record<string, any[]>>({
    'cab-hr': [
      { f: 'Employee', t: 'Text', req: true },
      { f: 'Grade', t: 'Select', req: false },
      { f: 'Start Date', t: 'Date', req: true },
    ],
    'cab-fin': [
      { f: 'Invoice No.', t: 'Text', req: true },
      { f: 'Vendor', t: 'Reference', req: true },
      { f: 'Amount', t: 'Number', req: true },
      { f: 'Payment Terms', t: 'Select', req: false },
    ],
    'cab-legal': [
      { f: 'Counterparty', t: 'Text', req: true },
      { f: 'Value', t: 'Number', req: false },
      { f: 'Term', t: 'Text', req: false },
    ],
    'cab-ops': [
      { f: 'Ref', t: 'Text', req: true },
      { f: 'Severity', t: 'Select', req: false },
    ],
    'cab-proc': [
      { f: 'PO Number', t: 'Text', req: true },
      { f: 'Vendor', t: 'Reference', req: true },
      { f: 'Amount', t: 'Number', req: true },
    ],
  });

  const activeCabIdToUse = activeCabId || cabinets?.[0]?.id;
  const activeCab = cabinets?.find((c: any) => c.id === activeCabIdToUse) || cabinets?.[0];

  useEffect(() => {
    setPageTitle('Cabinet Designer');
  }, [setPageTitle]);

  if (isLoadingCabinets) {
    return <div style={{ padding: '20px' }}>Loading cabinets...</div>;
  }

  if (!activeCab) return <div style={{ padding: '20px' }}>No cabinets found.</div>;

  const handleNewCabinet = () => {
    let name = '';
    openModal({
      title: 'New cabinet',
      body: (
        <div className="field">
          <label>Cabinet name</label>
          <input
            className="input"
            placeholder="e.g. Compliance"
            onChange={(e) => (name = e.target.value)}
          />
        </div>
      ),
      actions: [
        { label: 'Cancel' },
        {
          label: 'Create',
          kind: 'btn-primary',
          onClick: () => {
            if (!name.trim()) return;
            createCabinet.mutate(
              {
                name: name.trim(),
                icon: 'folder',
                folders: [{ id: 'f-' + Date.now(), name: 'General' }],
              },
              {
                onSuccess: (newCab) => {
                  setSchema((s) => ({ ...s, [newCab.id]: [] }));
                  auditAction('CABINET_CREATE', newCab.id, 'Created cabinet ' + name);
                  setActiveCabId(newCab.id);
                  closeModal();
                },
              },
            );
          },
        },
      ],
    });
  };

  const handleNewFolder = () => {
    let name = '';
    openModal({
      title: 'New folder in ' + activeCab.name,
      body: (
        <div className="field">
          <label>Name</label>
          <input
            className="input"
            placeholder="Folder name"
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
            if (!name.trim()) return;
            const newFolders = [
              ...(activeCab.folders || []),
              { id: 'f-' + Date.now(), name: name.trim() },
            ];
            updateCabinet.mutate(
              { id: activeCab.id, updates: { folders: newFolders } },
              {
                onSuccess: () => {
                  auditAction('FOLDER_CREATE', activeCab.id, 'Added folder ' + name);
                  closeModal();
                },
              },
            );
          },
        },
      ],
    });
  };

  const handleDeleteFolder = (f: any) => {
    const docs = documents.filter((d: any) => d.folderId === f.id).length;
    if (docs > 0) {
      addToast('Folder contains documents — move them first', 'error');
      return;
    }
    openConfirm({
      title: `Delete folder "${f.name}"?`,
      message: 'The folder is empty and will be removed from the cabinet structure.',
      confirmLabel: 'Delete folder',
      danger: true,
      onConfirm: () => {
        const newFolders = activeCab.folders.filter((x: any) => x.id !== f.id);
        updateCabinet.mutate(
          { id: activeCab.id, updates: { folders: newFolders } },
          {
            onSuccess: () => {
              auditAction('FOLDER_DELETE', activeCab.id, 'Deleted ' + f.name);
            },
          },
        );
      },
    });
  };

  const handleNewField = () => {
    let fn = '';
    let ft = 'Text';
    let rq = false;
    openModal({
      title: 'Add metadata field',
      body: (
        <div>
          <div className="field">
            <label>Field name</label>
            <input
              className="input"
              placeholder="Field name"
              onChange={(e) => (fn = e.target.value)}
            />
          </div>
          <div className="field">
            <label>Type</label>
            <select className="input" defaultValue={ft} onChange={(e) => (ft = e.target.value)}>
              {['Text', 'Number', 'Date', 'Select', 'Reference'].map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
          </div>
          <label className="check">
            <input type="checkbox" defaultChecked={rq} onChange={(e) => (rq = e.target.checked)} />{' '}
            Required at filing
          </label>
        </div>
      ),
      actions: [
        { label: 'Cancel' },
        {
          label: 'Add field',
          kind: 'btn-primary',
          onClick: () => {
            if (!fn.trim()) return;
            const cabSchema = schema[activeCab.id] || [];
            setSchema((s) => ({
              ...s,
              [activeCab.id]: [...cabSchema, { f: fn.trim(), t: ft, req: rq }],
            }));
            auditAction('SCHEMA_EDIT', activeCab.id, 'Added field ' + fn);
            addToast('Field added to schema', 'success');
            closeModal();
          },
        },
      ],
    });
  };

  const activeSchema = schema[activeCab.id] || [];
  const schemaCols: Column<any>[] = [
    { key: 'f', label: 'Field', render: (r) => <b>{r.f}</b> },
    { key: 't', label: 'Type' },
    {
      key: 'req',
      label: 'Required',
      render: (r) =>
        r.req ? (
          <span className="badge b-status-overdue">Required</span>
        ) : (
          <span className="badge b-urg-low">Optional</span>
        ),
    },
    {
      key: 'act',
      label: '',
      render: (r) => (
        <button
          className="btn btn-ghost btn-sm"
          onClick={() => {
            setSchema((s) => ({
              ...s,
              [activeCab.id]: s[activeCab.id].filter((x: any) => x !== r),
            }));
            addToast('Field removed', 'info');
          }}
        >
          Remove
        </button>
      ),
    },
  ];

  return (
    <div>
      <div className="page-head">
        <div>
          <div className="page-title">Cabinet Designer</div>
          <div className="page-sub">Structure builder and metadata schema editor per cabinet.</div>
        </div>
      </div>

      <div className="cab-layout" style={{ display: 'flex', gap: '16px' }}>
        <div className="card tree" style={{ width: '220px', flexShrink: 0 }}>
          {cabinets?.map((c: any) => (
            <div
              key={c.id}
              className={`tree-item ${activeCabIdToUse === c.id ? 'active' : ''}`}
              onClick={() => setActiveCabId(c.id)}
            >
              <span style={{ display: 'inline-flex', alignItems: 'center', marginRight: '8px' }}>
                <Icon name="cabinet" size={15} />
              </span>
              {c.name}
            </div>
          ))}
          <button
            className="btn btn-secondary btn-sm"
            style={{ margin: '10px' }}
            onClick={handleNewCabinet}
          >
            + New cabinet
          </button>
        </div>

        <div style={{ flexGrow: 1 }}>
          <div className="card mb16">
            <div className="card-head">
              <span className="h3">{activeCab.name} — structure</span>
              <button className="btn btn-secondary btn-sm" onClick={handleNewFolder}>
                + Folder
              </button>
            </div>
            <div className="card-body" style={{ paddingTop: '6px' }}>
              {activeCab.folders?.map((f: any) => (
                <div key={f.id} className="metric-li">
                  <span className="flex aic g8">
                    <span style={{ display: 'inline-flex', alignItems: 'center' }}>
                      <Icon name="folder" size={14} />
                    </span>
                    {f.name}
                  </span>
                  <span className="flex aic g8">
                    <span className="caption">
                      {
                        documents?.filter((d: any) => d.folderId === f.id || d.folder === f.id)
                          .length
                      }{' '}
                      docs
                    </span>
                    <button className="btn btn-ghost btn-sm" onClick={() => handleDeleteFolder(f)}>
                      Delete
                    </button>
                  </span>
                </div>
              ))}
            </div>
          </div>

          <div className="card">
            <div className="card-head">
              <span className="h3">Metadata schema</span>
              <button className="btn btn-secondary btn-sm" onClick={handleNewField}>
                + Field
              </button>
            </div>
            <Table
              cols={schemaCols}
              rows={activeSchema}
              emptyMsg="No custom fields yet — add the first one."
            />
          </div>
        </div>
      </div>
    </div>
  );
}
