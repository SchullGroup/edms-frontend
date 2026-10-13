'use client';

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Icon } from '@/components/ui/Icons';

export interface ComboboxOption {
  value: string;
  label: string;
  /** Secondary text shown under the label and also matched by the search. */
  hint?: string;
}

interface ComboboxProps {
  options: ComboboxOption[];
  /** `string` when `multiple` is false, `string[]` when it is true. */
  value: string | string[];
  onChange: (value: string | string[]) => void;
  /** Toggle between single-select and multi-select. Defaults to single. */
  multiple?: boolean;
  placeholder?: string;
  searchPlaceholder?: string;
  disabled?: boolean;
  emptyText?: string;
  /**
   * Server-side search. When set, every change to the search box is reported
   * here and `options` are shown as given — the caller has already filtered them.
   */
  onQueryChange?: (query: string) => void;
  /** Shows "Searching…" in place of the empty text while results load. */
  loading?: boolean;
  /** Labels for selected values that aren't in `options` (a server search that
   *  no longer contains the pick). Never listed. */
  knownOptions?: ComboboxOption[];
  /** A note under the list, e.g. that results are capped. */
  footer?: React.ReactNode;
  ariaLabel?: string;
  controlStyle?: React.CSSProperties;
}

const GAP = 6;
const MIN_POP_WIDTH = 280;

/**
 * Search + select control. In single mode `value`/`onChange` deal in a plain
 * string; in `multiple` mode they deal in a `string[]` and picking an option
 * toggles it without closing the popover. The multi capability is always
 * available — callers opt in per usage via the `multiple` prop.
 *
 * The dropdown is portalled to `document.body` and fixed-positioned against the
 * control, so it floats over dialogs instead of being clipped/scrolled inside a
 * modal body. It flips above the control when there isn't room below.
 */
