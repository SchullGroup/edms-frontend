'use client';

import React, { useState, useEffect } from 'react';
import { useStore } from '@/store/useStore';
import { useUIStore } from '@/store/useUIStore';
import { Table, Column } from '@/components/ui/Table';
import { Icon } from '@/components/ui/Icons';
import {
  useCabinets,
  useCabinet,
  useCreateCabinet,
  useUpdateCabinet,
  useDeleteCabinet,
  useAddMetadataField,
  useDeleteMetadataField,
  useCabinetAccessGrants,
  useGrantCabinetAccess,
  useRevokeCabinetAccess,
} from '@/apis/hooks/useCabinets';
import { useCabinetFolders, useCreateFolder, useDeleteFolder } from '@/apis/hooks/useFolders';
import { useDocuments } from '@/apis/hooks/useDocuments';
import { useDepartments } from '@/apis/hooks/useDepartments';
import { useRoles } from '@/apis/hooks/useRoles';
import { useAllUsers } from '@/apis/hooks/useUsers';
import { Spinner } from '@/components/common/Spinner';
import { ErrorMessage } from '@/components/common/ErrorMessage';
import { CabinetAccessPermission } from '@/types/models';

const FIELD_TYPES: { value: 'text' | 'number' | 'date' | 'select' | 'boolean'; label: string }[] = [
  { value: 'text', label: 'Text' },
  { value: 'number', label: 'Number' },
  { value: 'date', label: 'Date' },
  { value: 'select', label: 'Select' },
  { value: 'boolean', label: 'Boolean' },
];

const ACCESS_PERMISSIONS: { value: CabinetAccessPermission; label: string }[] = [
  { value: 'view', label: 'View' },
  { value: 'upload', label: 'Upload' },
  { value: 'edit', label: 'Edit' },
  { value: 'route', label: 'Route' },
  { value: 'export', label: 'Export' },
  { value: 'delete', label: 'Delete' },
];

