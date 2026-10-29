'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { Combobox, ComboboxOption } from '@/components/ui/Combobox';
import { useEligibleDelegates } from '@/apis/hooks/useDelegations';

const SEARCH_DEBOUNCE_MS = 300;
const MIN_SEARCH = 2;
const MAX_RESULTS = 20;

interface DelegatePickerProps {
  value: string;
  onChange: (userId: string) => void;
  placeholder?: string;
  ariaLabel?: string;
}

/**
 * Picks a delegate from `GET /delegations/eligible-users`, which needs only
 * `delegation:create` (not `user:view`) and already leaves out the caller.
 */
export function DelegatePicker({
  value,
  onChange,
  placeholder = 'Select a colleague…',
  ariaLabel,
}: DelegatePickerProps) {
  const [query, setQuery] = useState('');
  const [debounced, setDebounced] = useState('');

  useEffect(() => {
    const t = window.setTimeout(() => setDebounced(query.trim()), SEARCH_DEBOUNCE_MS);
    return () => window.clearTimeout(t);
  }, [query]);

  // One character is a 422 on the backend, so it waits for a second.
  const tooShort = debounced.length > 0 && debounced.length < MIN_SEARCH;
  const { data, isLoading, isError } = useEligibleDelegates(debounced, { enabled: !tooShort });
  const users = useMemo(() => data ?? [], [data]);

  const [picked, setPicked] = useState<ComboboxOption | null>(null);
  const pending = query.trim() !== debounced || isLoading;
  const options = useMemo<ComboboxOption[]>(
    () =>
      pending || tooShort
        ? []
        : users.map((u) => ({ value: u.id, label: u.name, hint: u.email })),
    [pending, tooShort, users],
  );

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
      loading={pending && !tooShort}
      knownOptions={picked ? [picked] : []}
      placeholder={placeholder}
      searchPlaceholder="Search by name or email…"
      emptyText={
        tooShort
          ? 'Type at least 2 characters.'
          : isError
            ? "Couldn't load people."
            : debounced
              ? 'No one matches.'
              : 'No people found.'
      }
      footer={
        !pending && !tooShort && users.length >= MAX_RESULTS
          ? `Showing the first ${MAX_RESULTS}. Keep typing to narrow it down.`
          : null
      }
      ariaLabel={ariaLabel}
    />
  );
}
