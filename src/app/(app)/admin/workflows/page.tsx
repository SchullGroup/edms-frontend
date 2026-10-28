'use client';

import React, { Suspense, useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useUIStore } from '@/store/useUIStore';
import { useCreateWorkflow, useWorkflows } from '@/apis/hooks/useWorkflows';
import { usePermissions } from '@/hooks/usePermissions';
import { Icon } from '@/components/ui/Icons';
import { Table, Column } from '@/components/ui/Table';
import { Pagination } from '@/components/ui/Pagination';
import { SkeletonPage, SkeletonTable } from '@/components/common/Skeleton';
import { WorkflowActionsMenu } from '@/components/workflows/WorkflowActionsMenu';
import {
  unarchiveBlockedReason,
  useWorkflowActions,
} from '@/components/workflows/useWorkflowActions';
import { DEFAULT_WORKFLOW_DEFINITION } from '@/components/workflows/constants';
import { timeAgo } from '@/utils/helpers';
import type { WorkflowDefinition } from '@/types/models';

type StatusTab = WorkflowDefinition['status'];

const TABS: { value: StatusTab; label: string; empty: string }[] = [
  {
    value: 'published',
    label: 'Published',
    empty: 'No published workflows. Publish a draft to route documents through it.',
  },
  { value: 'draft', label: 'Drafts', empty: 'No drafts. New workflows and clones start here.' },
  { value: 'archived', label: 'Archived', empty: 'Nothing archived.' },
];
const PAGE_SIZE = 20;

/** The newer version that supersedes an archived one: the published one, else the latest. */
function replacedByVersion(w: WorkflowDefinition): number | null {
  if (w.status !== 'archived') return null;
  if (w.publishedVersion != null && w.publishedVersion > w.version) return w.publishedVersion;
  if (w.latestVersion !== undefined && w.latestVersion > w.version) return w.latestVersion;
  return null;
}

export default function WorkflowsPage() {
  // useSearchParams needs a Suspense boundary above it.
  return (
    <Suspense
      fallback={
        <SkeletonPage columns={['Name', 'Status', 'Version', 'Stages', 'Edited', '']} rows={6} />
      }
    >
      <WorkflowList />
    </Suspense>
  );
}

/** Every workflow, by status, with search; a row opens the designer. The tab and
 *  search live in the URL, so coming back from the designer lands where you were. */
