'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { Combobox, ComboboxOption } from '@/components/ui/Combobox';
import { useUser, useUserSearch } from '@/apis/hooks/useUsers';
import type { UserFilters } from '@/apis/services/users.service';

const SEARCH_DEBOUNCE_MS = 300;
const PAGE_SIZE = 20;

interface UserPickerProps {
  value: string;
  onChange: (userId: string) => void;
  /** Passed through to `GET /users`, e.g. `status: 'active'`. */
  filters?: Pick<UserFilters, 'status' | 'departmentId'>;
  /** Never offered, e.g. the signed-in user on a delegation. */
  excludeIds?: string[];
  /** Adds a first option with an empty value, e.g. "All actors" on a filter. */
  allLabel?: string;
  placeholder?: string;
  ariaLabel?: string;
  controlStyle?: React.CSSProperties;
  disabled?: boolean;
}

/**
 * Single-select person picker that searches `GET /users?search=` (name or
 * email) as the user types, so it reaches everyone in the caller's scope rather
 * than only the first page a plain `useUsers()` returns.
 */
export function UserPicker({
  value,
  onChange,
  filters,
  excludeIds,
  allLabel,
  placeholder = 'Select a person…',
  ariaLabel,
  controlStyle,
  disabled,
}: UserPickerProps) {
  const [query, setQuery] = useState('');
  const [debounced, setDebounced] = useState('');

  useEffect(() => {
    const t = window.setTimeout(() => setDebounced(query.trim()), SEARCH_DEBOUNCE_MS);
    return () => window.clearTimeout(t);
  }, [query]);

  const { data, isLoading, isError } = useUserSearch(debounced, { ...filters, limit: PAGE_SIZE });
  const users = useMemo(() => data?.data ?? [], [data]);
  const total = data?.pagination?.total ?? 0;

  // The pick stays labelled on the control after a later search drops it.
  const [picked, setPicked] = useState<ComboboxOption | null>(null);
  // A value set from outside, never picked here, is looked up by id.
  const needsLookup = !!value && value !== picked?.value && !users.some((u) => u.id === value);
  const { data: valueUser } = useUser(needsLookup ? value : '');

  const searching = query.trim() !== '';
  // Until the current query's results arrive, offer nothing to click.
  const pending = query.trim() !== debounced || isLoading;
  const options = useMemo(() => {
    if (pending) return [];
    const excluded = new Set(excludeIds);
    const list: ComboboxOption[] = users
      .filter((u) => !excluded.has(u.id))
      .map((u) => ({ value: u.id, label: u.name, hint: u.email }));
    return allLabel && !searching ? [{ value: '', label: allLabel }, ...list] : list;
  }, [pending, users, excludeIds, allLabel, searching]);

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
        setPicked(options.find((o) => o.value === id) ?? null);
        onChange(id);
      }}
      onQueryChange={setQuery}
      loading={pending}
      knownOptions={knownOptions}
      placeholder={allLabel ?? placeholder}
      searchPlaceholder="Search by name or email…"
      emptyText={
        isError ? "Couldn't load people." : debounced ? 'No one matches.' : 'No people found.'
      }
      footer={
        !pending && total > users.length
          ? `Showing ${users.length} of ${total}. Keep typing to narrow it down.`
          : null
      }
      ariaLabel={ariaLabel}
      controlStyle={controlStyle}
      disabled={disabled}
    />
  );
}
