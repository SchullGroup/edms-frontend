'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Icon } from '@/components/ui/Icons';
import { Copy, MoreVertical } from 'lucide-react';

export interface WorkflowToolbarProps {
  workflow: any;
  stageCount: number;
  nameDraft: string;
  onNameChange: (name: string) => void;
  nameDirty: boolean;
  onSaveName: () => void;
  saving: boolean;
  switcherWorkflows: any[];
  archivedCount: number;
  showArchived: boolean;
  onToggleShowArchived: () => void;
  onSwitchWorkflow: (id: string) => void;
  onCreateNew: () => void;
  onClone: () => void;
  onArchive: () => void;
  onPublish: () => void;
  creating: boolean;
  archiving: boolean;
  publishing: boolean;
}

/** A breadcrumb row (which workflow, tenant-wide) sits above a focused
 *  toolbar (this workflow). The old single row conflated "pick a workflow"
 *  with "act on this one" — Clone and Publish read as just more items in
 *  the same unlabeled cluster as the switcher. Splitting them into two
 *  visually distinct rows fixes that without hiding anything: New/Clone/
 *  Archive move into an overflow menu since they're occasional, Publish
 *  stays a primary button because it isn't. */
export function WorkflowToolbar({
  workflow,
  stageCount,
  nameDraft,
  onNameChange,
  nameDirty,
  onSaveName,
  saving,
  switcherWorkflows,
  archivedCount,
  showArchived,
  onToggleShowArchived,
  onSwitchWorkflow,
  onCreateNew,
  onClone,
  onArchive,
  onPublish,
  creating,
  archiving,
  publishing,
}: WorkflowToolbarProps) {
  const statusBadgeClass =
    workflow.status === 'published' ? 'b-status-closed' : workflow.status === 'archived' ? 'b-status-overdue' : 'b-status-pending';
  const statusLabel = workflow.status === 'published' ? 'Active' : workflow.status === 'archived' ? 'Archived' : 'Draft';

  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const menuBtnRef = useRef<HTMLButtonElement>(null);
  const menuPopRef = useRef<HTMLDivElement>(null);
  const [menuRect, setMenuRect] = useState<DOMRect | null>(null);

  const syncMenuRect = useCallback(() => {
    if (menuBtnRef.current) setMenuRect(menuBtnRef.current.getBoundingClientRect());
  }, []);

  useEffect(() => {
    if (!menuOpen) return;
    syncMenuRect();
    const handleClickOutside = (event: MouseEvent) => {
      const t = event.target as Node;
      if (menuRef.current?.contains(t) || menuPopRef.current?.contains(t)) return;
      setMenuOpen(false);
    };
    const onReflow = () => syncMenuRect();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setMenuOpen(false);
    };
    document.addEventListener('mousedown', handleClickOutside);
    window.addEventListener('scroll', onReflow, true);
    window.addEventListener('resize', onReflow);
    window.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      window.removeEventListener('scroll', onReflow, true);
      window.removeEventListener('resize', onReflow);
      window.removeEventListener('keydown', onKey);
    };
  }, [menuOpen, syncMenuRect]);

  // Flashes a brief "Saved" confirmation whenever a save that was in flight
  // completes, rather than leaving success entirely silent.
  const [justSaved, setJustSaved] = useState(false);
  const wasSaving = useRef(false);
  useEffect(() => {
    if (wasSaving.current && !saving) {
      setJustSaved(true);
      const t = setTimeout(() => setJustSaved(false), 1600);
      return () => clearTimeout(t);
    }
    wasSaving.current = saving;
  }, [saving]);

  return (
    <div className="wfd-toolbar">
      <div className="wfd-crumbrow">
        <span className="caption" style={{ fontWeight: 600 }}>
          Workflows
        </span>
        <Icon name="chevR" size={12} />
        <div className="wfd-crumb-switch">
          <select
            className="wfd-crumb-select"
            value={workflow.id}
            onChange={(e) => onSwitchWorkflow(e.target.value)}
            aria-label="Switch workflow"
          >
            {switcherWorkflows?.map((w) => (
              <option key={w.id} value={w.id}>
                {w.name} (v{w.version}){w.status === 'archived' ? ' — archived' : ''}
              </option>
            ))}
          </select>
        </div>
        {archivedCount > 0 && (
          <button type="button" className="caption wfd-archived-toggle" onClick={onToggleShowArchived}>
            {showArchived ? 'Hide' : 'Show'} archived ({archivedCount})
          </button>
        )}
      </div>

      <div className="wfd-toolrow">
        <div className="flex aic g8 wrap" style={{ minWidth: 0 }}>
          <input
            className="input"
            value={nameDraft}
            style={{ fontWeight: 700, width: '240px' }}
            onChange={(e) => onNameChange(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && nameDirty) onSaveName();
            }}
            aria-label="Workflow name"
          />
          <button type="button" className="btn btn-primary btn-sm" onClick={onSaveName} disabled={!nameDirty || saving}>
            {saving && nameDirty ? 'Saving…' : 'Save'}
          </button>
          <span className={`wfd-saved-pill ${justSaved ? 'show' : ''}`}>
            <Icon name="check" size={12} /> Saved
          </span>
          <span className={`badge ${statusBadgeClass}`}>
            {statusLabel} · v{workflow.version}
          </span>
          <span className="caption">
            {stageCount} stage{stageCount === 1 ? '' : 's'}
          </span>
        </div>

        <div className="flex aic g8">
          <button className="btn btn-primary btn-sm" onClick={onPublish} disabled={publishing || workflow.status === 'published'}>
            {workflow.status === 'published' ? 'Published' : 'Publish'}
          </button>
          <div ref={menuRef} style={{ position: 'relative' }}>
            <button
              type="button"
              ref={menuBtnRef}
              className="btn btn-secondary btn-sm"
              style={{ width: '32px', padding: 0, justifyContent: 'center' }}
              onClick={() => setMenuOpen((v) => !v)}
              aria-label="More workflow actions"
              aria-haspopup="menu"
              aria-expanded={menuOpen}
            >
              <MoreVertical />
            </button>
            {menuOpen &&
              menuRect &&
              typeof document !== 'undefined' &&
              createPortal(
              <div
                className="menu"
                ref={menuPopRef}
                style={{
                  position: 'fixed',
                  top: menuRect.bottom + 8,
                  right: Math.max(8, window.innerWidth - menuRect.right),
                  minWidth: '190px',
                }}
                role="menu"
              >
                <button
                  className="menu-item"
                  role="menuitem"
                  disabled={creating}
                  onClick={() => {
                    setMenuOpen(false);
                    onCreateNew();
                  }}
                >
                  <Icon name="plus" size={15} /> New workflow
                </button>
                <button
                  className="menu-item"
                  role="menuitem"
                  disabled={creating}
                  onClick={() => {
                    setMenuOpen(false);
                    onClone();
                  }}
                >
                  <Copy name="copy" size={15} /> Clone this workflow
                </button>
                {workflow.status !== 'archived' && (
                  <>
                    <div className="menu-sep"></div>
                    <button
                      className="menu-item danger"
                      role="menuitem"
                      disabled={archiving}
                      onClick={() => {
                        setMenuOpen(false);
                        onArchive();
                      }}
                    >
                      <Icon name="alert" size={15} /> Archive
                    </button>
                  </>
                )}
              </div>,
              document.body,
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