function WorkflowList() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { setPageTitle } = useUIStore();
  const { can } = usePermissions();
  const canCreate = can('workflow', 'create');
  const actions = useWorkflowActions();
  const createMutation = useCreateWorkflow();

  const status = (TABS.find((t) => t.value === searchParams.get('status'))?.value ??
    'published') as StatusTab;
  const query = searchParams.get('q') ?? '';
  const [search, setSearch] = useState(query);
  const [page, setPage] = useState(1);

  const setParams = (next: { status?: StatusTab; q?: string }) => {
    const params = new URLSearchParams(searchParams.toString());
    if (next.status) params.set('status', next.status);
    if (next.q !== undefined) {
      if (next.q) params.set('q', next.q);
      else params.delete('q');
    }
    setPage(1);
    router.replace(`/admin/workflows?${params.toString()}`, { scroll: false });
  };

  // Debounce the search box so each keystroke isn't a request.
  useEffect(() => {
    if (search.trim() === query) return;
    const t = window.setTimeout(() => setParams({ q: search.trim() }), 300);
    return () => window.clearTimeout(t);
  }, [search]);

  const { data, isLoading, isError, isPlaceholderData, refetch } = useWorkflows({
    status,
    search: query || undefined,
    page,
    limit: PAGE_SIZE,
  });
  const workflows = data?.data || [];

  useEffect(() => {
    setPageTitle('Workflow Designer');
  }, [setPageTitle]);

  const open = (id: string) => router.push(`/admin/workflows/${id}`);

  const handleCreate = () => {
    createMutation.mutate(
      {
        name: 'New workflow',
        description: 'A new sequential workflow',
        definition: DEFAULT_WORKFLOW_DEFINITION,
      },
      { onSuccess: (wf) => open(wf.id) },
    );
  };

  const cols: Column<WorkflowDefinition>[] = [
    {
      key: 'name',
      label: 'Name',
      render: (w) => (
        <div style={{ minWidth: 0 }}>
          <Link href={`/admin/workflows/${w.id}`} className="font-semibold wf-name-link">
            {w.name}
          </Link>
          {w.description && <div className="caption truncate">{w.description}</div>}
        </div>
      ),
    },
    {
      key: 'status',
      label: 'Status',
      render: (w) => (
        <span
          className={`badge ${w.status === 'published' ? 'b-status-closed' : w.status === 'archived' ? 'b-status-overdue' : 'b-status-pending'}`}
        >
          {w.status === 'published' ? 'Active' : w.status === 'archived' ? 'Archived' : 'Draft'}
        </span>
      ),
    },
    {
      key: 'version',
      label: 'Version',
      render: (w) => {
        const replacedBy = replacedByVersion(w);
        return (
          <div>
            v{w.version}
            {replacedBy && <div className="caption">Replaced by v{replacedBy}</div>}
          </div>
        );
      },
    },
    { key: 'definition', label: 'Stages', render: (w) => w.definition?.stages?.length ?? 0 },
    {
      key: 'updatedAt',
      label: 'Edited',
      render: (w) => {
        const at = Date.parse(w.updatedAt) || Date.parse(w.createdAt);
        if (!at) return <span className="caption">—</span>;
        return (
          <span className="caption" title={new Date(at).toLocaleString()}>
            {timeAgo(at)}
          </span>
        );
      },
    },
    {
      key: 'id',
      label: '',
      render: (w) => (
        <WorkflowActionsMenu
          status={w.status}
          ariaLabel={`More actions for ${w.name}`}
          onClone={() => actions.clone(w, open)}
          onArchive={() => actions.archive(w)}
          onUnarchive={() => actions.unarchive(w)}
          unarchiveBlocked={unarchiveBlockedReason(w, w.latestVersion, w.publishedVersion)}
          onDelete={() => actions.remove(w)}
          busy={actions}
          can={{
            create: canCreate,
            archive: can('workflow', 'archive'),
            delete: can('workflow', 'edit'),
          }}
        />
      ),
    },
  ];

  const tab = TABS.find((t) => t.value === status)!;
  const total = data?.pagination?.total;

  return (
    <div>
      <div className="page-head">
        <div>
          <div className="page-title">Workflows</div>
          <div className="page-sub">
            The routes documents take through review and approval. Open one to edit its stages.
          </div>
        </div>
        <div className="actions">
          <button
            className="btn btn-primary flex items-center"
            onClick={handleCreate}
            disabled={createMutation.isPending || !canCreate}
            title={!canCreate ? "You don't have permission to create workflows" : undefined}
          >
            <span style={{ marginRight: '8px' }}>
              <Icon name="plus" size={15} />
            </span>{' '}
            New workflow
          </button>
        </div>
      </div>

      <div className="card">
        <div className="card-head">
          <div className="seg" role="group" aria-label="Filter by status">
            {TABS.map((t) => (
              <button
                key={t.value}
                type="button"
                className={status === t.value ? 'active' : ''}
                aria-pressed={status === t.value}
                onClick={() => setParams({ status: t.value })}
              >
                {t.label}
                {status === t.value && total !== undefined ? ` · ${total}` : ''}
              </button>
            ))}
          </div>
          <input
            className="input"
            style={{ width: 240, height: '32px' }}
            type="search"
            placeholder="Search by name…"
            aria-label="Search workflows by name"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        {isLoading ? (
          <SkeletonTable columns={['Name', 'Status', 'Version', 'Stages', 'Edited', '']} rows={6} />
        ) : isError ? (
          <div className="card-body caption flex items-center gap-2">
            Couldn&apos;t load workflows.
            <button className="btn btn-ghost btn-sm" onClick={() => refetch()}>
              Try again
            </button>
          </div>
        ) : (
          <div
            aria-busy={isPlaceholderData}
            style={{ opacity: isPlaceholderData ? 0.6 : 1, transition: 'opacity 150ms ease-out' }}
          >
            <Table
              cols={cols}
              rows={workflows}
              onRow={(w) => open(w.id)}
              emptyMsg={
                query ? `No ${tab.label.toLowerCase()} workflows match "${query}".` : tab.empty
              }
            />
            {data?.pagination && data.pagination.totalPages > 1 && (
              <Pagination
                page={data.pagination.page}
                totalPages={data.pagination.totalPages}
                total={data.pagination.total}
                limit={data.pagination.limit}
                onPageChange={setPage}
              />
            )}
          </div>
        )}
      </div>
    </div>
  );
}
