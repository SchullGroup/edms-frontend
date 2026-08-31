'use client';

import React, { useEffect, useMemo } from 'react';
import { useStore } from '@/store/useStore';
import { useUIStore } from '@/store/useUIStore';
import {
  useDepartments,
  useCreateDepartment,
  useUpdateDepartment,
  useDeleteDepartment,
} from '@/apis/hooks/useDepartments';
import { Table, Column } from '@/components/ui/Table';
import { Icon } from '@/components/ui/Icons';
import { Spinner } from '@/components/common/Spinner';
import { ErrorMessage } from '@/components/common/ErrorMessage';
import { Department } from '@/types/models';

interface FlatDepartment extends Department {
  depth: number;
  parentName: string;
  childCount: number;
}

/** Depth-first flatten of the department tree returned by `GET /departments`. */
function flatten(nodes: Department[], depth = 0, parentName = '—'): FlatDepartment[] {
  const out: FlatDepartment[] = [];
  for (const node of nodes) {
    const children = node.children ?? [];
    out.push({ ...node, depth, parentName, childCount: children.length });
    if (children.length) out.push(...flatten(children, depth + 1, node.name));
  }
  return out;
}

/** IDs of a department and every department beneath it — invalid parent choices. */
function subtreeIds(node: Department): string[] {
  const ids = [node.id];
  for (const child of node.children ?? []) ids.push(...subtreeIds(child));
  return ids;
}

export default function DepartmentsAdminPage() {
  const { auditAction } = useStore();
  const { setPageTitle, openModal, closeModal, openConfirm, addToast } = useUIStore();

  const { data, isLoading, isError, refetch } = useDepartments();
  const createDepartment = useCreateDepartment();
  const updateDepartment = useUpdateDepartment();
  const deleteDepartment = useDeleteDepartment();

  const tree = useMemo(() => data?.data ?? [], [data]);
  const rows = useMemo(() => flatten(tree), [tree]);
  const flatOptions = rows; // already in tree order

  useEffect(() => {
    setPageTitle('Departments');
  }, [setPageTitle]);

  const findNode = (id: string): Department | undefined => {
    const walk = (nodes: Department[]): Department | undefined => {
      for (const n of nodes) {
        if (n.id === id) return n;
        const hit = walk(n.children ?? []);
        if (hit) return hit;
      }
      return undefined;
    };
    return walk(tree);
  };

  const openForm = (dept: Department | null) => {
    const isNew = !dept;
    const excluded = dept ? new Set(subtreeIds(dept)) : new Set<string>();
    const form = { name: dept?.name ?? '', parentId: dept?.parentId ?? '' };

    openModal({
      title: isNew ? 'New department' : `Edit department — ${dept!.name}`,
      body: (
        <div className="grid" style={{ gap: '12px' }}>
          <div className="field">
            <label>
              Name <span className="req">*</span>
            </label>
            <input
              className="input"
              defaultValue={form.name}
              placeholder="e.g. Finance"
              maxLength={150}
              onChange={(e) => (form.name = e.target.value)}
            />
          </div>
          <div className="field">
            <label>Parent department</label>
            <select
              className="input"
              defaultValue={form.parentId ?? ''}
              onChange={(e) => (form.parentId = e.target.value)}
            >
              <option value="">— None (top level) —</option>
              {flatOptions
                .filter((o) => !excluded.has(o.id))
                .map((o) => (
                  <option key={o.id} value={o.id}>
                    {'  '.repeat(o.depth) + o.name}
                  </option>
                ))}
            </select>
          </div>
        </div>
      ),
      actions: [
        { label: 'Cancel' },
        {
          label: isNew ? 'Create' : 'Save',
          kind: 'btn-primary',
          onClick: () => {
            const name = form.name.trim();
            if (!name) {
              addToast('Name is required', 'error');
              return false;
            }
            if (isNew) {
              return createDepartment
                .mutateAsync({ name, parentId: form.parentId || undefined })
                .then((created) => {
                  auditAction('DEPARTMENT_CREATE', created.id, `Created department ${name}`);
                  closeModal();
                })
                .catch(() => false);
            }
            return updateDepartment
              .mutateAsync({
                id: dept!.id,
                updates: { name, parentId: form.parentId || null },
              })
              .then(() => {
                auditAction('DEPARTMENT_EDIT', dept!.id, `Updated department ${name}`);
                closeModal();
              })
              .catch(() => false);
          },
        },
      ],
    });
  };

  const handleDelete = (row: FlatDepartment) => {
    if (row.childCount > 0) {
      addToast('Move or remove the sub-departments first', 'error');
      return;
    }
    openConfirm({
      title: `Delete "${row.name}"?`,
      message:
        'This department will be removed. It cannot be deleted while it still has users or cabinets attached — you will get an error if it does.',
      confirmLabel: 'Delete department',
      danger: true,
      onConfirm: () =>
        deleteDepartment
          .mutateAsync(row.id)
          .then(() => {
            auditAction('DEPARTMENT_DELETE', row.id, `Deleted department ${row.name}`);
          })
          .catch(() => {
            /* hook surfaces the 409 / error toast */
          }),
    });
  };

  const cols: Column<any>[] = [
    {
      key: 'name',
      label: 'Department',
      render: (r: FlatDepartment) => (
        <span style={{ paddingLeft: `${r.depth * 18}px` }} className="flex aic g8">
          <span style={{ display: 'inline-flex', alignItems: 'center' }}>
            <Icon name="building" size={14} />
          </span>
          <b>{r.name}</b>
        </span>
      ),
    },
    { key: 'parentName', label: 'Parent' },
    {
      key: 'childCount',
      label: 'Sub-departments',
      render: (r: FlatDepartment) => r.childCount || '—',
    },
    {
      key: 'act',
      label: '',
      render: (r: FlatDepartment) => (
        <div className="flex g8 jce">
          <button className="btn btn-secondary btn-sm" onClick={() => openForm(findNode(r.id)!)}>
            Edit
          </button>
          <button className="btn btn-ghost btn-sm" onClick={() => handleDelete(r)}>
            Delete
          </button>
        </div>
      ),
    },
  ];

  if (isLoading) return <Spinner text="Loading departments..." />;
  if (isError) return <ErrorMessage message="Failed to load departments." retry={refetch} />;

  return (
    <div>
      <div className="page-head">
        <div>
          <div className="page-title">Departments</div>
          <div className="page-sub">
            Organizational units. Cabinets and users can be assigned to a department.
          </div>
        </div>
        <div className="actions">
          <button className="btn btn-primary flex aic" onClick={() => openForm(null)}>
            <span style={{ marginRight: '8px' }}>
              <Icon name="plus" size={15} />
            </span>
            New department
          </button>
        </div>
      </div>

      <div className="card">
        <div className="card-head">
          <span className="h3">{rows.length} departments</span>
        </div>
        <Table
          cols={cols}
          rows={rows}
          emptyMsg="No departments yet — create the first one."
        />
      </div>
    </div>
  );
}
