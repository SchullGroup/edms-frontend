'use client';

import React, { use, useEffect, useState } from 'react';
import Link from 'next/link';
import { useStore } from '@/store/useStore';
import { useUIStore } from '@/store/useUIStore';
import { usePermissions } from '@/hooks/usePermissions';
import { useCabinet } from '@/apis/hooks/useCabinets';
import {
  useCabinetFolders,
  useFolderAccessGrants,
  useGrantFolderAccess,
  useRevokeFolderAccess,
  useUpdateFolderConfidentiality,
  useUpdateFolderInheritance,
} from '@/apis/hooks/useFolders';
import { useRoles } from '@/apis/hooks/useRoles';
import { useAllUsers } from '@/apis/hooks/useUsers';
import { Table, Column } from '@/components/ui/Table';
import { Combobox } from '@/components/ui/Combobox';
import { ConfBadge } from '@/components/ui/Badges';
import { SkeletonPage, SkeletonTable } from '@/components/common/Skeleton';
import { ErrorMessage } from '@/components/common/ErrorMessage';
import {
  CABINET_BYPASS_ROLE,
  cabinetAllows,
  grantableLevels,
  useMyCabinetAccess,
} from '@/components/cabinets/cabinetAccess';
import { FolderSecurityBadges } from '@/components/cabinets/FolderSecurityBadges';
import { CONF_LEVELS, TOP_SECRET_LEVEL } from '@/constants/documentLevels';
import { effectiveFolderTier, folderPathLabel, restrictingFolder } from '@/utils/folders';
import type {
  CabinetAccessPermission,
  DocumentConfidentiality,
  Folder,
  FolderAccessGrant,
  User,
} from '@/types/models';

const roleNamesOf = (u: User) =>
  u.roles?.map((r) => r.name) ?? u.userRoles?.map((ur) => ur.role.name) ?? [];

const prettyRole = (name: string) => name.replace(/_/g, ' ');

/** One folder's confidentiality, inheritance and grants. Tier and inheritance are client_admin only. */
export default function FolderAccessPage({
  params,
}: {
  params: Promise<{ cabinetId: string; folderId: string }>;
}) {
  const { cabinetId, folderId } = use(params);
  const { setPageTitle } = useUIStore();
  const { can } = usePermissions();
  const currentUser = useStore((s) => s.currentUser);
  const isAdmin = !!currentUser?.roles?.includes(CABINET_BYPASS_ROLE);

  const { data: cabinet } = useCabinet(cabinetId);
  const myLevel = useMyCabinetAccess(cabinetId);
  const {
    data: foldersData,
    isLoading: foldersLoading,
    isError: foldersError,
    refetch,
  } = useCabinetFolders(cabinetId);
  const folders = foldersData?.data || [];
  const folder = folders.find((f) => f.id === folderId);

  const roleAllows = can('folder', 'edit');
  const grantsQuery = useFolderAccessGrants(folderId, { enabled: roleAllows && !!folder });

  useEffect(() => {
    setPageTitle('Folder permissions');
  }, [setPageTitle]);

  const back = `/staff/cabinets?cab=${cabinetId}&folder=${folderId}`;
  const explain = (message: string) => (
    <div className="card">
      <div className="card-body">
        <p>{message}</p>
        <Link href={back} className="btn btn-secondary btn-sm mt-2">
          Back to the folder
        </Link>
      </div>
    </div>
  );

  if (foldersLoading) return <SkeletonPage columns={['Setting', 'Value']} rows={6} />;
  if (foldersError) {
    return (
      <ErrorMessage message="Failed to load this cabinet's folders." retry={() => refetch()} />
    );
  }
  if (!folder) {
    return explain("This folder doesn't exist, or its access settings keep it hidden from you.");
  }
  if (!roleAllows) return explain("Your role can't manage folder permissions.");
  if (myLevel && !cabinetAllows(myLevel, 'edit')) {
    return explain(
      `Managing folder permissions needs Edit access on ${cabinet?.name ?? 'this cabinet'}. Yours is ${myLevel}.`,
    );
  }
  const status = (grantsQuery.error as any)?.response?.status;
  if (status === 403 || status === 404) {
    return explain(
      'You need Edit access on this folder to manage its permissions. Its own access list gives you less than that.',
    );
  }

  return (
    <div>
      <div className="page-head">
        <div>
          <div className="page-title flex items-center">
            Folder permissions
            <FolderSecurityBadges folders={folders} id={folder.id} />
          </div>
          <div className="page-sub">
            {cabinet?.name ? `${cabinet.name} / ` : ''}
            {folderPathLabel(folders, folder.id)}
          </div>
        </div>
        <Link href={back} className="btn btn-secondary btn-sm">
          Back to the folder
        </Link>
      </div>

      <SecuritySettingsCard
        folders={folders}
        folderId={folder.id}
        isAdmin={isAdmin}
        grantCount={grantsQuery.data?.length}
      />
      <GrantsCard
        folderId={folder.id}
        inherits={folder.inheritsPermissions !== false}
        grants={grantsQuery.data}
        loading={grantsQuery.isLoading}
        isAdmin={isAdmin}
        myLevel={myLevel}
      />
    </div>
  );
}

