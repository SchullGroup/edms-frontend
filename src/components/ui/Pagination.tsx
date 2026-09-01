import React from 'react';
import { Icon } from './Icons';

export interface PaginationProps {
  page: number;
  totalPages: number;
  total: number;
  limit: number;
  onPageChange: (page: number) => void;
}

/** Paired with a paginated list endpoint's `{page, limit, total, totalPages}`
 *  response — pass those straight through. Renders nothing when there's
 *  nothing to page through. */
export function Pagination({ page, totalPages, total, limit, onPageChange }: PaginationProps) {
  if (total === 0) return null;

  const from = (page - 1) * limit + 1;
  const to = Math.min(page * limit, total);
  const atStart = page <= 1;
  const atEnd = page >= totalPages;

  return (
    <div
      className="flex jcb aic wrap g12"
      style={{ padding: '12px 16px', borderTop: '1px solid var(--border)' }}
    >
      <span className="caption tnum">
        {from}–{to} of {total}
      </span>
      <div className="flex aic g8">
        <button
          type="button"
          className="icon-btn"
          disabled={atStart}
          aria-label="Previous page"
          onClick={() => onPageChange(page - 1)}
          style={atStart ? { opacity: 0.4, cursor: 'not-allowed' } : undefined}
        >
          <span style={{ display: 'inline-flex', transform: 'rotate(180deg)' }}>
            <Icon name="chevR" size={16} />
          </span>
        </button>
        <span className="caption tnum" style={{ minWidth: '84px', textAlign: 'center' }}>
          Page {page} of {totalPages}
        </span>
        <button
          type="button"
          className="icon-btn"
          disabled={atEnd}
          aria-label="Next page"
          onClick={() => onPageChange(page + 1)}
          style={atEnd ? { opacity: 0.4, cursor: 'not-allowed' } : undefined}
        >
          <Icon name="chevR" size={16} />
        </button>
      </div>
    </div>
  );
}
