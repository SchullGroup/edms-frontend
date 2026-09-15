'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { useStore } from '@/store/useStore';
import { useUIStore } from '@/store/useUIStore';
import {
  useRoles,
  useCreateRole,
  useUpdateRole,
  useDeleteRole,
  useSetRolePermissions,
} from '@/apis/hooks/useRoles';
import { isSystemRoleName } from '@/lib/permissions';
import { Icon } from '@/components/ui/Icons';
import { Spinner } from '@/components/common/Spinner';
import { Role, RolePermission } from '@/types/models';

/** Friendly grouping of the (data-driven) resource list into modules. Anything the
 *  backend adds that isn't listed here still shows up, under "Other". */
const MODULE_MAP: { label: string; resources: string[] }[] = [
  {
    label: 'Documents',
    resources: ['document', 'document_version', 'document_lock', 'document_metadata'],
  },
  {
    label: 'Filing',
    resources: ['cabinet', 'cabinet_metadata_field', 'cabinet_access', 'folder'],
  },
  { label: 'Workflow', resources: ['workflow'] },
  { label: 'Administration', resources: ['user', 'role', 'department'] },
  { label: 'Audit & Compliance', resources: ['audit'] },
  { label: 'Dashboards', resources: ['dashboard'] },
];

/** Preferred left-to-right order for the action columns; unknown actions append. */
const ACTION_ORDER = [
  'view',
  'search',
  'create',
  'upload',
  'edit',
  'restore',
  'route',
  'publish',
  'archive',
  'download',
  'export',
  'print',
  'delete',
];

const titleize = (s: string) => s.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
const permKey = (p: { resource: string; action: string }) => `${p.resource}:${p.action}`;
const keySet = (perms: RolePermission[] | undefined) => new Set((perms ?? []).map(permKey));