// --- Confidentiality + inheritance ---

function SecuritySettingsCard({
  folders,
  folderId,
  isAdmin,
  grantCount,
}: {
  folders: Folder[];
  folderId: string;
  isAdmin: boolean;
  grantCount: number | undefined;
}) {
  const { openConfirm } = useUIStore();
  const { can } = usePermissions();
  const folder = folders.find((f) => f.id === folderId)!;
  const updateTier = useUpdateFolderConfidentiality();
  const updateInheritance = useUpdateFolderInheritance();

  const own = folder.confidentiality ?? null;
  const [tier, setTier] = useState<DocumentConfidentiality | ''>(own ?? '');
  useEffect(() => setTier(own ?? ''), [own]);

  const levels = can('document', 'view_top_secret')
    ? [...CONF_LEVELS, TOP_SECRET_LEVEL]
    : CONF_LEVELS;
  // Keep a tier set elsewhere selectable even when this caller couldn't pick it.
  const options =
    own && !levels.some((l) => l.value === own) ? [...levels, { label: own, value: own }] : levels;

  const parent = folder.parentId ? effectiveFolderTier(folders, folder.parentId) : null;
  const effective = effectiveFolderTier(folders, folderId);
  const restrictor = restrictingFolder(folders, folderId);
  const ancestorRestrictor = restrictor && restrictor.id !== folderId ? restrictor : null;
  const inherits = folder.inheritsPermissions !== false;
  const disabledReason = isAdmin ? null : 'Only a client administrator can change these settings.';

  const saveTier = () =>
    updateTier.mutate({ id: folderId, confidentiality: tier === '' ? null : tier });

  const toggleInheritance = (next: boolean) => {
    if (next) {
      openConfirm({
        title: 'Inherit the cabinet’s access again?',
        message:
          'Everyone who can reach the cabinet will reach this folder again, at their cabinet level. The grants below stay but stop having any effect.',
        confirmLabel: 'Inherit access',
        onConfirm: () =>
          updateInheritance
            .mutateAsync({ id: folderId, inheritsPermissions: true })
            .then(() => {})
            .catch(() => {}),
      });
      return;
    }
    openConfirm({
      title: 'Stop inheriting the cabinet’s access?',
      message:
        grantCount === 0
          ? 'This folder has no grants yet, so only client administrators will be able to see it or its documents until you add some.'
          : 'Only the roles and users granted below will reach this folder and its sub-folders, at no more than their cabinet level. Everyone else loses access.',
      confirmLabel: 'Stop inheriting',
      danger: true,
      onConfirm: () =>
        updateInheritance
          .mutateAsync({ id: folderId, inheritsPermissions: false })
          .then(() => {})
          .catch(() => {}),
    });
  };

  return (
    <div className="card mb-4">
      <div className="card-head">
        <span className="h3">Security settings</span>
      </div>
      <div className="card-body grid" style={{ gap: 20 }}>
        {disabledReason && (
          <div className="banner info" style={{ marginBottom: 0 }}>
            {disabledReason}
          </div>
        )}

        <div className="field" style={{ marginBottom: 0 }}>
          <label htmlFor="folder-tier">Confidentiality</label>
          <div className="flex items-center gap-2 flex-wrap">
            <select
              id="folder-tier"
              className="input"
              style={{ maxWidth: 260 }}
              value={tier}
              disabled={!isAdmin || updateTier.isPending}
              onChange={(e) => setTier(e.target.value as DocumentConfidentiality | '')}
            >
              <option value="">None (no tier of its own)</option>
              {options.map((l) => (
                <option key={l.value} value={l.value}>
                  {l.label}
                </option>
              ))}
            </select>
            {isAdmin && tier !== (own ?? '') && (
              <button
                className="btn btn-primary btn-sm"
                onClick={saveTier}
                disabled={updateTier.isPending}
              >
                {updateTier.isPending ? 'Saving…' : 'Save'}
              </button>
            )}
          </div>
          <div className="help">
            People without clearance for the tier don&rsquo;t see this folder, its sub-folders or
            their documents. Public and Internal need no clearance.
            {parent && (
              <>
                {' '}
                <b>{parent.from.name}</b> above sets <ConfBadge level={parent.tier} />; the
                strictest tier on the path applies, so a lower tier here changes nothing.
              </>
            )}
          </div>
          {effective && effective.from.id !== folderId && !own && (
            <div className="help">
              In effect here: <ConfBadge level={effective.tier} />
            </div>
          )}
        </div>

        <div className="field" style={{ marginBottom: 0 }}>
          <div className="flex items-center gap-3">
            <label className="switch" title={disabledReason ?? undefined}>
              <input
                type="checkbox"
                aria-label="Inherit access from the cabinet"
                checked={inherits}
                disabled={!isAdmin || updateInheritance.isPending}
                onChange={(e) => toggleInheritance(e.target.checked)}
              />
              <i></i>
            </label>
            <b>Inherit access from the cabinet</b>
          </div>
          <div className="help">
            {inherits
              ? 'Everyone who can reach the cabinet reaches this folder at their cabinet level.'
              : 'Only the roles and users granted below reach this folder, at the lower of their cabinet level and their grant. Client administrators always keep access.'}
            {ancestorRestrictor && (
              <>
                {' '}
                <b>{ancestorRestrictor.name}</b> above has its own access list, and it still limits
                this folder.
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// --- Grants ---

function GrantsCard({
  folderId,
  inherits,
  grants,
  loading,
  isAdmin,
  myLevel,
}: {
  folderId: string;
  inherits: boolean;
  grants: FolderAccessGrant[] | undefined;
  loading: boolean;
  isAdmin: boolean;
  myLevel: CabinetAccessPermission | null;
}) {
  const { openConfirm, addToast } = useUIStore();
  const { can } = usePermissions();
  const currentUser = useStore((s) => s.currentUser);
  const grantAccess = useGrantFolderAccess();
  const revokeAccess = useRevokeFolderAccess();

  // GET /roles needs role:view and GET /users needs user:view, so offer only what loads.
  const canListRoles = can('role', 'view');
  const canListUsers = can('user', 'view');
  const { data: roles = [] } = useRoles({ enabled: canListRoles });
  const { data: usersResult } = useAllUsers({}, { enabled: canListUsers });
  const users = usersResult?.items || [];

  const myRoleNames = new Set(currentUser?.roles ?? []);
  const roleOptions = roles
    .filter((r) => r.name !== CABINET_BYPASS_ROLE && (isAdmin || !myRoleNames.has(r.name)))
    .map((r) => ({ value: r.id, label: prettyRole(r.name) }));
  const userOptions = users
    .filter((u) => u.id !== currentUser?.id && !roleNamesOf(u).includes(CABINET_BYPASS_ROLE))
    .map((u) => ({ value: u.id, label: u.name, hint: u.email }));

  // A folder level never exceeds the cabinet level, so that is the ceiling we can see.
  const levels = grantableLevels(myLevel);
  const [permission, setPermission] = useState<CabinetAccessPermission>('view');
  const [targetType, setTargetType] = useState<'role' | 'user'>(canListRoles ? 'role' : 'user');
  const [ids, setIds] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);

  const label = (g: FolderAccessGrant) => {
    if (g.role?.name) return `Role: ${prettyRole(g.role.name)}`;
    if (g.user?.name) return `User: ${g.user.name}`;
    return g.roleId ? `Role: ${g.roleId}` : `User: ${g.userId ?? '—'}`;
  };

  const submit = async () => {
    if (ids.length === 0) {
      addToast(`Select at least one ${targetType}`, 'error');
      return;
    }
    setBusy(true);
    // One principal per call; each failure toasts its own backend message.
    const results = await Promise.allSettled(
      ids.map((id) =>
        grantAccess.mutateAsync({
          folderId,
          data: { permission, ...(targetType === 'role' ? { roleId: id } : { userId: id }) },
        }),
      ),
    );
    setBusy(false);
    const ok = results.filter((r) => r.status === 'fulfilled').length;
    if (ok > 0)
      addToast(`Granted ${permission} to ${ok} ${targetType}${ok === 1 ? '' : 's'}`, 'success');
    setIds([]);
  };

  const revoke = (g: FolderAccessGrant) =>
    openConfirm({
      title: 'Revoke this grant?',
      message: inherits
        ? `${label(g)} loses its "${g.permission}" grant. Nothing changes while the folder inherits the cabinet’s access.`
        : `${label(g)} loses "${g.permission}" on this folder and its sub-folders.`,
      confirmLabel: 'Revoke',
      danger: true,
      onConfirm: () => revokeAccess.mutateAsync({ folderId, grantId: g.id }).catch(() => {}),
    });

  const cols: Column<FolderAccessGrant>[] = [
    { key: 'roleId', label: 'Grantee', render: (g) => <b>{label(g)}</b> },
    {
      key: 'permission',
      label: 'Permission',
      render: (g) => <span className="badge b-urg-low">{g.permission}</span>,
    },
    {
      key: 'id',
      label: '',
      render: (g) => (
        <button className="btn btn-ghost btn-sm" onClick={() => revoke(g)}>
          Revoke
        </button>
      ),
    },
  ];

  const pickerOptions = targetType === 'role' ? roleOptions : userOptions;

  return (
    <div className="card mb-4">
      <div className="card-head">
        <span className="h3">Access grants</span>
      </div>
      <div className="card-body" style={{ paddingBottom: 0 }}>
        {inherits ? (
          <div className="banner warning">
            These grants have no effect while the folder inherits the cabinet&rsquo;s access. A
            client administrator can turn inheritance off to apply them.
          </div>
        ) : (
          <p className="caption mb-4">
            Grants restrict, never raise: each person gets the lower of their cabinet level and
            their best grant here.
          </p>
        )}
      </div>
      {loading ? (
        <SkeletonTable columns={['Grantee', 'Permission', '']} rows={3} />
      ) : (
        <Table cols={cols} rows={grants ?? []} emptyMsg="No grants on this folder yet." />
      )}

      <div className="card-body" style={{ borderTop: '1px solid var(--border)' }}>
        <div className="h3 mb-2">Add a grant</div>
        {!canListRoles && !canListUsers ? (
          <p className="caption">
            Your role can&rsquo;t list roles or users, so you can&rsquo;t add grants here. Ask a
            client administrator.
          </p>
        ) : (
          <div className="grid" style={{ gap: 12, maxWidth: 520 }}>
            <div className="field" style={{ marginBottom: 0 }}>
              <label htmlFor="grant-permission">Permission</label>
              <select
                id="grant-permission"
                className="input"
                value={permission}
                onChange={(e) => setPermission(e.target.value as CabinetAccessPermission)}
              >
                {levels.map((p) => (
                  <option key={p.value} value={p.value}>
                    {p.label}
                  </option>
                ))}
              </select>
              {!isAdmin && (
                <div className="help">You can grant up to your own level on this folder.</div>
              )}
            </div>
            <div className="field" style={{ marginBottom: 0 }}>
              <label htmlFor="grant-target">Grant to</label>
              <select
                id="grant-target"
                className="input"
                value={targetType}
                onChange={(e) => {
                  setTargetType(e.target.value as 'role' | 'user');
                  setIds([]);
                }}
              >
                {canListRoles && <option value="role">Roles</option>}
                {canListUsers && <option value="user">Specific users</option>}
              </select>
            </div>
            <div className="field" style={{ marginBottom: 0 }}>
              <label>{targetType === 'role' ? 'Roles' : 'Users'}</label>
              <Combobox
                multiple
                options={pickerOptions}
                value={ids}
                onChange={(v) => setIds(v as string[])}
                placeholder={targetType === 'role' ? 'Select roles…' : 'Select users…'}
                searchPlaceholder={targetType === 'role' ? 'Search roles…' : 'Search users…'}
              />
              <div className="help">
                {targetType === 'role'
                  ? isAdmin
                    ? 'Client admins always reach every folder, so that role isn’t listed.'
                    : 'Roles you hold aren’t listed: you can’t grant access to yourself.'
                  : 'You and client admins aren’t listed.'}
              </div>
            </div>
            <div>
              <button
                className="btn btn-primary btn-sm"
                onClick={submit}
                disabled={busy || ids.length === 0}
              >
                {busy ? 'Granting…' : 'Add grant'}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
