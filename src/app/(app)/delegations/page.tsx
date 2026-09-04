'use client';

import React, { useEffect, useState } from 'react';
import { useStore } from '@/store/useStore';
import { useUIStore } from '@/store/useUIStore';
import {
  useDelegations,
  useCreateDelegation,
  useEndDelegation,
} from '@/apis/hooks/useDelegations';
import { useUsers } from '@/apis/hooks/useUsers';
import { useCabinets } from '@/apis/hooks/useCabinets';
import { Spinner } from '@/components/common/Spinner';
import { ErrorMessage } from '@/components/common/ErrorMessage';
import { EmptyState } from '@/components/ui/EmptyState';
import { Icon } from '@/components/ui/Icons';
import { Avatar } from '@/components/ui/Avatar';
import { fmtDateTime } from '@/utils/helpers';
import { Cabinet, Delegation, User } from '@/types/models';

/** A delegation is active only while `isActive` AND the current time falls
 *  inside its window — the backend flips `isActive` off once it ends, but a
 *  freshly-created future-dated one is `isActive: true` and not yet in force. */
function delegationPhase(d: Delegation): 'upcoming' | 'active' | 'ended' {
  const now = Date.now();
  if (!d.isActive) return 'ended';
  if (new Date(d.startsAt).getTime() > now) return 'upcoming';
  if (new Date(d.endsAt).getTime() < now) return 'ended';
  return 'active';
}

const PHASE_LABEL: Record<string, string> = { upcoming: 'Upcoming', active: 'Active', ended: 'Ended' };
const PHASE_CLASS: Record<string, string> = {
  upcoming: 'b-status-pending',
  active: 'b-status-closed',
  ended: 'b-status-on-hold',
};

interface DelegationFormValues {
  delegateId: string;
  startsAt: string;
  endsAt: string;
  scope: { cabinets: string[] } | null;
}

function scopeLabel(d: Delegation, cabinetNameById: Record<string, string>): string {
  if (!d.scope) return 'All workflow tasks';
  const parts: string[] = [];
  if (d.scope.cabinets?.length) {
    parts.push(
      `Cabinets: ${d.scope.cabinets.map((id) => cabinetNameById[id] || id).join(', ')}`,
    );
  }
  if (d.scope.workflows?.length) {
    parts.push(`${d.scope.workflows.length} workflow${d.scope.workflows.length > 1 ? 's' : ''}`);
  }
  return parts.length ? parts.join(' · ') : 'All workflow tasks';
}

export default function DelegationsPage() {
  const { currentUser } = useStore();
  const { setPageTitle, openModal, closeModal, addToast } = useUIStore();

  const { data, isLoading, isError, refetch } = useDelegations({ scope: 'mine', limit: 100 });
  const { data: usersData, isLoading: isLoadingUsers } = useUsers();
  const { data: cabinetsData, isLoading: isLoadingCabinets } = useCabinets();

  const createDelegation = useCreateDelegation();
  const endDelegation = useEndDelegation();

  useEffect(() => {
    setPageTitle('Delegations');
  }, [setPageTitle]);

  if (!currentUser) return null;

  const delegations = data?.data || [];
  const users = usersData?.data || [];
  const cabinets = cabinetsData?.data || [];
  const cabinetNameById = Object.fromEntries(cabinets.map((c) => [c.id, c.name]));

  const delegatedByMe = delegations.filter((d) => d.delegatorId === currentUser.id);
  const delegatedToMe = delegations.filter((d) => d.delegateId === currentUser.id);
  const userById = Object.fromEntries(users.map((u) => [u.id, u]));

  const openCreateModal = () => {
    // The scope-mode toggle needs to conditionally show the cabinet checklist,
    // which a plain closure-over-variables form (the pattern the rest of this
    // codebase's modals use) can't do without a re-render. `formState` is a
    // real React component with its own state; `formRef` is how the "Create
    // delegation" action — declared outside that component, in `actions` —
    // reads its current values at submit time.
    const formRef: { current: DelegationFormValues } = {
      current: { delegateId: '', startsAt: '', endsAt: '', scope: null },
    };

    openModal({
      title: 'New out-of-office delegation',
      body: (
        <DelegationForm
          users={users.filter((u) => u.status === 'active' && u.id !== currentUser.id)}
          cabinets={cabinets}
          formRef={formRef}
        />
      ),
      actions: [
        { label: 'Cancel' },
        {
          label: 'Create delegation',
          kind: 'btn-primary',
          onClick: () => {
            const { delegateId, startsAt, endsAt, scope } = formRef.current;
            if (!delegateId) {
              addToast('Please select a delegate', 'error');
              return;
            }
            if (!startsAt || !endsAt) {
              addToast('Please set a start and end date', 'error');
              return;
            }
            const start = new Date(startsAt);
            const end = new Date(endsAt);
            if (end <= start) {
              addToast('End date must be after the start date', 'error');
              return;
            }
            createDelegation.mutate(
              { delegateId, startsAt: start.toISOString(), endsAt: end.toISOString(), scope },
              { onSuccess: () => closeModal() },
            );
          },
        },
      ],
    });
  };

  const handleEnd = (d: Delegation) => {
    endDelegation.mutate(d.id);
  };

  const renderRow = (d: Delegation, direction: 'out' | 'in') => {
    const other = direction === 'out' ? userById[d.delegateId] : userById[d.delegatorId];
    const phase = delegationPhase(d);
    return (
      <div key={d.id} className="task-row" style={{ alignItems: 'flex-start' }}>
        <div className="flex aic g12" style={{ flex: 1 }}>
          <Avatar user={{ name: other?.name || 'Unknown' }} />
          <div>
            <div style={{ fontWeight: 600 }}>
              {direction === 'out' ? `To ${other?.name || 'Unknown'}` : `From ${other?.name || 'Unknown'}`}
            </div>
            <div className="caption">
              {fmtDateTime(d.startsAt)} → {fmtDateTime(d.endsAt)}
            </div>
            <div className="caption">{scopeLabel(d, cabinetNameById)}</div>
          </div>
        </div>
        <span className={`badge ${PHASE_CLASS[phase]}`}>{PHASE_LABEL[phase]}</span>
        {direction === 'out' && phase !== 'ended' && (
          <button
            className="btn btn-secondary btn-sm"
            style={{ marginLeft: '12px' }}
            onClick={() => handleEnd(d)}
            disabled={endDelegation.isPending}
          >
            End now
          </button>
        )}
      </div>
    );
  };

  return (
    <div>
      <div className="page-head">
        <div>
          <div className="page-title">Delegations</div>
          <div className="page-sub">
            Hand your workflow tasks to a colleague while you're out, or see what's been handed to
            you.
          </div>
        </div>
        <div className="actions">
          <button className="btn btn-accent" onClick={openCreateModal}>
            <Icon name="plus" size={15} /> New delegation
          </button>
        </div>
      </div>

      {isLoading || isLoadingUsers || isLoadingCabinets ? (
        <Spinner />
      ) : isError ? (
        <ErrorMessage message="Failed to load delegations" retry={() => refetch()} />
      ) : (
        <>
          <div className="card mb16">
            <div className="card-head">
              <span className="h3">
                <Icon name="swap" size={16} /> Delegated by you
              </span>
            </div>
            {delegatedByMe.length > 0 ? (
              <div className="rowlist">{delegatedByMe.map((d) => renderRow(d, 'out'))}</div>
            ) : (
              <EmptyState
                icon="swap"
                title="No delegations set up"
                message="Delegate your workflow tasks to a colleague before you go on leave."
              />
            )}
          </div>

          <div className="card">
            <div className="card-head">
              <span className="h3">
                <Icon name="inbox" size={16} /> Delegated to you
              </span>
            </div>
            {delegatedToMe.length > 0 ? (
              <div className="rowlist">{delegatedToMe.map((d) => renderRow(d, 'in'))}</div>
            ) : (
              <EmptyState
                icon="inbox"
                title="Nothing delegated to you"
                message="Tasks a colleague hands to you while they're away will show up here."
              />
            )}
          </div>
        </>
      )}
    </div>
  );
}

