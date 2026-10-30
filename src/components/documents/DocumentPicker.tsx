'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { Combobox, ComboboxOption } from '@/components/ui/Combobox';
import { useDocumentSearch } from '@/apis/hooks/useDocuments';

const SEARCH_DEBOUNCE_MS = 300;

interface DocumentPickerProps {
  value: string;
  onChange: (documentId: string) => void;
  /** Label for a value set from outside, e.g. the document already linked. */
  initialOption?: ComboboxOption | null;
  placeholder?: string;
  ariaLabel?: string;
}

/** Single-select document picker over `GET /documents/search` (title, reference or text). */
export function DocumentPicker({
  value,
  onChange,
  initialOption,
  placeholder = 'Search for a document…',
  ariaLabel,
}: DocumentPickerProps) {
  const [query, setQuery] = useState('');
  const [debounced, setDebounced] = useState('');

  useEffect(() => {
    const t = window.setTimeout(() => setDebounced(query.trim()), SEARCH_DEBOUNCE_MS);
    return () => window.clearTimeout(t);
  }, [query]);

  const { data, isLoading, isError } = useDocumentSearch(debounced, { limit: 20 });
  const [picked, setPicked] = useState<ComboboxOption | null>(null);
  const pending = !!debounced && (query.trim() !== debounced || isLoading);

  const options = useMemo<ComboboxOption[]>(
    () =>
      pending || !debounced
        ? []
        : (data?.data ?? []).map((d) => ({ value: d.id, label: d.title, hint: d.referenceNumber })),
    [pending, debounced, data],
  );

  const knownOptions = [picked, initialOption].filter(Boolean) as ComboboxOption[];

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
      placeholder={placeholder}
      searchPlaceholder="Title, reference or text…"
      emptyText={
        isError
          ? "Couldn't search documents."
          : debounced
            ? 'No documents match.'
            : 'Type to search documents.'
      }
      ariaLabel={ariaLabel}
    />
  );
}
