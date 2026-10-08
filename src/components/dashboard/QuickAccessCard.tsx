'use client';

import { useRouter } from 'next/navigation';
import { useStore } from '@/store/useStore';
import { usePermissions } from '@/hooks/usePermissions';
import { Icon } from '@/components/ui/Icons';
import { timeAgo } from '@/utils/helpers';
import type { DocumentShortcut, SavedSearch } from '@/types/models';

const EMPTY_DOCS: DocumentShortcut[] = [];
const EMPTY_SEARCHES: SavedSearch[] = [];

/** `/search` reads these query params (see its `fromParam` filters). */
function savedSearchHref(s: SavedSearch): string {
  const params = new URLSearchParams();
  if (s.q) params.set('q', s.q);
  if (s.filters.cabinetId) params.set('cabinet', s.filters.cabinetId);
  if (s.filters.documentType) params.set('type', s.filters.documentType);
  if (s.filters.status) params.set('status', s.filters.status);
  if (s.filters.confidentiality) params.set('confidentiality', s.filters.confidentiality);
  if (s.filters.urgency) params.set('urgency', s.filters.urgency);
  const qs = params.toString();
  return qs ? `/search?${qs}` : '/search';
}

/**
 * Dashboard shortcuts: pinned and recently opened documents and saved
 * searches, plus (on the staff dashboard) common actions. The lists live in
 * the browser, per user — the API has no favourites or view-history endpoint.
 *
 * `showActions` is for the staff dashboard only: its buttons go to staff pages
 * (`/staff/tasks`, `/staff/cabinets`), and other portals have their own nav.
 */
export function QuickAccessCard({ showActions = true }: { showActions?: boolean }) {
  const router = useRouter();
  const { can } = usePermissions();
  const me = useStore((s) => s.currentUser);
  const pinned = useStore((s) => (me ? s.pinnedDocuments[me.id] : undefined)) ?? EMPTY_DOCS;
  const recent = useStore((s) => (me ? s.recentDocuments[me.id] : undefined)) ?? EMPTY_DOCS;
  const searches = useStore((s) => (me ? s.savedSearches[me.id] : undefined)) ?? EMPTY_SEARCHES;

  const actions = !showActions
    ? []
    : ([
        can('document', 'create') && { label: 'Upload', icon: 'upload', to: '/upload' },
        { label: 'Search', icon: 'search', to: '/search' },
        { label: 'My tasks', icon: 'inbox', to: '/staff/tasks' },
        { label: 'Cabinets', icon: 'cabinet', to: '/staff/cabinets' },
        { label: 'Circulars', icon: 'speaker', to: '/circulars' },
      ].filter(Boolean) as { label: string; icon: string; to: string }[]);

  const recentNotPinned = recent.filter((r) => !pinned.some((p) => p.id === r.id)).slice(0, 5);

  const list = (
    title: string,
    items: { key: string; label: string; meta?: string; to: string }[],
    empty: string,
  ) => (
    <div style={{ minWidth: 0 }}>
      <div className="caption mb-2" style={{ fontWeight: 700 }}>
        {title}
      </div>
      {items.length ? (
        items.map((it) => (
          <div
            key={it.key}
            className="metric-li"
            style={{ cursor: 'pointer' }}
            role="link"
            tabIndex={0}
            onClick={() => router.push(it.to)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') router.push(it.to);
            }}
          >
            <span
              style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
              title={it.label}
            >
              {it.label}
            </span>
            {it.meta && <span className="caption">{it.meta}</span>}
          </div>
        ))
      ) : (
        <p className="caption">{empty}</p>
      )}
    </div>
  );

  return (
    <div className="card">
      <div className="card-head">
        <span className="h3">Quick access</span>
        <div className="flex gap-2" style={{ flexWrap: 'wrap' }}>
          {actions.map((a) => (
            <button
              key={a.to}
              className="btn btn-secondary btn-sm"
              onClick={() => router.push(a.to)}
            >
              <Icon name={a.icon} size={13} /> {a.label}
            </button>
          ))}
        </div>
      </div>
      <div className="card-body grid cols-3" style={{ gap: '20px' }}>
        {list(
          'Pinned documents',
          pinned.map((d) => ({ key: d.id, label: d.title, to: `/doc/${d.id}` })),
          'Pin a document from its page to keep it here.',
        )}
        {list(
          'Recently opened',
          recentNotPinned.map((d) => ({
            key: d.id,
            label: d.title,
            meta: timeAgo(d.at),
            to: `/doc/${d.id}`,
          })),
          'Documents you open show up here.',
        )}
        {list(
          'Saved searches',
          searches.map((s) => ({ key: s.id, label: s.name, to: savedSearchHref(s) })),
          'Save a search on the Search page to rerun it from here.',
        )}
      </div>
    </div>
  );
}
