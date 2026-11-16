'use client';

import React, { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { MoreVertical } from 'lucide-react';

export interface RowAction {
  key: string;
  label: string;
  icon?: React.ReactNode;
  onSelect: () => void;
  disabled?: boolean;
  /** Tooltip, e.g. why it's disabled. */
  title?: string;
  danger?: boolean;
  /** A divider above this item. */
  separatorBefore?: boolean;
}

/** A ⋮ button that opens a menu of a row's actions; renders nothing when there are none. */
export function RowActionsMenu({ actions, label }: { actions: RowAction[]; label: string }) {
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null);
  const btnRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  const close = useCallback((refocus = false) => {
    setOpen(false);
    setPos(null);
    if (refocus) btnRef.current?.focus();
  }, []);

  // Measured after render: right-aligned to the button, and above it when there's no room below.
  useLayoutEffect(() => {
    if (!open) return;
    const b = btnRef.current?.getBoundingClientRect();
    const m = menuRef.current;
    if (!b || !m) return;
    const left = Math.min(Math.max(8, b.right - m.offsetWidth), window.innerWidth - m.offsetWidth - 8);
    const below = b.bottom + 6;
    const top =
      below + m.offsetHeight > window.innerHeight - 8 ? Math.max(8, b.top - 6 - m.offsetHeight) : below;
    setPos({ top, left });
  }, [open]);

  useEffect(() => {
    if (!pos) return;
    menuRef.current?.querySelector<HTMLButtonElement>('[role="menuitem"]:not(:disabled)')?.focus();
  }, [pos]);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      const t = e.target as Node;
      if (!menuRef.current?.contains(t) && !btnRef.current?.contains(t)) close();
    };
    const onScroll = () => close();
    document.addEventListener('mousedown', onDown);
    window.addEventListener('scroll', onScroll, true);
    window.addEventListener('resize', onScroll);
    return () => {
      document.removeEventListener('mousedown', onDown);
      window.removeEventListener('scroll', onScroll, true);
      window.removeEventListener('resize', onScroll);
    };
  }, [open, close]);

  const onMenuKey = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      e.preventDefault();
      close(true);
      return;
    }
    if (e.key === 'Tab') {
      close();
      return;
    }
    if (e.key !== 'ArrowDown' && e.key !== 'ArrowUp' && e.key !== 'Home' && e.key !== 'End') return;
    e.preventDefault();
    const items = Array.from(
      menuRef.current?.querySelectorAll<HTMLButtonElement>('[role="menuitem"]:not(:disabled)') ?? [],
    );
    if (!items.length) return;
    const i = items.indexOf(document.activeElement as HTMLButtonElement);
    const next =
      e.key === 'Home'
        ? 0
        : e.key === 'End'
          ? items.length - 1
          : (i + (e.key === 'ArrowDown' ? 1 : -1) + items.length) % items.length;
    items[next].focus();
  };

  if (!actions.length) return null;

  return (
    <>
      <button
        ref={btnRef}
        type="button"
        className="btn btn-secondary btn-sm"
        style={{ width: 32, padding: 0, justifyContent: 'center' }}
        aria-label={label}
        title={label}
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={(e) => {
          e.stopPropagation();
          if (open) close();
          else setOpen(true);
        }}
      >
        <MoreVertical size={16} />
      </button>
      {open &&
        createPortal(
          <div
            ref={menuRef}
            className="menu"
            role="menu"
            aria-label={label}
            onKeyDown={onMenuKey}
            // Portal events still bubble to the table row in React's tree.
            onClick={(e) => e.stopPropagation()}
            style={{
              position: 'fixed',
              top: pos?.top ?? 0,
              left: pos?.left ?? 0,
              right: 'auto',
              minWidth: 220,
              visibility: pos ? 'visible' : 'hidden',
            }}
          >
            {actions.map((a) => (
              <React.Fragment key={a.key}>
                {a.separatorBefore && <div className="menu-sep" />}
                <button
                  type="button"
                  role="menuitem"
                  className={`menu-item${a.danger ? ' danger' : ''}`}
                  disabled={a.disabled}
                  title={a.title}
                  onClick={() => {
                    close();
                    a.onSelect();
                  }}
                >
                  {a.icon}
                  {a.label}
                </button>
              </React.Fragment>
            ))}
          </div>,
          document.body,
        )}
    </>
  );
}
