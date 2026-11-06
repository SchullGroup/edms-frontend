'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { Combobox, ComboboxOption } from '@/components/ui/Combobox';
import { useUser, useUserSearch, useUsersByIds } from '@/apis/hooks/useUsers';
import type { UserFilters } from '@/apis/services/users.service';
import type { User } from '@/types/models';

const SEARCH_DEBOUNCE_MS = 300;
const PAGE_SIZE = 20;

type PickerFilters = Pick<UserFilters, 'status' | 'departmentId'>;

interface SearchOptions {
  filters?: PickerFilters;
  /** Never offered, e.g. the signed-in user on a delegation. */
  excludeIds?: string[];
  /** Hides results this returns false for, e.g. client admins on an access grant. */
  include?: (user: User) => boolean;
}

/** One debounced page of `GET /users?search=` as picker options. */
function usePeopleSearch({ filters, excludeIds, include }: SearchOptions) {
  const [query, setQuery] = useState('');
  const [debounced, setDebounced] = useState('');

  useEffect(() => {
    const t = window.setTimeout(() => setDebounced(query.trim()), SEARCH_DEBOUNCE_MS);
    return () => window.clearTimeout(t);
  }, [query]);

  const { data, isLoading, isError } = useUserSearch(debounced, { ...filters, limit: PAGE_SIZE });
  const users = useMemo(() => data?.data ?? [], [data]);
  const total = data?.pagination?.total ?? 0;

  // Until the current query's results arrive, offer nothing to click.
  const pending = query.trim() !== debounced || isLoading;
  const options = useMemo(() => {
    if (pending) return [];
    const excluded = new Set(excludeIds);
    return users
      .filter((u) => !excluded.has(u.id) && (!include || include(u)))
      .map((u): ComboboxOption => ({ value: u.id, label: u.name, hint: u.email }));
  }, [pending, users, excludeIds, include]);

  return {
    users,
    options,
    pending,
    searching: query.trim() !== '',
    setQuery,
    emptyText: isError ? "Couldn't load people." : debounced ? 'No one matches.' : 'No people found.',
    footer:
      !pending && total > users.length
        ? `Showing ${users.length} of ${total}. Keep typing to narrow it down.`
        : null,
  };
}

interface UserPickerProps extends SearchOptions {
  /** Leave unset inside a modal body: the picker then keeps its own value. */
  value?: string;
  onChange: (userId: string, user?: { id: string; name: string }) => void;
  /** Passed through to `GET /users`, e.g. `status: 'active'`. */
  filters?: PickerFilters;
  /** Adds a first option with an empty value, e.g. "All actors" on a filter. */
  allLabel?: string;
  placeholder?: string;
  ariaLabel?: string;
  controlStyle?: React.CSSProperties;
  disabled?: boolean;
}

/**
 * Single-select person picker that searches `GET /users?search=` (name or
 * email) as the user types, so it reaches everyone in the caller's scope.
 */
export function UserPicker({
  value: controlled,
  onChange,
  filters,
  excludeIds,
  include,
  allLabel,
  placeholder = 'Select a person…',
  ariaLabel,
  controlStyle,
  disabled,
}: UserPickerProps) {
  const [own, setOwn] = useState('');
  const value = controlled ?? own;
  const search = usePeopleSearch({ filters, excludeIds, include });

  // The pick stays labelled on the control after a later search drops it.
  const [picked, setPicked] = useState<ComboboxOption | null>(null);
  // A value set from outside, never picked here, is looked up by id.
  const needsLookup =
    !!value && value !== picked?.value && !search.users.some((u) => u.id === value);
  const { data: valueUser } = useUser(needsLookup ? value : '');

  const options =
    allLabel && !search.searching && !search.pending
      ? [{ value: '', label: allLabel }, ...search.options]
      : search.options;

  const knownOptions = [
    allLabel ? { value: '', label: allLabel } : null,
    picked,
    valueUser ? { value: valueUser.id, label: valueUser.name, hint: valueUser.email } : null,
  ].filter(Boolean) as ComboboxOption[];

  return (
    <Combobox
      options={options}
      value={value}
      onChange={(v) => {
        const id = v as string;
        const option = options.find((o) => o.value === id) ?? null;
        setPicked(option);
        setOwn(id);
        onChange(id, option && id ? { id, name: option.label } : undefined);
      }}
      onQueryChange={search.setQuery}
      loading={search.pending}
      knownOptions={knownOptions}
      placeholder={allLabel ?? placeholder}
      searchPlaceholder="Search by name or email…"
      emptyText={search.emptyText}
      footer={search.footer}
      ariaLabel={ariaLabel}
      controlStyle={controlStyle}
      disabled={disabled}
    />
  );
}

interface UserMultiPickerProps extends SearchOptions {
  /** Leave unset inside a modal body: the picker then keeps its own value. */
  value?: string[];
  onChange: (userIds: string[]) => void;
  filters?: PickerFilters;
  placeholder?: string;
  ariaLabel?: string;
  disabled?: boolean;
}

/** Multi-select version of {@link UserPicker}: same search, picks shown as chips. */
export function UserMultiPicker({
  value: controlled,
  onChange,
  filters,
  excludeIds,
  include,
  placeholder = 'Add people by name…',
  ariaLabel,
  disabled,
}: UserMultiPickerProps) {
  const [own, setOwn] = useState<string[]>([]);
  const value = controlled ?? own;
  const search = usePeopleSearch({ filters, excludeIds, include });

  // Chips keep their names once a later search no longer lists them.
  const [picked, setPicked] = useState<Record<string, ComboboxOption>>({});
  const unnamed = value.filter((id) => !picked[id] && !search.options.some((o) => o.value === id));
  const lookup = useUsersByIds(unnamed);

  const knownOptions = value.map(
    (id): ComboboxOption =>
      picked[id] ?? {
        value: id,
        label: lookup.users.get(id)?.name ?? (lookup.loading ? 'Loading…' : 'Unknown person'),
        hint: lookup.users.get(id)?.email,
      },
  );

  return (
    <Combobox
      multiple
      options={search.options}
      value={value}
      onChange={(v) => {
        const ids = v as string[];
        setPicked((prev) => {
          const next = { ...prev };
          search.options.forEach((o) => ids.includes(o.value) && (next[o.value] = o));
          return next;
        });
        setOwn(ids);
        onChange(ids);
      }}
      onQueryChange={search.setQuery}
      loading={search.pending}
      knownOptions={knownOptions}
      placeholder={placeholder}
      searchPlaceholder="Search by name or email…"
      emptyText={search.emptyText}
      footer={search.footer}
      ariaLabel={ariaLabel}
      disabled={disabled}
    />
  );
}
