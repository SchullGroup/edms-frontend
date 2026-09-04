'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { useQueryClient } from '@tanstack/react-query';
import { useStore } from '@/store/useStore';
import { useUIStore } from '@/store/useUIStore';
import { Table, Column } from '@/components/ui/Table';
import { Pagination } from '@/components/ui/Pagination';
import { Icon } from '@/components/ui/Icons';
import { Combobox } from '@/components/ui/Combobox';
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
import { useDocuments, useDocument } from '@/apis/hooks/useDocuments';
import { documentsService } from '@/apis/services/documents.service';
import { useDepartments } from '@/apis/hooks/useDepartments';
import { useRoles } from '@/apis/hooks/useRoles';
import { useAllUsers, useUser } from '@/apis/hooks/useUsers';
import { Skeleton, SkeletonTable, SkeletonTreeRows } from '@/components/common/Skeleton';
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
  const router = useRouter();
  const queryClient = useQueryClient();
  const { auditAction, currentUser } = useStore();
  const { setPageTitle, openModal, closeModal, openConfirm, addToast } = useUIStore();

  const { data: cabinetsResponse, isLoading, isError, refetch } = useCabinets();
  const { data: departmentsData } = useDepartments();
  const createCabinet = useCreateCabinet();
  const updateCabinet = useUpdateCabinet();
  const deleteCabinet = useDeleteCabinet();

  const allCabinets = cabinetsResponse?.data || [];
  const departments = departmentsData?.data || [];

  // Admins see every cabinet. Everyone else sees only cabinets scoped to their
  // own department, plus "general" cabinets that aren't scoped to any (departmentId null).
  const roleNames = (currentUser?.roles || []).map((r: any) =>
    typeof r === 'string' ? r : r?.name,
  );
  const isAdmin = roleNames.some((r) => r === 'client_admin' || r === 'schulltech_admin');
  const { data: me } = useUser(currentUser?.id || '');
  const myDepartmentId = me?.departmentId ?? null;

  const cabinets = useMemo(
    () =>
      isAdmin
        ? allCabinets
        : allCabinets.filter((c: any) => !c.departmentId || c.departmentId === myDepartmentId),
    [allCabinets, isAdmin, myDepartmentId],
  );

  const [activeCabId, setActiveCabId] = useState<string | undefined>(undefined);
  const [openFolderId, setOpenFolderId] = useState<string | null>(null);
  const [cabFilter, setCabFilter] = useState('');
  const [folderFilter, setFolderFilter] = useState('');
  const activeCabIdToUse = activeCabId || cabinets?.[0]?.id;
  const activeCab = cabinets?.find((c: any) => c.id === activeCabIdToUse) || cabinets?.[0];

  const { data: folData, isLoading: isLoadingFolders } = useCabinetFolders(activeCab?.id);
  const activeCabFolders = folData?.data || [];
  const createFolder = useCreateFolder();
  const deleteFolder = useDeleteFolder();

  // `metadataFields` only comes back on the single-cabinet GET, not the list.
  const { data: activeCabDetail, isLoading: isLoadingSchema } = useCabinet(activeCab?.id);
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

  useEffect(() => {
    setOpenFolderId(null);
    setFolderFilter('');
  }, [activeCab?.id]);

  // Both lists come back from the API in one unpaginated response (confirmed:
  // no `pagination` key on either), so filtering client-side is a plain array
  // filter, not a stopgap around missing server support.
  const filteredCabinets = cabinets.filter((c: any) =>
    c.name.toLowerCase().includes(cabFilter.trim().toLowerCase()),
  );
  const filteredCabFolders = activeCabFolders.filter((f: any) =>
    f.name.toLowerCase().includes(folderFilter.trim().toLowerCase()),
  );

  if (isLoading) return <CabinetDesignerSkeleton />;
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
    activeCabFolders.reduce((sum: number, f: any) => sum + (f._count?.documents ?? 0), 0);
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
    const docs = f._count?.documents ?? 0;
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
    const roleOptions = roles.map((r) => ({ value: r.id, label: r.name.replace(/_/g, ' ') }));
    const userOptions = users.map((u) => ({ value: u.id, label: u.name, hint: u.email }));

    const form: {
      permission: CabinetAccessPermission;
      targetType: 'role' | 'user';
      roleIds: string[];
      userIds: string[];
    } = {
      permission: 'view',
      targetType: 'role',
      roleIds: [],
      userIds: [],
    };

    const Body = () => {
      const [targetType, setTargetType] = useState<'role' | 'user'>(form.targetType);
      const [roleIds, setRoleIds] = useState<string[]>(form.roleIds);
      const [userIds, setUserIds] = useState<string[]>(form.userIds);
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
              <option value="role">Roles</option>
              <option value="user">Specific users</option>
            </select>
          </div>
          <div className="field">
            <label>{targetType === 'role' ? 'Roles' : 'Users'}</label>
            <Combobox
              multiple
              options={targetType === 'role' ? roleOptions : userOptions}
              value={targetType === 'role' ? roleIds : userIds}
              onChange={(v) => {
                const arr = v as string[];
                if (targetType === 'role') {
                  setRoleIds(arr);
                  form.roleIds = arr;
                } else {
                  setUserIds(arr);
                  form.userIds = arr;
                }
              }}
              placeholder={targetType === 'role' ? 'Select roles…' : 'Select users…'}
              searchPlaceholder={targetType === 'role' ? 'Search roles…' : 'Search users…'}
            />
            <div className="help">
              The API grants to one {targetType} per call — picking several sends a request for
              each.
            </div>
          </div>
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
            const ids = form.targetType === 'role' ? form.roleIds : form.userIds;
            if (ids.length === 0) {
              addToast(`Select at least one ${form.targetType}`, 'error');
              return false;
            }
            return Promise.all(
              ids.map((id) =>
                grantAccess.mutateAsync({
                  cabinetId: activeCab.id,
                  data: {
                    permission: form.permission,
                    ...(form.targetType === 'role' ? { roleId: id } : { userId: id }),
                  },
                }),
              ),
            )
              .then(() => {
                auditAction(
                  'CABINET_ACCESS_GRANT',
                  activeCab.id,
                  `Granted ${form.permission} to ${ids.length} ${form.targetType}${
                    ids.length === 1 ? '' : 's'
                  }`,
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

  const handleOpenDocument = (doc: any) => {
    openModal({
      title: doc.title,
      size: 'xl',
      body: <DocumentPreviewBody documentId={doc.id} />,
      actions: [
        { label: 'Close' },
        {
          label: 'Open full page',
          kind: 'btn-secondary',
          onClick: () => {
            router.push(`/doc/${doc.id}`);
          },
        },
      ],
    });
  };

  const handleMoveDocument = (doc: any) => {
    let dest = { cabinetId: activeCab.id, folderId: '' };
    openModal({
      title: `Move “${doc.title}”`,
      body: (
        <MoveDocumentModalBody
          cabinets={cabinets}
          defaultCabinetId={activeCab.id}
          onChange={(cabinetId, folderId) => (dest = { cabinetId, folderId })}
        />
      ),
      actions: [
        { label: 'Cancel' },
        {
          label: 'Move',
          kind: 'btn-primary',
          onClick: () =>
            documentsService
              .update(doc.id, { cabinetId: dest.cabinetId, folderId: dest.folderId || undefined })
              .then(() => {
                auditAction('DOCUMENT_MOVE', doc.id, `Moved “${doc.title}”`);
                // Both endpoints embed `_count.documents`, which is what the
                // folder tree and delete guard read — stale counts here would
                // reintroduce the exact bug this button exists to avoid.
                queryClient.invalidateQueries({ queryKey: ['cabinets'] });
                queryClient.invalidateQueries({ queryKey: ['folders'] });
                queryClient.invalidateQueries({ queryKey: ['documents'] });
                addToast('Document moved', 'success');
              })
              .catch((err: any) => {
                addToast(err.response?.data?.message || 'Failed to move document', 'error');
                return false;
              }),
        },
      ],
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
        <div
          className="card tree"
          style={{ width: '300px', flexShrink: 0, padding: 0, display: 'flex', flexDirection: 'column' }}
        >
          {cabinets.length > 8 && (
            <div style={{ padding: '10px 10px 0' }}>
              <input
                className="input"
                type="search"
                placeholder={`Filter ${cabinets.length} cabinets…`}
                value={cabFilter}
                onChange={(e) => setCabFilter(e.target.value)}
                aria-label="Filter cabinets"
              />
            </div>
          )}
          <div style={{ overflowY: 'auto', maxHeight: '440px', padding: '10px' }}>
            {filteredCabinets.map((c: any) => (
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
            {filteredCabinets.length === 0 && (
              <div className="caption" style={{ padding: '8px 11px' }}>
                No cabinets match “{cabFilter}”.
              </div>
            )}
          </div>
          <button
            className="btn btn-secondary btn-sm"
            style={{ margin: '10px' }}
            onClick={handleNewCabinet}
          >
            + New cabinet
          </button>
        </div>

        <div className="min-w-0" style={{ flexGrow: 1 }}>
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
                <SkeletonTreeRows rows={4} />
              ) : (
                <>
                  {activeCabFolders.length > 8 && (
                    <input
                      className="input mb8"
                      type="search"
                      placeholder={`Filter ${activeCabFolders.length} folders…`}
                      value={folderFilter}
                      onChange={(e) => setFolderFilter(e.target.value)}
                      aria-label="Filter folders"
                    />
                  )}
                  <div style={{ maxHeight: '480px', overflowY: 'auto' }}>
                    {filteredCabFolders.map((f: any) => (
                      <div key={f.id}>
                        <div
                          className="metric-li"
                          style={{ cursor: 'pointer' }}
                          onClick={() => setOpenFolderId((cur) => (cur === f.id ? null : f.id))}
                        >
                          <span className="flex aic g8">
                            <span
                              style={{
                                display: 'inline-flex',
                                alignItems: 'center',
                                color: 'var(--muted)',
                                transform: openFolderId === f.id ? 'rotate(90deg)' : 'none',
                                transition: 'transform .12s',
                              }}
                            >
                              <Icon name="chevR" size={12} />
                            </span>
                            <span style={{ display: 'inline-flex', alignItems: 'center' }}>
                              <Icon name="folder" size={14} />
                            </span>
                            {f.name}
                          </span>
                          <span className="flex aic g8">
                            <span className="caption">{f._count?.documents ?? 0} docs</span>
                            <button
                              className="btn btn-ghost btn-sm"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleDeleteFolder(f);
                              }}
                            >
                              Delete
                            </button>
                          </span>
                        </div>
                        {openFolderId === f.id && (
                          <FolderDocuments
                            cabinetId={activeCab.id}
                            folderId={f.id}
                            onOpenDocument={handleOpenDocument}
                            onMoveDocument={handleMoveDocument}
                          />
                        )}
                      </div>
                    ))}
                    {activeCabFolders.length === 0 && (
                      <div className="empty-state">No folders created yet.</div>
                    )}
                    {activeCabFolders.length > 0 && filteredCabFolders.length === 0 && (
                      <div className="caption" style={{ padding: '8px 0' }}>
                        No folders match “{folderFilter}”.
                      </div>
                    )}
                  </div>
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
            {isLoadingSchema ? (
              <SkeletonTable columns={['Field', 'Type', 'Required', '']} rows={3} />
            ) : (
              <Table
                cols={schemaCols}
                rows={activeSchema}
                emptyMsg="No custom fields yet — add the first one."
              />
            )}
          </div>

          <div className="card">
            <div className="card-head">
              <span className="h3">Access</span>
              <button className="btn btn-secondary btn-sm" onClick={handleGrantAccess}>
                + Grant access
              </button>
            </div>
            {isLoadingAccess ? (
              <SkeletonTable columns={['Grantee', 'Permission', '']} rows={3} />
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

const FOLDER_DOCS_PAGE_SIZE = 20;

/**
 * Documents inside one folder. Kept as its own component so the
 * `useDocuments({ folderId })` query only runs while the folder is expanded
 * (and unmounts when it collapses), rather than one query per folder always —
 * which also resets `page` back to 1 the next time it's opened, for free.
 *
 * `/documents` is genuinely paginated server-side (unlike cabinets/folders),
 * so a folder with 50+ files needs real page controls here, not a truncated
 * single fetch.
 */
function FolderDocuments({
  cabinetId,
  folderId,
  onOpenDocument,
  onMoveDocument,
}: {
  cabinetId: string;
  folderId: string;
  onOpenDocument: (doc: any) => void;
  onMoveDocument: (doc: any) => void;
}) {
  const [page, setPage] = useState(1);
  const { data, isLoading } = useDocuments({
    cabinetId,
    folderId,
    page,
    limit: FOLDER_DOCS_PAGE_SIZE,
  });
  const docs = data?.data || [];
  const pagination = data?.pagination;

  if (isLoading) {
    return (
      <div className="caption" style={{ padding: '8px 0 8px 34px' }}>
        Loading documents…
      </div>
    );
  }
  if (docs.length === 0) {
    return (
      <div className="caption" style={{ padding: '8px 0 8px 34px' }}>
        No documents in this folder.
      </div>
    );
  }
  return (
    <div style={{ padding: '2px 0 4px 34px' }}>
      {docs.map((d: any) => (
        <div
          key={d.id}
          className="metric-li"
          style={{ cursor: 'pointer' }}
          onClick={() => onOpenDocument(d)}
        >
          <span className="flex aic g8">
            <span style={{ display: 'inline-flex', alignItems: 'center' }}>
              <Icon name="doc" size={14} />
            </span>
            {d.title}
          </span>
          <span className="flex aic g8">
            <span className="caption">
              {d.confidentiality} · v{d.currentVersion?.versionNumber ?? 1}
            </span>
            <button
              className="btn btn-ghost btn-sm"
              onClick={(e) => {
                e.stopPropagation();
                onMoveDocument(d);
              }}
            >
              Move
            </button>
          </span>
        </div>
      ))}
      {pagination && pagination.totalPages > 1 && (
        <div style={{ marginRight: '-20px' }}>
          <Pagination
            page={pagination.page}
            totalPages={pagination.totalPages}
            total={pagination.total}
            limit={pagination.limit}
            onPageChange={setPage}
          />
        </div>
      )}
    </div>
  );
}

/**
 * Cabinet/folder picker for relocating one document — the Designer's answer
 * to the folder-delete guard's "move them first" message, which otherwise had
 * no in-page way to act on it (the only other Move UI lives on
 * `/staff/cabinets`, and only as a bulk action over a document table).
 */
function MoveDocumentModalBody({
  cabinets,
  defaultCabinetId,
  onChange,
}: {
  cabinets: { id: string; name: string }[];
  defaultCabinetId: string;
  onChange: (cabinetId: string, folderId: string) => void;
}) {
  const [selCab, setSelCab] = useState(defaultCabinetId);
  const [selFol, setSelFol] = useState('');
  const { data: folData, isLoading: isLoadingFolders } = useCabinetFolders(selCab);
  const folders = folData?.data || [];

  return (
    <div className="grid" style={{ gap: '12px' }}>
      <div className="field">
        <label>Destination cabinet</label>
        <select
          className="input"
          value={selCab}
          onChange={(e) => {
            setSelCab(e.target.value);
            setSelFol('');
            onChange(e.target.value, '');
          }}
        >
          {cabinets.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
      </div>
      <div className="field">
        <label>Destination folder</label>
        <select
          className="input"
          value={selFol}
          disabled={isLoadingFolders}
          onChange={(e) => {
            setSelFol(e.target.value);
            onChange(selCab, e.target.value);
          }}
        >
          <option value="">— No folder —</option>
          {folders.map((f) => (
            <option key={f.id} value={f.id}>
              {f.name}
            </option>
          ))}
        </select>
      </div>
    </div>
  );
}

/** Inline file preview for the "open a document" modal. */
function DocumentPreviewBody({ documentId }: { documentId: string }) {
  const { data: doc, isLoading } = useDocument(documentId);

  if (isLoading) return <div className="caption">Loading document…</div>;
  if (!doc) return <div className="caption">Document not found.</div>;

  // Same handling as the full document page: prefer the backend's pre-signed
  // URL, and fall back to `fileKey` only when it's itself an absolute URL
  // (fixture/seed docs carry a relative fileKey that an <iframe>/<img> would
  // resolve against this app's own origin).
  const rawFileKey = doc.currentVersion?.fileKey;
  const signedFileUrl = doc.currentVersion?.fileUrl?.trim() || undefined;
  const fileKeyIsUrl = !!rawFileKey && /^https?:\/\//i.test(rawFileKey);
  const fileUrl = signedFileUrl ?? (fileKeyIsUrl ? encodeURI(rawFileKey as string) : undefined);
  const mime = doc.currentVersion?.mimeType || '';
  const isPdf = mime === 'application/pdf';
  const isImage = mime.startsWith('image/');

  return (
    <div>
      <div className="flex g8 wrap" style={{ marginBottom: '12px' }}>
        <span className="badge b-urg-low">{doc.status}</span>
        <span className="badge b-urg-low">{doc.confidentiality}</span>
        <span className="badge b-urg-low">{doc.urgency}</span>
        <span className="caption" style={{ alignSelf: 'center' }}>
          v{doc.currentVersion?.versionNumber ?? 1}
        </span>
      </div>
      <div
        style={{
          border: '1px solid var(--border)',
          borderRadius: '10px',
          overflow: 'hidden',
          background: 'var(--surface)',
        }}
      >
        {!fileUrl ? (
          <div className="empty-state" style={{ padding: '40px 16px' }}>
            {rawFileKey
              ? "This document's file location isn't a real URL — likely seed/fixture data."
              : 'No file attached to this document.'}
          </div>
        ) : isPdf ? (
          <iframe
            src={fileUrl}
            title={doc.title}
            style={{ width: '100%', height: '70vh', border: 'none', display: 'block' }}
          />
        ) : isImage ? (
          <img
            src={fileUrl}
            alt={doc.title}
            style={{ display: 'block', maxWidth: '100%', margin: '0 auto' }}
          />
        ) : (
          <div className="empty-state" style={{ padding: '40px 16px' }}>
            {mime || 'This file type'} can’t be previewed inline.{' '}
            <a href={fileUrl} target="_blank" rel="noreferrer">
              Open file
            </a>
          </div>
        )}
      </div>
    </div>
  );
}

/** Mirrors the real `.cab-layout` shell — sidebar tree + header, structure,
 *  schema and access cards — so the first paint doesn't jump around once the
 *  actual cabinet loads in underneath it. */
function CabinetDesignerSkeleton() {
  return (
    <div>
      <div className="page-head">
        <div>
          <div className="page-title">Cabinet Designer</div>
          <div className="page-sub">Structure builder and metadata schema editor per cabinet.</div>
        </div>
      </div>

      <div className="cab-layout" style={{ display: 'flex', gap: '16px' }}>
        <div className="card tree" style={{ width: '300px', flexShrink: 0, padding: '10px' }}>
          <SkeletonTreeRows rows={6} />
        </div>

        <div className="min-w-0" style={{ flexGrow: 1 }}>
          <div className="card mb16">
            <div className="card-body" style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <Skeleton height={18} width="30%" />
              <Skeleton height={12} width="55%" />
            </div>
          </div>

          <div className="card mb16">
            <div className="card-head">
              <Skeleton height={16} width="35%" />
            </div>
            <div className="card-body" style={{ paddingTop: '6px' }}>
              <SkeletonTreeRows rows={4} />
            </div>
          </div>

          <div className="card mb16">
            <div className="card-head">
              <Skeleton height={16} width="30%" />
            </div>
            <SkeletonTable columns={['Field', 'Type', 'Required', '']} rows={3} />
          </div>

          <div className="card">
            <div className="card-head">
              <Skeleton height={16} width="20%" />
            </div>
            <SkeletonTable columns={['Grantee', 'Permission', '']} rows={2} />
          </div>
        </div>
      </div>
    </div>
  );
}
