'use client';

import React, { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useUIStore } from '@/store/useUIStore';
import { usePermissions } from '@/hooks/usePermissions';
import { useAccessRules, useRemoveAccessRule } from '@/apis/hooks/useAccessRules';
import { useUsersByIds } from '@/apis/hooks/useUsers';
import { Table, Column } from '@/components/ui/Table';
import { Icon } from '@/components/ui/Icons';
import { SkeletonTable } from '@/components/common/Skeleton';
import { ErrorMessage } from '@/components/common/ErrorMessage';
import { describeRule } from '@/components/accessRules/accessRuleLabels';
import { AccessRule } from '@/types/models';
import { fmtDateTime } from '@/utils/helpers';

/**
 * IP and country rules (`/access-rules`, PR #67). The API checks them on every request,
 * before sign-in, so a wrong allow list can shut everyone out.
 */
export default function AccessRulesPage() {
  const router = useRouter();
  const { setPageTitle, openConfirm } = useUIStore();
  const { can } = usePermissions();
  const canCreate = can('access_rule', 'create');
  const canDelete = can('access_rule', 'delete');

  const { data: rules = [], isLoading, isError, error, refetch } = useAccessRules();
  const removeRule = useRemoveAccessRule();
  const { users } = useUsersByIds(rules.map((r) => r.createdBy));

  useEffect(() => {
    setPageTitle('IP & Country Rules');
  }, [setPageTitle]);

  const allowRules = rules.filter((r) => r.effect === 'allow');

  const handleRemove = (r: AccessRule) => {
    const sameAllowList = allowRules.filter((a) => a.ruleType === r.ruleType);
    const message =
      r.effect === 'deny'
        ? `${r.value} will be able to reach the system again.`
        : sameAllowList.length > 1
          ? `The allow list gets shorter. Anyone connecting from outside the remaining ${r.ruleType === 'ip' ? 'addresses' : 'countries'}, you included, is shut out at once. The server doesn't check this for a removal.`
          : `This is the last ${r.ruleType === 'ip' ? 'IP' : 'country'} allow rule, so every ${r.ruleType === 'ip' ? 'address' : 'country'} not blocked will be able to reach the system.`;
    openConfirm({
      title: `Remove "${describeRule(r)}"?`,
      message,
      confirmLabel: 'Remove rule',
      danger: true,
      onConfirm: () => removeRule.mutateAsync(r.id).then(() => {}),
    });
  };

  const cols: Column<AccessRule>[] = [
    {
      key: 'value',
      label: 'Rule',
      render: (r) => (
        <span className="flex items-center gap-2">
          <span
            className={`badge ${r.effect === 'allow' ? 'b-status-closed' : 'b-status-overdue'}`}
          >
            {r.effect === 'allow' ? 'Allow' : 'Block'}
          </span>
          <span style={{ fontWeight: 600 }}>{describeRule(r).replace(/^(Allow|Block) /, '')}</span>
        </span>
      ),
    },
    {
      key: 'ruleType',
      label: 'Type',
      render: (r) => (r.ruleType === 'ip' ? 'IP address or range' : 'Country'),
    },
    {
      key: 'description',
      label: 'Note',
      render: (r) => <span style={{ fontSize: '12px' }}>{r.description || '—'}</span>,
    },
    {
      key: 'createdBy',
      label: 'Added by',
      render: (r) => users.get(r.createdBy)?.name ?? '—',
    },
    { key: 'createdAt', label: 'Added', render: (r) => fmtDateTime(r.createdAt) },
    {
      key: 'id',
      label: '',
      render: (r) =>
        canDelete ? (
          <button
            className="btn btn-secondary btn-sm"
            disabled={removeRule.isPending}
            onClick={(e) => {
              e.stopPropagation();
              handleRemove(r);
            }}
          >
            Remove
          </button>
        ) : null,
    },
  ];

  const status = (error as any)?.response?.status;

  return (
    <div>
      <div className="page-head">
        <div>
          <div className="page-title">IP & Country Rules</div>
          <div className="page-sub">
            Checked on every request, sign-in included. A block rule turns away the address, range
            or country it names. Once any allow rule exists, everything it doesn’t name is turned
            away.
          </div>
        </div>
        {canCreate && (
          <div className="actions">
            <button
              className="btn btn-primary"
              onClick={() => router.push('/admin/access-rules/new')}
            >
              <Icon name="plus" size={14} /> Add rule
            </button>
          </div>
        )}
      </div>

      <div className="banner warning mb-4">
        <span style={{ marginRight: '8px' }}>
          <Icon name="shield" size={15} />
        </span>
        Signing in goes through this web app’s own server, so the API sees that server’s address for
        it, not the user’s. An IP allow list must include the web app server’s address, or nobody
        can sign in. The server refuses a new rule that would block your own browser, but not one
        that would block the web app server, and not a removal.
      </div>

      <div className="card">
        <div className="card-head">
          <span className="h3">
            {rules.length} rule{rules.length === 1 ? '' : 's'}
          </span>
        </div>
        {isLoading ? (
          <SkeletonTable columns={['Rule', 'Type', 'Note', 'Added by', 'Added', '']} rows={3} />
        ) : isError ? (
          <ErrorMessage
            message={
              status === 403
                ? "You don't have permission to view access rules."
                : 'Failed to load access rules.'
            }
            retry={status === 403 ? undefined : refetch}
          />
        ) : rules.length === 0 ? (
          <div className="empty-state" style={{ padding: '32px' }}>
            No rules yet: every network and country can reach the system.
          </div>
        ) : (
          <Table cols={cols} rows={rules} />
        )}
      </div>
    </div>
  );
}
