'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { useStore } from '@/store/useStore';
import { useUIStore } from '@/store/useUIStore';
import { usePermissions } from '@/hooks/usePermissions';
import { Icon } from '@/components/ui/Icons';
import {
  useCabinets,
  useCreateCabinet,
  useUpdateCabinet,
  useDeleteCabinet,
} from '@/apis/hooks/useCabinets';
import { useCreateFolder } from '@/apis/hooks/useFolders';
import { useDepartments } from '@/apis/hooks/useDepartments';
import { useUser } from '@/apis/hooks/useUsers';
import { Skeleton, SkeletonTable, SkeletonTreeRows } from '@/components/common/Skeleton';
import { ErrorMessage } from '@/components/common/ErrorMessage';
import { CabinetSchemaCard } from '@/components/cabinets/CabinetSchemaCard';
import { CabinetAccessCard } from '@/components/cabinets/CabinetAccessCard';

export default function CabinetDesignerPage() {
  const router = useRouter();
  const { auditAction, currentUser } = useStore();
  const { can, scopeFor } = usePermissions();
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
  const isAdmin = can('cabinet', 'create') || scopeFor('cabinet', 'view') === 'global';
  const canCreateCabinet = can('cabinet', 'create');
  const canEditCabinet = can('cabinet', 'edit');
  const canDeleteCabinet = can('cabinet', 'delete');
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
  const [cabFilter, setCabFilter] = useState('');
  const activeCabIdToUse = activeCabId || cabinets?.[0]?.id;
  const activeCab = cabinets?.find((c: any) => c.id === activeCabIdToUse) || cabinets?.[0];

  // Seeds the "General" folder on a new cabinet. All other folder work happens
  // on the Cabinets page, by the staff a cabinet is delegated to.
  const createFolder = useCreateFolder();

  useEffect(() => {
    setPageTitle('Cabinet Designer');
  }, [setPageTitle]);

  // The cabinet list comes back from the API in one unpaginated response
  // (confirmed: no `pagination` key), so filtering client-side is a plain
  // array filter, not a stopgap around missing server support.
  const filteredCabinets = cabinets.filter((c: any) =>
    c.name.toLowerCase().includes(cabFilter.trim().toLowerCase()),
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

  const docsInCabinet = activeCab._count?.documents ?? 0;
  const foldersInCabinet = activeCab._count?.folders ?? 0;
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
              . Everything inside it has to be moved or deleted first, on the Cabinets page.
            </p>
          </div>
        ),
        actions: [
          { label: 'Close' },
          {
            label: 'Open in Cabinets',
            kind: 'btn-primary',
            onClick: () => {
              router.push(`/staff/cabinets?cab=${activeCab.id}`);
            },
          },
        ],
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

  return (
    <div>
      <div className="page-head">
        <div>
          <div className="page-title">Cabinet Designer</div>
          <div className="page-sub">
            Create cabinets and set each one’s metadata schema and access.
          </div>
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
            disabled={!canCreateCabinet}
            title={!canCreateCabinet ? "You don't have permission to create cabinets" : undefined}
          >
            + New cabinet
          </button>
        </div>

        <div className="min-w-0" style={{ flexGrow: 1 }}>
          <div className="card mb-4">
            <div className="card-head">
              <span className="h3">
                {activeCab.name}
                {departmentLabel(activeCab.departmentId) && (
                  <span className="caption" style={{ marginLeft: '8px' }}>
                    · {departmentLabel(activeCab.departmentId)}
                  </span>
                )}
              </span>
              <span className="flex items-center gap-2">
                <button
                  className="btn btn-secondary btn-sm"
                  onClick={handleEditCabinet}
                  disabled={!canEditCabinet}
                  title={!canEditCabinet ? "You don't have permission to edit cabinets" : undefined}
                >
                  Edit
                </button>
                <button
                  className="btn btn-ghost btn-sm"
                  onClick={handleDeleteCabinet}
                  disabled={!canDeleteCabinet}
                  title={
                    !canDeleteCabinet ? "You don't have permission to delete cabinets" : undefined
                  }
                >
                  Delete cabinet
                </button>
              </span>
            </div>
            <div className="card-body" style={{ paddingTop: '6px' }}>
              <div className="caption">
                {activeCab.description || 'No description.'} · {docsInCabinet} docs ·{' '}
                {foldersInCabinet} folders
              </div>
            </div>
          </div>

          <CabinetSchemaCard cabinet={activeCab} />
          <CabinetAccessCard cabinet={activeCab} />
        </div>
      </div>
    </div>
  );
}

/** Mirrors the real `.cab-layout` shell — sidebar tree + header, schema and
 *  access cards — so the first paint doesn't jump around once the actual
 *  cabinet loads in underneath it. */
function CabinetDesignerSkeleton() {
  return (
    <div>
      <div className="page-head">
        <div>
          <div className="page-title">Cabinet Designer</div>
          <div className="page-sub">
            Create cabinets and set each one’s metadata schema and access.
          </div>
        </div>
      </div>

      <div className="cab-layout" style={{ display: 'flex', gap: '16px' }}>
        <div className="card tree" style={{ width: '300px', flexShrink: 0, padding: '10px' }}>
          <SkeletonTreeRows rows={6} />
        </div>

        <div className="min-w-0" style={{ flexGrow: 1 }}>
          <div className="card mb-4">
            <div className="card-body" style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <Skeleton height={18} width="30%" />
              <Skeleton height={12} width="55%" />
            </div>
          </div>

          <div className="card mb-4">
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
