'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';
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

/** Depth-first flatten of the entire department tree returned by `GET /departments`. */
function flatten(nodes: Department[], depth = 0, parentName = '—'): FlatDepartment[] {
  const out: FlatDepartment[] = [];
  for (const node of nodes) {
    const children = node.children ?? [];
    out.push({ ...node, depth, parentName, childCount: children.length });
    if (children.length) out.push(...flatten(children, depth + 1, node.name));
  }
  return out;
}

/**
 * Like `flatten`, but a node's sub-departments are only included when the node
 * is expanded. Top-level departments are always shown; deeper levels stay hidden
 * until the admin expands their parent.
 */
function flattenVisible(
  nodes: Department[],
  expanded: Set<string>,
  depth = 0,
  parentName = '—',
): FlatDepartment[] {
  const out: FlatDepartment[] = [];
  for (const node of nodes) {
    const children = node.children ?? [];
    out.push({ ...node, depth, parentName, childCount: children.length });
    if (children.length && expanded.has(node.id)) {
      out.push(...flattenVisible(children, expanded, depth + 1, node.name));
    }
  }
  return out;
}

/** IDs of a department and every department beneath it — invalid parent choices. */
function subtreeIds(node: Department): string[] {
  const ids = [node.id];
  for (const child of node.children ?? []) ids.push(...subtreeIds(child));
  return ids;
}

/**
 * Kebab (more-vert) button that reveals the per-row actions in a popover.
 * The menu is positioned with `position: fixed` so it isn't clipped by the
 * table's horizontal-scroll container.
 */
function RowMenu({
  onAddSub,
  onEdit,
  onDelete,
}: {
  onAddSub: () => void;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null);
  const btnRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const open = pos !== null;

  const close = () => setPos(null);

  const openMenu = () => {
    const r = btnRef.current?.getBoundingClientRect();
    if (!r) return;
    const MENU_W = 208;
    const MENU_H = 152;
    const left = Math.max(8, r.right - MENU_W);
    const below = r.bottom + 6;
    const top = below + MENU_H > window.innerHeight ? Math.max(8, r.top - 6 - MENU_H) : below;
    setPos({ top, left });
  };

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (
        !menuRef.current?.contains(e.target as Node) &&
        !btnRef.current?.contains(e.target as Node)
      ) {
        close();
      }
    };
    document.addEventListener('mousedown', onDown);
    window.addEventListener('scroll', close, true);
    window.addEventListener('resize', close);
    return () => {
      document.removeEventListener('mousedown', onDown);
      window.removeEventListener('scroll', close, true);
      window.removeEventListener('resize', close);
    };
  }, [open]);

  const run = (fn: () => void) => () => {
    close();
    fn();
  };

  return (
    <>
      <button
        ref={btnRef}
        type="button"
        className="icon-btn"
        aria-label="Department actions"
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => (open ? close() : openMenu())}
      >
        <Icon name="moreV" size={16} />
      </button>
      {open && (
        <div
          ref={menuRef}
          className="menu"
          role="menu"
          style={{ position: 'fixed', top: pos!.top, left: pos!.left, right: 'auto', minWidth: '208px' }}
        >
          <button className="menu-item" role="menuitem" onClick={run(onAddSub)}>
            <Icon name="plus" size={14} /> Add sub-department
          </button>
          <button className="menu-item" role="menuitem" onClick={run(onEdit)}>
            <Icon name="edit" size={14} /> Edit
          </button>
          <div className="menu-sep" />
          <button className="menu-item danger" role="menuitem" onClick={run(onDelete)}>
            <Icon name="x" size={14} /> Delete
          </button>
        </div>
      )}
    </>
  );
}

export default function DepartmentsAdminPage() {
  const { auditAction } = useStore();
  const { setPageTitle, openModal, closeModal, openConfirm, addToast } = useUIStore();

  const { data, isLoading, isError, refetch } = useDepartments();
  const createDepartment = useCreateDepartment();
  const updateDepartment = useUpdateDepartment();
  const deleteDepartment = useDeleteDepartment();

  const tree = useMemo(() => data?.data ?? [], [data]);
  const allRows = useMemo(() => flatten(tree), [tree]); // full tree — used for counts + parent picker
  const flatOptions = allRows; // already in tree order

  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const rows = useMemo(() => flattenVisible(tree, expanded), [tree, expanded]);

  const toggle = (id: string) =>
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

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

  const openForm = (dept: Department | null, presetParent?: Department) => {
    const isNew = !dept;
    // Editing: a department (and its whole subtree) can't become its own parent.
    // Adding a sub-department: the parent is fixed to `presetParent`.
    const excluded = dept ? new Set(subtreeIds(dept)) : new Set<string>();
    const form = {
      name: dept?.name ?? '',
      parentId: presetParent?.id ?? dept?.parentId ?? '',
    };

    openModal({
      title: isNew
        ? presetParent
          ? `New sub-department under ${presetParent.name}`
          : 'New department'
        : `Edit department — ${dept!.name}`,
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
            {presetParent ? (
              // Fixed parent: the admin can't select this (or any other)
              // department as the parent of its own sub-department.
              <input className="input" value={presetParent.name} disabled readOnly />
            ) : (
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
            )}
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
                  // Reveal the new child under its (now non-empty) parent.
                  if (presetParent) {
                    setExpanded((prev) => new Set(prev).add(presetParent.id));
                  }
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
      render: (r: FlatDepartment) => {
        const isOpen = expanded.has(r.id);
        return (
          <span style={{ paddingLeft: `${r.depth * 18}px` }} className="flex aic g8">
            {r.childCount > 0 ? (
              <button
                type="button"
                className="btn btn-ghost btn-sm"
                style={{ padding: '2px', lineHeight: 0 }}
                aria-expanded={isOpen}
                aria-label={`${isOpen ? 'Hide' : 'Show'} sub-departments of ${r.name}`}
                onClick={() => toggle(r.id)}
              >
                <Icon name={isOpen ? 'chevD' : 'chevR'} size={14} />
              </button>
            ) : (
              <span style={{ display: 'inline-block', width: '22px' }} />
            )}
            <span style={{ display: 'inline-flex', alignItems: 'center' }}>
              <Icon name="building" size={14} />
            </span>
            <b>{r.name}</b>
          </span>
        );
      },
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
        <div className="flex jce">
          <RowMenu
            onAddSub={() => openForm(null, findNode(r.id)!)}
            onEdit={() => openForm(findNode(r.id)!)}
            onDelete={() => handleDelete(r)}
          />
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
          <span className="h3">
            {tree.length} top-level{allRows.length !== tree.length && `, ${allRows.length} total`}
          </span>
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