/**
 * Standalone form body for the "New delegation" modal. Owns its own state so
 * the cabinet checklist can show/hide reactively; writes every change into
 * `formRef` so the modal's "Create delegation" action (declared outside this
 * component) can read the current values without a submit handler of its own.
 */
function DelegationForm({
  users,
  cabinets,
  formRef,
}: {
  users: User[];
  cabinets: Cabinet[];
  formRef: { current: DelegationFormValues };
}) {
  const [scopeMode, setScopeMode] = useState<'all' | 'cabinets'>('all');
  const [selectedCabinets, setSelectedCabinets] = useState<Set<string>>(new Set());

  const commit = (patch: Partial<DelegationFormValues>) => {
    formRef.current = { ...formRef.current, ...patch };
  };

  const toggleCabinet = (id: string, checked: boolean) => {
    setSelectedCabinets((prev) => {
      const next = new Set(prev);
      if (checked) next.add(id);
      else next.delete(id);
      commit({ scope: next.size > 0 ? { cabinets: Array.from(next) } : null });
      return next;
    });
  };

  return (
    <div>
      <div className="field mb12">
        <label>
          Delegate to <span className="req">*</span>
        </label>
        <select className="input" onChange={(e) => commit({ delegateId: e.target.value })}>
          <option value="">Select a colleague...</option>
          {users.map((u) => (
            <option key={u.id} value={u.id}>
              {u.name}
            </option>
          ))}
        </select>
      </div>
      <div className="flex g12 mb12">
        <div className="field" style={{ flex: 1 }}>
          <label>
            Starts <span className="req">*</span>
          </label>
          <input
            className="input"
            type="datetime-local"
            onChange={(e) => commit({ startsAt: e.target.value })}
          />
        </div>
        <div className="field" style={{ flex: 1 }}>
          <label>
            Ends <span className="req">*</span>
          </label>
          <input
            className="input"
            type="datetime-local"
            onChange={(e) => commit({ endsAt: e.target.value })}
          />
        </div>
      </div>
      <div className="field mb12">
        <label>Applies to</label>
        <select
          className="input"
          value={scopeMode}
          onChange={(e) => {
            const mode = e.target.value as 'all' | 'cabinets';
            setScopeMode(mode);
            commit({ scope: mode === 'cabinets' && selectedCabinets.size > 0
              ? { cabinets: Array.from(selectedCabinets) }
              : null,
            });
          }}
        >
          <option value="all">All my workflow tasks</option>
          <option value="cabinets">Specific cabinets only</option>
        </select>
      </div>
      {scopeMode === 'cabinets' && (
        <div className="field mb12">
          <label>Cabinets</label>
          <div style={{ maxHeight: '140px', overflowY: 'auto' }}>
            {cabinets.map((c) => (
              <label key={c.id} className="flex aic g8" style={{ padding: '4px 0' }}>
                <input
                  type="checkbox"
                  checked={selectedCabinets.has(c.id)}
                  onChange={(e) => toggleCabinet(c.id, e.target.checked)}
                />
                {c.name}
              </label>
            ))}
          </div>
        </div>
      )}
      <p className="caption">
        Applies to workflow tasks you would otherwise be assigned — self-delegation isn't allowed.
      </p>
    </div>
  );
}