export default function CabinetDesignerPage() {
  const { auditAction } = useStore();
  const { setPageTitle, openModal, closeModal, openConfirm, addToast } = useUIStore();

  const { data: cabinetsResponse, isLoading, isError, refetch } = useCabinets();
  const { data: documentsData } = useDocuments();
  const { data: departmentsData } = useDepartments();
  const createCabinet = useCreateCabinet();
  const updateCabinet = useUpdateCabinet();
  const deleteCabinet = useDeleteCabinet();

  const cabinets = cabinetsResponse?.data || [];
  const documents = documentsData?.data || [];
  const departments = departmentsData?.data || [];

  const [activeCabId, setActiveCabId] = useState<string | undefined>(undefined);
  const activeCabIdToUse = activeCabId || cabinets?.[0]?.id;
  const activeCab = cabinets?.find((c: any) => c.id === activeCabIdToUse) || cabinets?.[0];

  const { data: folData, isLoading: isLoadingFolders } = useCabinetFolders(activeCab?.id);
  const activeCabFolders = folData?.data || [];
  const createFolder = useCreateFolder();
  const deleteFolder = useDeleteFolder();

  // `metadataFields` only comes back on the single-cabinet GET, not the list.
  const { data: activeCabDetail } = useCabinet(activeCab?.id);
  const activeSchema = activeCabDetail?.metadataFields || [];
  const addMetadataField = useAddMetadataField();
  const deleteMetadataField = useDeleteMetadataField();

  // Access grants for the selected cabinet.
  const { data: accessGrants = [], isLoading: isLoadingAccess } = useCabinetAccessGrants(
    activeCab?.id,
  );
  const grantAccess = useGrantCabinetAccess();
  const revokeAccess = useRevokeCabinetAccess();

  const { data: roles = [] } = useRoles();
  const { data: usersResult } = useAllUsers();
  const users = usersResult?.items || [];

  useEffect(() => {
    setPageTitle('Cabinet Designer');
  }, [setPageTitle]);

  if (isLoading) return <Spinner text="Loading cabinets..." />;
  if (isError) return <ErrorMessage message="Failed to load cabinets." retry={refetch} />;
  if (!activeCab) return <div style={{ padding: '20px' }}>No cabinets found.</div>;

  const flatDepartments: { id: string; name: string; depth: number }[] = [];
  const pushDept = (list: any[], depth: number) => {
    for (const d of list) {
      flatDepartments.push({ id: d.id, name: d.name, depth });
      if (d.children?.length) pushDept(d.children, depth + 1);
    }
  };
  pushDept(departments, 0);

  const departmentLabel = (id?: string | null) =>
    flatDepartments.find((d) => d.id === id)?.name ?? null;

  const handleNewCabinet = () => {
    const form = { name: '', description: '', departmentId: '' };
    openModal({
      title: 'New cabinet',
      body: (
        <div className="grid" style={{ gap: '12px' }}>
          <div className="field">
            <label>
              Cabinet name <span className="req">*</span>
            </label>
            <input
              className="input"
              placeholder="e.g. Compliance"
              maxLength={200}
              onChange={(e) => (form.name = e.target.value)}
            />
          </div>
          <div className="field">
            <label>Description</label>
            <input
              className="input"
              placeholder="Optional"
              maxLength={1000}
              onChange={(e) => (form.description = e.target.value)}
            />
          </div>
          <div className="field">
            <label>Department</label>
            <select
              className="input"
              defaultValue=""
              onChange={(e) => (form.departmentId = e.target.value)}
            >
              <option value="">— Unassigned —</option>
              {flatDepartments.map((d) => (
                <option key={d.id} value={d.id}>
                  {'  '.repeat(d.depth) + d.name}
                </option>
              ))}
            </select>
          </div>
        </div>
      ),
      actions: [
        { label: 'Cancel' },
        {
          label: 'Create',
          kind: 'btn-primary',
          onClick: () => {
            const name = form.name.trim();
            if (!name) {
              addToast('Cabinet name is required', 'error');
              return false;
            }
            return createCabinet
              .mutateAsync({
                name,
                description: form.description.trim() || undefined,
                departmentId: form.departmentId || undefined,
              })
              .then((newCab) => {
                auditAction('CABINET_CREATE', newCab.id, 'Created cabinet ' + name);
                setActiveCabId(newCab.id);
                closeModal();
                createFolder.mutate({ cabinetId: newCab.id, data: { name: 'General' } });
              })
              .catch(() => false);
          },
        },
      ],
    });
  };

  const handleEditCabinet = () => {
    const form = {
      name: activeCab.name,
      description: activeCab.description ?? '',
      departmentId: activeCab.departmentId ?? '',
    };
    openModal({
      title: `Edit cabinet — ${activeCab.name}`,
      body: (
        <div className="grid" style={{ gap: '12px' }}>
          <div className="field">
            <label>
              Cabinet name <span className="req">*</span>
            </label>
            <input
              className="input"
              defaultValue={form.name}
              maxLength={200}
              onChange={(e) => (form.name = e.target.value)}
            />
          </div>
          <div className="field">
            <label>Description</label>
            <input
              className="input"
              defaultValue={form.description}
              maxLength={1000}
              onChange={(e) => (form.description = e.target.value)}
            />
          </div>
          <div className="field">
            <label>Department</label>
            <select
              className="input"
              defaultValue={form.departmentId}
              onChange={(e) => (form.departmentId = e.target.value)}
            >
              <option value="">— Unassigned —</option>
              {flatDepartments.map((d) => (
                <option key={d.id} value={d.id}>
                  {'  '.repeat(d.depth) + d.name}
                </option>
              ))}
            </select>
          </div>
        </div>
      ),
      actions: [
        { label: 'Cancel' },
        {
          label: 'Save',
          kind: 'btn-primary',
          onClick: () => {
            const name = form.name.trim();
            if (!name) {
              addToast('Cabinet name is required', 'error');
              return false;
            }
            return updateCabinet
              .mutateAsync({
                id: activeCab.id,
                updates: {
                  name,
                  description: form.description.trim(),
                  departmentId: form.departmentId || null,
                },
              })
              .then(() => {
                auditAction('CABINET_EDIT', activeCab.id, 'Updated cabinet ' + name);
                closeModal();
              })
              .catch(() => false);
          },
        },
      ],
    });
  };

  const docsInCabinet =
    activeCab._count?.documents ??
    documents.filter((d: any) => d.cabinetId === activeCab.id).length;
  const foldersInCabinet = activeCab._count?.folders ?? activeCabFolders.length;
  const cabinetIsEmpty = docsInCabinet === 0 && foldersInCabinet === 0;

  const handleDeleteCabinet = () => {
    if (!cabinetIsEmpty) {
      openModal({
        title: `Can't delete "${activeCab.name}"`,
        body: (
          <div>
            <p style={{ lineHeight: 1.6 }}>
              This cabinet still has{' '}
              <b>
                {docsInCabinet} document{docsInCabinet === 1 ? '' : 's'}
              </b>{' '}
              and{' '}
              <b>
                {foldersInCabinet} folder{foldersInCabinet === 1 ? '' : 's'}
              </b>
              . Move or delete everything inside it first, then try again.
            </p>
          </div>
        ),
        actions: [{ label: 'Close', kind: 'btn-primary' }],
      });
      return;
    }
    openConfirm({
      title: `Delete "${activeCab.name}"?`,
      message:
        'The cabinet is empty and will be permanently removed, along with its metadata schema and access grants. This cannot be undone.',
      confirmLabel: 'Delete cabinet',
      danger: true,
      onConfirm: () =>
        deleteCabinet
          .mutateAsync(activeCab.id)
          .then(() => {
            auditAction('CABINET_DELETE', activeCab.id, 'Deleted cabinet ' + activeCab.name);
            setActiveCabId(undefined);
          })
          .catch(() => {
            /* hook surfaces the 409 / error toast */
          }),
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
            createFolder.mutate(
              { cabinetId: activeCab.id, data: { name: name.trim() } },
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
        deleteFolder.mutate(
          { id: f.id, cabinetId: activeCab.id },
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
    let ft: 'text' | 'number' | 'date' | 'select' | 'boolean' = 'text';
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
            <select
              className="input"
              defaultValue={ft}
              onChange={(e) => (ft = e.target.value as typeof ft)}
            >
              {FIELD_TYPES.map((t) => (
                <option key={t.value} value={t.value}>
                  {t.label}
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
            addMetadataField.mutate(
              {
                cabinetId: activeCab.id,
                data: {
                  name: fn.trim(),
                  fieldType: ft,
                  isRequired: rq,
                  displayOrder: activeSchema.length,
                },
              },
              {
                onSuccess: () => {
                  auditAction('SCHEMA_EDIT', activeCab.id, 'Added field ' + fn);
                  closeModal();
                },
              },
            );
          },
        },
      ],
    });
  };

  const handleGrantAccess = () => {
    const form: {
      permission: CabinetAccessPermission;
      targetType: 'role' | 'user';
      roleId: string;
      userId: string;
    } = {
      permission: 'view',
      targetType: 'role',
      roleId: roles[0]?.id ?? '',
      userId: users[0]?.id ?? '',
    };

    const Body = () => {
      const [targetType, setTargetType] = useState<'role' | 'user'>(form.targetType);
      return (
        <div className="grid" style={{ gap: '12px' }}>
          <div className="field">
            <label>Permission</label>
            <select
              className="input"
              defaultValue={form.permission}
              onChange={(e) => (form.permission = e.target.value as CabinetAccessPermission)}
            >
              {ACCESS_PERMISSIONS.map((p) => (
                <option key={p.value} value={p.value}>
                  {p.label}
                </option>
              ))}
            </select>
          </div>
          <div className="field">
            <label>Grant to</label>
            <select
              className="input"
              value={targetType}
              onChange={(e) => {
                const v = e.target.value as 'role' | 'user';
                setTargetType(v);
                form.targetType = v;
              }}
            >
              <option value="role">A role</option>
              <option value="user">A specific user</option>
            </select>
          </div>
          {targetType === 'role' ? (
            <div className="field">
              <label>Role</label>
              <select
                className="input capitalize"
                defaultValue={form.roleId}
                onChange={(e) => (form.roleId = e.target.value)}
              >
                {roles.map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.name.replace(/_/g, ' ')}
                  </option>
                ))}
              </select>
            </div>
          ) : (
            <div className="field">
              <label>User</label>
              <select
                className="input"
                defaultValue={form.userId}
                onChange={(e) => (form.userId = e.target.value)}
              >
                {users.map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.name} — {u.email}
                  </option>
                ))}
              </select>
            </div>
          )}
        </div>
      );
    };

    openModal({
      title: `Grant access — ${activeCab.name}`,
      body: <Body />,
      actions: [
        { label: 'Cancel' },
        {
          label: 'Grant access',
          kind: 'btn-primary',
          onClick: () => {
            const target =
              form.targetType === 'role'
                ? { roleId: form.roleId }
                : { userId: form.userId };
            if (!target.roleId && !target.userId) {
              addToast(`Select a ${form.targetType} first`, 'error');
              return false;
            }
            return grantAccess
              .mutateAsync({
                cabinetId: activeCab.id,
                data: { permission: form.permission, ...target },
              })
              .then(() => {
                auditAction(
                  'CABINET_ACCESS_GRANT',
                  activeCab.id,
                  `Granted ${form.permission} to ${form.targetType}`,
                );
                closeModal();
              })
              .catch(() => false);
          },
        },
      ],
    });
  };

  const grantTargetLabel = (g: any) => {
    if (g.role?.name) return `Role: ${g.role.name.replace(/_/g, ' ')}`;
    if (g.roleId) return `Role: ${roles.find((r) => r.id === g.roleId)?.name ?? g.roleId}`;
    if (g.user?.name) return `User: ${g.user.name}`;
    if (g.userId) {
      const u = users.find((x) => x.id === g.userId);
      return `User: ${u ? u.name : g.userId}`;
    }
    return '—';
  };

  const handleRevokeAccess = (g: any) => {
    openConfirm({
      title: 'Revoke this access grant?',
      message: `${grantTargetLabel(g)} will lose "${g.permission}" access to ${activeCab.name}.`,
      confirmLabel: 'Revoke',
      danger: true,
      onConfirm: () =>
        revokeAccess
          .mutateAsync({ cabinetId: activeCab.id, grantId: g.id })
          .then(() => {
            auditAction('CABINET_ACCESS_REVOKE', activeCab.id, `Revoked ${g.permission}`);
          })
          .catch(() => {}),
    });
  };

  const fieldTypeLabel = (t: string) => FIELD_TYPES.find((f) => f.value === t)?.label || t;

  const schemaCols: Column<any>[] = [
    { key: 'name', label: 'Field', render: (r) => <b>{r.name}</b> },
    { key: 'fieldType', label: 'Type', render: (r) => fieldTypeLabel(r.fieldType) },
    {
      key: 'isRequired',
      label: 'Required',
      render: (r) =>
        r.isRequired ? (
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
            deleteMetadataField.mutate(
              { cabinetId: activeCab.id, fieldId: r.id },
              {
                onSuccess: () => {
                  auditAction('SCHEMA_EDIT', activeCab.id, 'Removed field ' + r.name);
                },
              },
            );
          }}
        >
          Remove
        </button>
      ),
    },
  ];

  const accessCols: Column<any>[] = [
    { key: 'target', label: 'Grantee', render: (g) => <b>{grantTargetLabel(g)}</b> },
    {
      key: 'permission',
      label: 'Permission',
      render: (g) => <span className="badge b-urg-low">{g.permission}</span>,
    },
    {
      key: 'act',
      label: '',
      render: (g) => (
        <button className="btn btn-ghost btn-sm" onClick={() => handleRevokeAccess(g)}>
          Revoke
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
              <span className="h3">
                {activeCab.name}
                {departmentLabel(activeCab.departmentId) && (
                  <span className="caption" style={{ marginLeft: '8px' }}>
                    · {departmentLabel(activeCab.departmentId)}
                  </span>
                )}
              </span>
              <span className="flex aic g8">
                <button className="btn btn-secondary btn-sm" onClick={handleEditCabinet}>
                  Edit
                </button>
                <button className="btn btn-ghost btn-sm" onClick={handleDeleteCabinet}>
                  Delete cabinet
                </button>
              </span>
            </div>
            <div className="card-body caption" style={{ paddingTop: '6px' }}>
              {activeCab.description || 'No description.'} · {docsInCabinet} docs ·{' '}
              {foldersInCabinet} folders
            </div>
          </div>

          <div className="card mb16">
            <div className="card-head">
              <span className="h3">{activeCab.name} — structure</span>
              <button className="btn btn-secondary btn-sm" onClick={handleNewFolder}>
                + Folder
              </button>
            </div>
            <div className="card-body" style={{ paddingTop: '6px' }}>
              {isLoadingFolders ? (
                <div className="caption" style={{ padding: '12px 0' }}>
                  Loading folders....
                </div>
              ) : (
                <>
                  {activeCabFolders?.map((f: any) => (
                    <div key={f.id} className="metric-li">
                      <span className="flex aic g8">
                        <span style={{ display: 'inline-flex', alignItems: 'center' }}>
                          <Icon name="folder" size={14} />
                        </span>
                        {f.name}
                      </span>
                      <span className="flex aic g8">
                        <span className="caption">
                          {documents?.filter((d: any) => d.folderId === f.id).length} docs
                        </span>
                        <button
                          className="btn btn-ghost btn-sm"
                          onClick={() => handleDeleteFolder(f)}
                        >
                          Delete
                        </button>
                      </span>
                    </div>
                  ))}
                  {activeCabFolders?.length === 0 && (
                    <div className="empty-state">No folders created yet.</div>
                  )}
                </>
              )}
            </div>
          </div>

          <div className="card mb16">
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

          <div className="card">
            <div className="card-head">
              <span className="h3">Access</span>
              <button className="btn btn-secondary btn-sm" onClick={handleGrantAccess}>
                + Grant access
              </button>
            </div>
            {isLoadingAccess ? (
              <div className="caption" style={{ padding: '12px 16px' }}>
                Loading access grants....
              </div>
            ) : (
              <Table
                cols={accessCols}
                rows={accessGrants}
                emptyMsg="No explicit grants — only roles with cabinet permissions can see this cabinet."
              />
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