export function Combobox({
  options,
  value,
  onChange,
  multiple = false,
  placeholder = 'Select…',
  searchPlaceholder = 'Search…',
  disabled = false,
  emptyText = 'No matches',
  onQueryChange,
  loading = false,
  knownOptions,
  footer,
  ariaLabel,
  controlStyle,
}: ComboboxProps) {
  const [open, setOpen] = useState(false);
  const [query, setQueryState] = useState('');
  const onQueryChangeRef = useRef(onQueryChange);
  useEffect(() => {
    onQueryChangeRef.current = onQueryChange;
  }, [onQueryChange]);
  const setQuery = useCallback((q: string) => {
    setQueryState(q);
    onQueryChangeRef.current?.(q);
  }, []);
  const [rect, setRect] = useState<DOMRect | null>(null);
  const rootRef = useRef<HTMLDivElement>(null);
  const controlRef = useRef<HTMLButtonElement>(null);
  const popRef = useRef<HTMLDivElement>(null);

  // An option whose value is '' (e.g. "All actors") is a real choice, shown as
  // selected rather than as the placeholder.
  const hasEmptyOption = [...options, ...(knownOptions ?? [])].some((o) => o.value === '');
  const selectedValues = useMemo(
    () =>
      multiple
        ? Array.isArray(value)
          ? value
          : []
        : value || hasEmptyOption
          ? [value as string]
          : [],
    [value, multiple, hasEmptyOption],
  );

  const selectedOptions = useMemo(
    () =>
      selectedValues
        .map(
          (v) =>
            options.find((o) => o.value === v) ?? knownOptions?.find((o) => o.value === v),
        )
        .filter(Boolean) as ComboboxOption[],
    [selectedValues, options, knownOptions],
  );

  const serverSearch = !!onQueryChange;
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q || serverSearch) return options;
    return options.filter(
      (o) =>
        o.label.toLowerCase().includes(q) ||
        (o.hint ? o.hint.toLowerCase().includes(q) : false),
    );
  }, [options, query, serverSearch]);

  const syncRect = useCallback(() => {
    if (controlRef.current) setRect(controlRef.current.getBoundingClientRect());
  }, []);

  const close = useCallback(() => {
    setOpen(false);
    setQuery('');
  }, [setQuery]);

  useEffect(() => {
    if (!open) return;
    syncRect();
    const onReflow = () => syncRect();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') close();
    };
    const onDocPointer = (e: MouseEvent) => {
      const t = e.target as Node;
      if (rootRef.current?.contains(t) || popRef.current?.contains(t)) return;
      close();
    };
    // capture scrolls on any ancestor (e.g. the modal body) too
    window.addEventListener('scroll', onReflow, true);
    window.addEventListener('resize', onReflow);
    window.addEventListener('keydown', onKey);
    document.addEventListener('mousedown', onDocPointer);
    return () => {
      window.removeEventListener('scroll', onReflow, true);
      window.removeEventListener('resize', onReflow);
      window.removeEventListener('keydown', onKey);
      document.removeEventListener('mousedown', onDocPointer);
    };
  }, [open, syncRect, close]);

  const toggleValue = (v: string) => {
    if (multiple) {
      const next = new Set(selectedValues);
      if (next.has(v)) next.delete(v);
      else next.add(v);
      onChange(Array.from(next));
    } else {
      onChange(v === value ? '' : v);
      close();
    }
  };

  const removeValue = (v: string) => {
    if (multiple) onChange(selectedValues.filter((x) => x !== v));
    else onChange('');
  };

  const summary =
    selectedOptions.length === 0
      ? placeholder
      : multiple
        ? `${selectedOptions.length} selected`
        : selectedOptions[0].label;

  let popStyle: React.CSSProperties | undefined;
  if (open && rect && typeof window !== 'undefined') {
    const spaceBelow = window.innerHeight - rect.bottom;
    const spaceAbove = rect.top;
    const flipUp = spaceBelow < 260 && spaceAbove > spaceBelow;
    const maxHeight = Math.max(160, (flipUp ? spaceAbove : spaceBelow) - GAP - 12);
    // A compact toolbar control still gets a popover wide enough to read names
    // and emails; it shifts left rather than run off the viewport.
    const width = Math.max(rect.width, MIN_POP_WIDTH);
    popStyle = {
      position: 'fixed',
      left: Math.max(8, Math.min(rect.left, window.innerWidth - width - 8)),
      width,
      maxHeight,
      ...(flipUp
        ? { bottom: window.innerHeight - rect.top + GAP }
        : { top: rect.bottom + GAP }),
    };
  }

  return (
    <div className={`combobox ${disabled ? 'is-disabled' : ''}`} ref={rootRef}>
      <button
        type="button"
        ref={controlRef}
        className="combobox-control input"
        style={controlStyle}
        aria-label={ariaLabel ? `${ariaLabel}: ${summary}` : undefined}
        disabled={disabled}
        onClick={() => setOpen((o) => !o)}
        aria-haspopup="listbox"
        aria-expanded={open}
      >
        <span className={selectedOptions.length ? '' : 'combobox-placeholder'}>{summary}</span>
        <span className="combobox-caret">
          <Icon name="chevD" size={14} />
        </span>
      </button>

      {multiple && selectedOptions.length > 0 && (
        <div className="combobox-chips">
          {selectedOptions.map((o) => (
            <span key={o.value} className="combobox-chip">
              {o.label}
              <button
                type="button"
                aria-label={`Remove ${o.label}`}
                onClick={() => removeValue(o.value)}
              >
                <Icon name="x" size={11} />
              </button>
            </span>
          ))}
        </div>
      )}

      {open &&
        popStyle &&
        typeof document !== 'undefined' &&
        createPortal(
          <div className="combobox-pop" role="listbox" ref={popRef} style={popStyle}>
            <div className="combobox-search">
              <input
                className="input"
                autoFocus
                placeholder={searchPlaceholder}
                value={query}
                onChange={(e) => setQuery(e.target.value)}
              />
            </div>
            <div className="combobox-list">
              {filtered.length === 0 && (
                <div className="combobox-empty">{loading ? 'Searching…' : emptyText}</div>
              )}
              {filtered.map((o) => {
                const isSel = selectedValues.includes(o.value);
                return (
                  <button
                    type="button"
                    key={o.value}
                    className={`combobox-opt ${isSel ? 'is-selected' : ''}`}
                    onClick={() => toggleValue(o.value)}
                    role="option"
                    aria-selected={isSel}
                  >
                    <span className="combobox-opt-check">
                      {isSel ? <Icon name="check" size={14} /> : null}
                    </span>
                    <span className="combobox-opt-label">
                      {o.label}
                      {o.hint && <span className="combobox-opt-hint">{o.hint}</span>}
                    </span>
                  </button>
                );
              })}
            </div>
            {footer && <div className="combobox-footer">{footer}</div>}
          </div>,
          document.body,
        )}
    </div>
  );
}
