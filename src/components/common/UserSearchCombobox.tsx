'use client';

import React, { useCallback, useEffect, useId, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Icon } from '@/components/ui/Icons';
import { useUser, useUserSearch } from '@/apis/hooks/useUsers';

const MIN_QUERY = 3;
const SEARCH_DEBOUNCE_MS = 300;
const PAGE_SIZE = 20;
const POP_MAX_HEIGHT = 300;
const POP_MIN_WIDTH = 280;
const GAP = 6;

interface UserSearchComboboxProps {
  /** The picked user's id; '' for none. */
  value: string;
  onChange: (userId: string) => void;
  placeholder?: string;
  ariaLabel?: string;
  /** 32px tall, for a toolbar of filters. */
  compact?: boolean;
  style?: React.CSSProperties;
}

/**
 * A search box that finds people as you type: from the third character it
 * searches `GET /users?search=` (name or email), and picking a result sets the
 * value. Emptying the box, or the clear button, sets it back to ''.
 */
export function UserSearchCombobox({
  value,
  onChange,
  placeholder = 'Search people…',
  ariaLabel,
  compact = false,
  style,
}: UserSearchComboboxProps) {
  const listId = useId();
  const [text, setText] = useState('');
  const [debounced, setDebounced] = useState('');
  const [open, setOpen] = useState(false);
  // The option highlighted by the arrow keys; -1 for none yet.
  const [active, setActive] = useState(-1);
  const [rect, setRect] = useState<DOMRect | null>(null);
  const rootRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const popRef = useRef<HTMLDivElement>(null);

  // The name of whoever's picked stays in the box; a value set from outside is
  // looked up once.
  const [picked, setPicked] = useState<{ id: string; name: string } | null>(null);
  const { data: valueUser } = useUser(value && value !== picked?.id ? value : '');
  const pickedName = !value ? '' : value === picked?.id ? picked.name : (valueUser?.name ?? '');
  useEffect(() => {
    setText(pickedName);
  }, [pickedName]);

  const term = text.trim();
  const editing = term !== pickedName;
  useEffect(() => {
    const t = window.setTimeout(() => setDebounced(term), SEARCH_DEBOUNCE_MS);
    return () => window.clearTimeout(t);
  }, [term]);

  const longEnough = debounced.length >= MIN_QUERY;
  const { data, isLoading, isError } = useUserSearch(
    debounced,
    { limit: PAGE_SIZE },
    { enabled: longEnough },
  );
  const pending = term !== debounced || (longEnough && isLoading);
  const users = useMemo(
    () => (longEnough && !pending ? (data?.data ?? []) : []),
    [longEnough, pending, data],
  );
  const total = data?.pagination?.total ?? 0;

  const syncRect = useCallback(() => {
    if (rootRef.current) setRect(rootRef.current.getBoundingClientRect());
  }, []);

  // Closing without a pick puts the picked name back in the box.
  const close = useCallback(() => {
    setOpen(false);
    setText(pickedName);
  }, [pickedName]);

  useEffect(() => {
    if (!open) return;
    syncRect();
    const onReflow = () => syncRect();
    const onDocPointer = (e: MouseEvent) => {
      const t = e.target as Node;
      if (rootRef.current?.contains(t) || popRef.current?.contains(t)) return;
      close();
    };
    window.addEventListener('scroll', onReflow, true);
    window.addEventListener('resize', onReflow);
    document.addEventListener('mousedown', onDocPointer);
    return () => {
      window.removeEventListener('scroll', onReflow, true);
      window.removeEventListener('resize', onReflow);
      document.removeEventListener('mousedown', onDocPointer);
    };
  }, [open, syncRect, close]);

  useEffect(() => setActive(-1), [users]);

  const pick = (user: { id: string; name: string }) => {
    setPicked(user);
    setText(user.name);
    setOpen(false);
    onChange(user.id);
  };

  const clear = () => {
    setPicked(null);
    setText('');
    setOpen(false);
    if (value) onChange('');
    inputRef.current?.focus();
  };

  const onInput = (next: string) => {
    setText(next);
    setOpen(true);
    if (!next.trim() && value) {
      setPicked(null);
      onChange('');
    }
  };

  const onKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault();
      if (!open) return setOpen(true);
      if (users.length === 0) return;
      setActive((i) =>
        e.key === 'ArrowDown'
          ? (i + 1) % users.length
          : (i <= 0 ? users.length : i) - 1,
      );
    } else if (e.key === 'Enter' && open && users[active]) {
      e.preventDefault();
      pick(users[active]);
    } else if (e.key === 'Escape' && open) {
      e.preventDefault();
      close();
    }
  };

  const message =
    term.length < MIN_QUERY
      ? `Type at least ${MIN_QUERY} characters to search.`
      : pending
        ? 'Searching…'
        : isError
          ? "Couldn't load people."
          : users.length === 0
            ? `No one matches “${term}”.`
            : null;

  let popStyle: React.CSSProperties | undefined;
  // Open while typing, or on focus with nothing picked (to show the hint).
  if (open && (editing || !value) && rect && typeof window !== 'undefined') {
    const spaceBelow = window.innerHeight - rect.bottom - GAP - 12;
    const spaceAbove = rect.top - GAP - 12;
    const flipUp = spaceBelow < POP_MAX_HEIGHT && spaceAbove > spaceBelow;
    const width = Math.max(rect.width, POP_MIN_WIDTH);
    popStyle = {
      position: 'fixed',
      left: Math.max(8, Math.min(rect.left, window.innerWidth - width - 8)),
      width,
      maxHeight: Math.min(POP_MAX_HEIGHT, Math.max(120, flipUp ? spaceAbove : spaceBelow)),
      ...(flipUp
        ? { bottom: window.innerHeight - rect.top + GAP }
        : { top: rect.bottom + GAP }),
    };
  }

  return (
    <div className={`searchbox ${compact ? 'is-compact' : ''}`} ref={rootRef} style={style}>
      <span className="searchbox-icon" aria-hidden="true">
        <Icon name="search" size={14} />
      </span>
      <input
        ref={inputRef}
        className="input searchbox-input"
        role="combobox"
        aria-label={ariaLabel}
        aria-expanded={!!popStyle}
        aria-controls={listId}
        aria-autocomplete="list"
        aria-activedescendant={popStyle && users[active] ? `${listId}-${users[active].id}` : undefined}
        placeholder={placeholder}
        value={text}
        onChange={(e) => onInput(e.target.value)}
        onFocus={() => setOpen(true)}
        onKeyDown={onKeyDown}
      />
      {text && (
        <button type="button" className="searchbox-clear" aria-label="Clear" onClick={clear}>
          <Icon name="x" size={12} />
        </button>
      )}

      {popStyle &&
        typeof document !== 'undefined' &&
        createPortal(
          <div className="combobox-pop searchbox-pop" ref={popRef} style={popStyle}>
            <div className="combobox-list" role="listbox" id={listId} aria-label={ariaLabel}>
              {message ? (
                <div className="combobox-empty">{message}</div>
              ) : (
                users.map((u, i) => (
                  <button
                    type="button"
                    key={u.id}
                    id={`${listId}-${u.id}`}
                    role="option"
                    aria-selected={u.id === value}
                    tabIndex={-1}
                    className={`combobox-opt ${i === active ? 'is-active' : ''} ${u.id === value ? 'is-selected' : ''}`}
                    onMouseEnter={() => setActive(i)}
                    onClick={() => pick(u)}
                  >
                    <span className="combobox-opt-check">
                      {u.id === value ? <Icon name="check" size={14} /> : null}
                    </span>
                    <span className="combobox-opt-label">
                      {u.name}
                      {u.email && <span className="combobox-opt-hint">{u.email}</span>}
                    </span>
                  </button>
                ))
              )}
            </div>
            {!message && total > users.length && (
              <div className="combobox-footer">
                Showing {users.length} of {total}. Keep typing to narrow it down.
              </div>
            )}
          </div>,
          document.body,
        )}
    </div>
  );
}
