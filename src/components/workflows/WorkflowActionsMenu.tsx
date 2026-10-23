'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Copy, MoreVertical, RotateCcw, Trash2 } from 'lucide-react';
import { Icon } from '@/components/ui/Icons';
import type { WorkflowDefinition } from '@/types/models';

interface Props {
  status: WorkflowDefinition['status'];
  ariaLabel: string;
  onClone: () => void;
  onArchive: () => void;
  onDelete: () => void;
  /** Shown for an archived workflow only when given (the designer has its own button). */
  onUnarchive?: () => void;
  busy: { cloning: boolean; archiving: boolean; unarchiving: boolean; deleting: boolean };
  can: { create: boolean; archive: boolean; delete: boolean };
}

/** The ⋮ menu for one workflow: Clone, then whichever of Delete draft, Archive or
 *  Unarchive its status allows (the backend refuses the others with a 409). */
export function WorkflowActionsMenu({
  status,
  ariaLabel,
  onClone,
  onArchive,
  onDelete,
  onUnarchive,
  busy,
  can,
}: Props) {
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);
  const btnRef = useRef<HTMLButtonElement>(null);
  const popRef = useRef<HTMLDivElement>(null);
  const [rect, setRect] = useState<DOMRect | null>(null);

  const syncRect = useCallback(() => {
    if (btnRef.current) setRect(btnRef.current.getBoundingClientRect());
  }, []);

  useEffect(() => {
    if (!open) return;
    syncRect();
    const onDown = (event: MouseEvent) => {
      const t = event.target as Node;
      if (wrapRef.current?.contains(t) || popRef.current?.contains(t)) return;
      setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('mousedown', onDown);
    window.addEventListener('scroll', syncRect, true);
    window.addEventListener('resize', syncRect);
    window.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDown);
      window.removeEventListener('scroll', syncRect, true);
      window.removeEventListener('resize', syncRect);
      window.removeEventListener('keydown', onKey);
    };
  }, [open, syncRect]);

  const run = (action: () => void) => () => {
    setOpen(false);
    action();
  };

  return (
    <div ref={wrapRef} style={{ position: 'relative' }}>
      <button
        type="button"
        ref={btnRef}
        className="btn btn-secondary btn-sm"
        style={{ width: '32px', padding: 0, justifyContent: 'center' }}
        onClick={() => setOpen((v) => !v)}
        aria-label={ariaLabel}
        aria-haspopup="menu"
        aria-expanded={open}
      >
        <MoreVertical />
      </button>
      {open &&
        rect &&
        typeof document !== 'undefined' &&
        createPortal(
          <div
            className="menu"
            ref={popRef}
            style={{
              position: 'fixed',
              top: rect.bottom + 8,
              right: Math.max(8, window.innerWidth - rect.right),
              minWidth: '190px',
            }}
            role="menu"
          >
            <button
              className="menu-item"
              role="menuitem"
              disabled={busy.cloning || !can.create}
              title={!can.create ? "You don't have permission to create workflows" : undefined}
              onClick={run(onClone)}
            >
              <Copy size={15} /> Clone this workflow
            </button>
            {status === 'archived' && onUnarchive && (
              <button
                className="menu-item"
                role="menuitem"
                disabled={busy.unarchiving || !can.archive}
                title={
                  !can.archive ? "You don't have permission to unarchive workflows" : undefined
                }
                onClick={run(onUnarchive)}
              >
                <RotateCcw size={15} /> Unarchive
              </button>
            )}
            {status === 'draft' && (
              <>
                <div className="menu-sep"></div>
                <button
                  className="menu-item danger"
                  role="menuitem"
                  disabled={busy.deleting || !can.delete}
                  title={!can.delete ? "You don't have permission to delete workflows" : undefined}
                  onClick={run(onDelete)}
                >
                  <Trash2 size={15} /> Delete draft
                </button>
              </>
            )}
            {status === 'published' && (
              <>
                <div className="menu-sep"></div>
                <button
                  className="menu-item danger"
                  role="menuitem"
                  disabled={busy.archiving || !can.archive}
                  title={
                    !can.archive ? "You don't have permission to archive workflows" : undefined
                  }
                  onClick={run(onArchive)}
                >
                  <Icon name="alert" size={15} /> Archive
                </button>
              </>
            )}
          </div>,
          document.body,
        )}
    </div>
  );
}
