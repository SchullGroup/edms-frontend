'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { Combobox, ComboboxOption } from '@/components/ui/Combobox';
import { useDocumentSearch } from '@/apis/hooks/useDocuments';

const SEARCH_DEBOUNCE_MS = 300;
const PAGE_SIZE = 20;

interface DocumentPickerProps {
  value: string;
  onChange: (documentId: string, document?: { id: string; title: string }) => void;
  /** Label for a value set from outside, e.g. the document already linked. */
  initialOption?: ComboboxOption | null;
  /** Never offered, e.g. documents already attached. */
  excludeIds?: string[];
  placeholder?: string;
  ariaLabel?: string;
  disabled?: boolean;
}

/** Single-select document picker over `GET /documents/search`; the reference shows as a hint
 *  but isn't searchable (the index holds title, OCR text and metadata values only). */
export function DocumentPicker({
  value,
  onChange,
  initialOption,
  excludeIds,
  placeholder = 'Search for a document…',
  ariaLabel,
  disabled,
}: DocumentPickerProps) {
  const [query, setQuery] = useState('');
  const [debounced, setDebounced] = useState('');

  useEffect(() => {
    const t = window.setTimeout(() => setDebounced(query.trim()), SEARCH_DEBOUNCE_MS);
    return () => window.clearTimeout(t);
  }, [query]);

  const { data, isLoading, isError } = useDocumentSearch(debounced, { limit: PAGE_SIZE });
  const [picked, setPicked] = useState<ComboboxOption | null>(null);
  const pending = !!debounced && (query.trim() !== debounced || isLoading);
  const found = data?.data ?? [];
  const total = data?.pagination?.total ?? 0;

  const options = useMemo<ComboboxOption[]>(() => {
    if (pending || !debounced) return [];
    const excluded = new Set(excludeIds);
    return (data?.data ?? [])
      .filter((d) => !excluded.has(d.id))
      .map((d) => ({ value: d.id, label: d.title, hint: d.referenceNumber ?? undefined }));
  }, [pending, debounced, data, excludeIds]);

  const knownOptions = [picked, initialOption].filter(Boolean) as ComboboxOption[];

  return (
    <Combobox
      options={options}
      value={value}
      onChange={(v) => {
        const id = v as string;
        const option = options.find((o) => o.value === id) ?? null;
        setPicked(option);
        onChange(id, option ? { id, title: option.label } : undefined);
      }}
      onQueryChange={setQuery}
      loading={pending}
      knownOptions={knownOptions}
      disabled={disabled}
      footer={
        !pending && debounced && total > found.length
          ? `Showing ${found.length} of ${total}. Keep typing to narrow it down.`
          : null
      }
      placeholder={placeholder}
      searchPlaceholder="Title or text…"
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