export default function RolesPermissionsPage() {
  const { auditAction } = useStore();
  const { setPageTitle, openModal, closeModal, openConfirm, addToast } = useUIStore();

  const { data: roles, isLoading } = useRoles();
  const createRole = useCreateRole();
  const updateRole = useUpdateRole();
  const deleteRole = useDeleteRole();
  const setRolePermissions = useSetRolePermissions();

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [filter, setFilter] = useState('');
  // Editable copy of the selected role's permission keys, plus the last-saved baseline.
  const [draft, setDraft] = useState<Set<string>>(new Set());
  const [baseline, setBaseline] = useState<Set<string>>(new Set());
  // Each module section saves/discards independently and can be collapsed on its own.
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());
  const [savingModule, setSavingModule] = useState<string | null>(null);

  useEffect(() => {
    setPageTitle('Roles & Permissions');
  }, [setPageTitle]);

  const sortedRoles = useMemo(
    () => [...(roles ?? [])].sort((a, b) => a.name.localeCompare(b.name)),
    [roles],
  );

  // Default selection: first role once the list loads.
  useEffect(() => {
    if (!selectedId && sortedRoles.length) setSelectedId(sortedRoles[0].id);
  }, [sortedRoles, selectedId]);

  const selectedRole = useMemo(
    () => sortedRoles.find((r) => r.id === selectedId) ?? null,
    [sortedRoles, selectedId],
  );

  // Re-seed the editor whenever the selected role (or its stored permissions) changes.
  useEffect(() => {
    const s = keySet(selectedRole?.permissions);
    setBaseline(s);
    setDraft(new Set(s));
  }, [selectedRole?.id, JSON.stringify(selectedRole?.permissions)]);

  // Built-in roles keep their name and existence protected (rename/delete are
  // blocked below), but their permissions are editable like any other role —
  // the backend is the real gate here, same as everywhere else in this app.
  const isProtected = (r: Role | null) => !!r && (r.isSystemRole || isSystemRoleName(r.name));

  // --- Permission catalog, derived from every role's permissions -----------------
  const catalog = useMemo(() => {
    const byKey = new Map<string, RolePermission>();
    for (const r of roles ?? []) {
      for (const p of r.permissions ?? []) {
        const k = permKey(p);
        if (!byKey.has(k)) byKey.set(k, { id: p.id, resource: p.resource, action: p.action });
      }
    }
    const resources = [...new Set([...byKey.values()].map((p) => p.resource))];
    const actionsByResource = new Map<string, string[]>();
    const actionSeen = new Set<string>();
    for (const p of byKey.values()) {
      actionSeen.add(p.action);
      const list = actionsByResource.get(p.resource) ?? [];
      list.push(p.action);
      actionsByResource.set(p.resource, list);
    }
    const actionCols = [
      ...ACTION_ORDER.filter((a) => actionSeen.has(a)),
      ...[...actionSeen].filter((a) => !ACTION_ORDER.includes(a)).sort(),
    ];
    return { byKey, resources, actionsByResource, actionCols };
  }, [roles]);

  const modules = useMemo(() => {
    const claimed = new Set<string>();
    const out = MODULE_MAP.map((m) => {
      const resources = m.resources.filter((r) => catalog.resources.includes(r));
      resources.forEach((r) => claimed.add(r));
      return { label: m.label, resources };
    }).filter((m) => m.resources.length > 0);
    const other = catalog.resources.filter((r) => !claimed.has(r)).sort();
    if (other.length) out.push({ label: 'Other', resources: other });
    return out;
  }, [catalog]);

  // --- editing -------------------------------------------------------------------
  // There's no per-section save on the API — `PUT /roles/:id/permissions` always
  // replaces the whole set — so "saving a module" builds the full payload from the
  // last-saved baseline with just that module's keys overlaid from the draft. That
  // commits only this module's edits and leaves any unsaved edits sitting in other,
  // still-open modules exactly as they were, rather than silently saving everything
  // or forcing one page-wide save/discard.
  const toggleKey = (key: string, on: boolean) => {
    setDraft((prev) => {
      const next = new Set(prev);
      on ? next.add(key) : next.delete(key);
      return next;
    });
  };

  const moduleKeys = (mod: { resources: string[] }) =>
    mod.resources.flatMap((res) =>
      (catalog.actionsByResource.get(res) ?? []).map((a) => `${res}:${a}`),
    );

  const moduleFully = (mod: { resources: string[] }) => {
    const keys = moduleKeys(mod);
    return keys.length > 0 && keys.every((k) => draft.has(k));
  };

  const moduleDirty = (mod: { resources: string[] }) =>
    moduleKeys(mod).some((k) => draft.has(k) !== baseline.has(k));

  const toggleModule = (mod: { resources: string[] }) => {
    const keys = moduleKeys(mod);
    const grant = !moduleFully(mod);
    setDraft((prev) => {
      const next = new Set(prev);
      keys.forEach((k) => (grant ? next.add(k) : next.delete(k)));
      return next;
    });
  };

  const discardModule = (mod: { resources: string[] }) => {
    const keys = moduleKeys(mod);
    setDraft((prev) => {
      const next = new Set(prev);
      keys.forEach((k) => (baseline.has(k) ? next.add(k) : next.delete(k)));
      return next;
    });
  };

  const saveModule = (mod: { label: string; resources: string[] }) => {
    if (!selectedRole) return;
    const keys = moduleKeys(mod);
    const desired = new Set(baseline);
    keys.forEach((k) => (draft.has(k) ? desired.add(k) : desired.delete(k)));

    const permissions: RolePermission[] = [...desired].map((key) => {
      const [resource, action] = key.split(':');
      const cat = catalog.byKey.get(key);
      return cat?.id ? { id: cat.id, resource, action } : { resource, action };
    });

    setSavingModule(mod.label);
    setRolePermissions.mutate(
      { id: selectedRole.id, permissions },
      {
        onSuccess: (updated) => {
          setBaseline(keySet(updated.permissions));
          setSavingModule(null);
          auditAction('ROLE_EDIT', selectedRole.name, `Updated ${mod.label} permissions`);
          addToast(`${mod.label} permissions saved`, 'success');
        },
        onError: () => setSavingModule(null),
      },
    );
  };

  const toggleCollapse = (label: string) => {
    setCollapsed((prev) => {
      const next = new Set(prev);
      next.has(label) ? next.delete(label) : next.add(label);
      return next;
    });
  };

  // --- role CRUD modals ------------------------------------------------------------
  const handleNewRole = () => {
    const form = { name: '', description: '' };
    openModal({
      title: 'New role',
      body: (
        <div className="grid gap-3">
          <div className="field">
            <label>
              Role name <span className="req">*</span>
            </label>
            <input
              className="input"
              placeholder="e.g. finance_reviewer"
              maxLength={100}
              onChange={(e) => (form.name = e.target.value)}
            />
          </div>
          <div className="field">
            <label>Description</label>
            <input
              className="input"
              placeholder="Optional — what this role is for"
              maxLength={500}
              onChange={(e) => (form.description = e.target.value)}
            />
          </div>
        </div>
      ),
      actions: [
        { label: 'Cancel' },
        {
          label: 'Create role',
          kind: 'btn-primary',
          onClick: () => {
            const name = form.name.trim();
            if (!name) {
              addToast('Role name is required', 'error');
              return false;
            }
            return createRole
              .mutateAsync({ name, description: form.description.trim() || undefined })
              .then((created) => {
                auditAction('ROLE_CREATE', created.name, `Created role ${name}`);
                setSelectedId(created.id);
                closeModal();
              })
              .catch(() => false);
          },
        },
      ],
    });
  };

  const handleEditRole = (role: Role) => {
    const form = { name: role.name, description: role.description || '' };
    openModal({
      title: `Edit role — ${role.name}`,
      body: (
        <div className="grid gap-3">
          <div className="field">
            <label>
              Role name <span className="req">*</span>
            </label>
            <input
              className="input"
              defaultValue={form.name}
              maxLength={100}
              disabled={isProtected(role)}
              onChange={(e) => (form.name = e.target.value)}
            />
          </div>
          <div className="field">
            <label>Description</label>
            <input
              className="input"
              defaultValue={form.description}
              maxLength={500}
              onChange={(e) => (form.description = e.target.value)}
            />
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
              addToast('Role name is required', 'error');
              return false;
            }
            return updateRole
              .mutateAsync({
                id: role.id,
                updates: { name, description: form.description.trim() || undefined },
              })
              .then(() => {
                auditAction('ROLE_EDIT', role.name, `Renamed/updated → ${name}`);
                closeModal();
              })
              .catch(() => false);
          },
        },
      ],
    });
  };

  const handleDeleteRole = (role: Role) => {
    if (isProtected(role)) {
      addToast('Built-in roles cannot be deleted', 'error');
      return;
    }
    openConfirm({
      title: `Delete role "${role.name}"?`,
      message:
        'Users currently holding this role will lose the permissions it grants. This cannot be undone.',
      confirmLabel: 'Delete role',
      danger: true,
      onConfirm: () =>
        deleteRole.mutateAsync(role.id).then(() => {
          auditAction('ROLE_DELETE', role.name, `Deleted role ${role.name}`);
          setSelectedId(null);
        }),
    });
  };

  // --- render -----------------------------------------------------------------
  const visibleRoles = sortedRoles.filter((r) =>
    r.name.toLowerCase().includes(filter.trim().toLowerCase()),
  );

  return (
    <div>
      <div className="page-head">
        <div>
          <div className="page-title">Roles &amp; Permissions</div>
          <div className="page-sub">
            Define what each role can do. Built-in roles are read-only; create custom roles for
            anything else.
          </div>
        </div>
      </div>

      <div className="cab-layout">
        {/* -------- role rail -------- */}
        <div className="card">
          <div className="card-head">
            <span className="h3">Roles</span>
            <button className="btn btn-primary btn-sm" onClick={handleNewRole}>
              <Icon name="plus" size={14} /> New
            </button>
          </div>
          <div className="card-body" style={{ paddingTop: 10 }}>
            <input
              className="input mb-2"
              placeholder="Filter roles…"
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
            />
            {isLoading ? (
              <Spinner />
            ) : visibleRoles.length === 0 ? (
              <div className="caption" style={{ padding: '12px 4px' }}>
                No roles match.
              </div>
            ) : (
              <div className="flex flex-col gap-1 max-h-140 overflow-y-auto -mx-1 px-1">
                {visibleRoles.map((r) => {
                  const active = r.id === selectedId;
                  return (
                    <button
                      key={r.id}
                      type="button"
                      onClick={() => setSelectedId(r.id)}
                      aria-current={active || undefined}
                      className={
                        'w-full text-left bg-transparent rounded-[10px] border px-3 py-2 transition-colors ' +
                        (active
                          ? 'border-[color-mix(in_srgb,var(--focus)_38%,transparent)] bg-[color-mix(in_srgb,var(--focus)_10%,var(--panel))]'
                          : 'border-transparent hover:bg-[var(--surface)]')
                      }
                    >
                      <div className="flex items-center justify-between gap-2">
                        <b
                          className={active ? 'text-[var(--focus)]' : undefined}
                          style={{ fontSize: 13 }}
                        >
                          {titleize(r.name)}
                        </b>
                        <span
                          className={`badge ${isProtected(r) ? 'b-urg-normal' : 'b-urg-low'}`}
                          style={{ flexShrink: 0 }}
                        >
                          {isProtected(r) ? 'Built-in' : 'Custom'}
                        </span>
                      </div>
                      {r.description && (
                        <div className="caption truncate" style={{ marginTop: 2 }}>
                          {r.description}
                        </div>
                      )}
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* -------- permission editor -------- */}
        <div className="card">
          {!selectedRole ? (
            <div className="empty">
              <Icon name="key" size={28} />
              <div className="e-title mt-4">Select a role</div>
              <p className="caption">Pick a role on the left to view or edit its permissions.</p>
            </div>
          ) : (
            <>
              <div className="card-head" style={{ alignItems: 'flex-start' }}>
                <div style={{ minWidth: 0 }}>
                  <div className="flex items-center gap-2">
                    <span className="h2">{titleize(selectedRole.name)}</span>
                    <span
                      className={`badge ${isProtected(selectedRole) ? 'b-urg-normal' : 'b-urg-low'}`}
                    >
                      {isProtected(selectedRole) ? 'Built-in' : 'Custom'}
                    </span>
                  </div>
                  {selectedRole.description && (
                    <div className="caption mt-1">{selectedRole.description}</div>
                  )}
                </div>
                <div className="flex gap-2" style={{ flexShrink: 0 }}>
                  <button
                    className="btn btn-secondary btn-sm"
                    onClick={() => handleEditRole(selectedRole)}
                  >
                    <Icon name="edit" size={13} /> Edit role
                  </button>
                  {!isProtected(selectedRole) && (
                    <button
                      className="btn btn-ghost btn-sm"
                      onClick={() => handleDeleteRole(selectedRole)}
                    >
                      <Icon name="x" size={13} /> Delete
                    </button>
                  )}
                </div>
              </div>

              <div className="card-body">
                <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
                  <span className="h3">Permissions</span>
                  {isProtected(selectedRole) && (
                    <span className="caption flex items-center gap-2">
                      <Icon name="shield" size={13} /> Built-in role — changes apply to everyone
                      holding it
                    </span>
                  )}
                </div>

                {catalog.resources.length === 0 ? (
                  <div className="caption">No permissions are defined in the system yet.</div>
                ) : (
                  modules.map((mod) => {
                    const isCollapsed = collapsed.has(mod.label);
                    const keys = moduleKeys(mod);
                    const grantedCount = keys.filter((k) => draft.has(k)).length;
                    const isDirty = moduleDirty(mod);
                    const busy = setRolePermissions.isPending;

                    return (
                      <div key={mod.label} style={{ marginBottom: 14 }}>
                        <div
                          className="flex items-center justify-between flex-wrap gap-2"
                          style={{ marginBottom: isCollapsed ? 0 : 10 }}
                        >
                          <button
                            type="button"
                            onClick={() => toggleCollapse(mod.label)}
                            aria-expanded={!isCollapsed}
                            className="flex items-center gap-2 bg-transparent border-0 cursor-pointer -mx-2 px-2 py-1 rounded-lg transition-colors hover:bg-(--surface)"
                          >
                            <Icon name={isCollapsed ? 'chevR' : 'chevD'} size={13} />
                            <span className="h3" style={{ fontSize: 13 }}>
                              {mod.label}
                            </span>
                            {isDirty && (
                              <span
                                title="Unsaved changes"
                                style={{
                                  width: 6,
                                  height: 6,
                                  borderRadius: '50%',
                                  background: 'var(--status-pending)',
                                  display: 'inline-block',
                                  flexShrink: 0,
                                }}
                              />
                            )}
                            <span className="caption">
                              {grantedCount}/{keys.length}
                            </span>
                          </button>

                          <div className="flex items-center gap-2">
                            <button
                              type="button"
                              className="btn btn-ghost btn-sm"
                              onClick={() => toggleModule(mod)}
                              disabled={busy}
                            >
                              {moduleFully(mod) ? 'Clear all' : 'Full access'}
                            </button>
                            {isDirty && (
                              <>
                                <button
                                  type="button"
                                  className="btn btn-secondary btn-sm"
                                  onClick={() => discardModule(mod)}
                                  disabled={busy}
                                >
                                  Discard
                                </button>
                                <button
                                  type="button"
                                  className="btn btn-primary btn-sm"
                                  onClick={() => saveModule(mod)}
                                  disabled={busy}
                                >
                                  {busy && savingModule === mod.label ? 'Saving…' : 'Save'}
                                </button>
                              </>
                            )}
                          </div>
                        </div>

                        {!isCollapsed && (
                          <div className="tbl-wrap">
                            <table className="tbl pm-grid">
                              <thead>
                                <tr>
                                  <th>Resource</th>
                                  {catalog.actionCols.map((a) => (
                                    <th key={a}>{titleize(a)}</th>
                                  ))}
                                </tr>
                              </thead>
                              <tbody>
                                {mod.resources.map((res) => (
                                  <tr key={res}>
                                    <td>{titleize(res)}</td>
                                    {catalog.actionCols.map((a) => {
                                      const supported = (
                                        catalog.actionsByResource.get(res) ?? []
                                      ).includes(a);
                                      if (!supported) {
                                        return (
                                          <td key={a} className="muted">
                                            —
                                          </td>
                                        );
                                      }
                                      const key = `${res}:${a}`;
                                      return (
                                        <td key={a}>
                                          <label className="switch">
                                            <input
                                              type="checkbox"
                                              checked={draft.has(key)}
                                              onChange={(e) => toggleKey(key, e.target.checked)}
                                            />
                                            <i />
                                          </label>
                                        </td>
                                      );
                                    })}
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        )}
                      </div>
                    );
                  })
                )}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
