import React, { useState } from 'react';
import { EmptyState } from './EmptyState';

export interface Column<T> {
  key: Extract<keyof T, string>;
  label: string;
  render?: (row: T) => React.ReactNode;
  sortable?: boolean;
  num?: boolean;
}

interface TableProps<T> {
  cols: Column<T>[];
  rows: T[];
  onRow?: (row: T) => void;
  selectable?: boolean;
  onSelect?: (selected: T[]) => void;
  emptyMsg?: string;
  defaultSortKey?: string;
  defaultSortDir?: 1 | -1;
}

export function Table<T extends Record<string, any>>({
  cols,
  rows,
  onRow,
  selectable,
  onSelect,
  emptyMsg,
  defaultSortKey,
  defaultSortDir = 1,
}: TableProps<T>) {
  const [sortKey, setSortKey] = useState<string | null>(defaultSortKey || null);
  const [sortDir, setSortDir] = useState<1 | -1>(defaultSortDir);
  const [selected, setSelected] = useState<Set<T>>(new Set());

  const data = [...rows];
  if (sortKey) {
    data.sort((a, b) => {
      const va = a[sortKey];
      const vb = b[sortKey];
      if (va > vb) return 1 * sortDir;
      if (va < vb) return -1 * sortDir;
      return 0;
    });
  }

  const handleSelectAll = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newSelected = new Set<T>();
    if (e.target.checked) {
      data.forEach((r) => newSelected.add(r));
    }
    setSelected(newSelected);
    if (onSelect) onSelect([...newSelected]);
  };

  const handleSelectRow = (r: T, checked: boolean) => {
    const newSelected = new Set(selected);
    if (checked) newSelected.add(r);
    else newSelected.delete(r);
    setSelected(newSelected);
    if (onSelect) onSelect([...newSelected]);
  };

  const handleSort = (key: string) => {
    if (sortKey === key) {
      setSortDir(sortDir === 1 ? -1 : 1);
    } else {
      setSortKey(key);
      setSortDir(1);
    }
  };

  return (
    <div className="tbl-wrap">
      <table className="tbl">
        <thead>
          <tr>
            {selectable && (
              <th style={{ width: '34px' }}>
                <input
                  type="checkbox"
                  aria-label="Select all"
                  onChange={handleSelectAll}
                  checked={data.length > 0 && selected.size === data.length}
                />
              </th>
            )}
            {cols.map((c) => (
              <th
                key={c.key}
                className={c.sortable ? 'sortable' : ''}
                onClick={c.sortable ? () => handleSort(c.key) : undefined}
              >
                {c.label}
                {sortKey === c.key ? (sortDir > 0 ? ' ↑' : ' ↓') : ''}
              </th>
            ))}
          </tr>
        </thead>
        {data.length > 0 && (
          <tbody>
            {data.map((r, idx) => (
              <tr
                key={idx}
                className={`${onRow ? 'clickable' : ''} ${selected.has(r) ? 'selected' : ''}`}
                onClick={(e) => {
                  const target = e.target as HTMLElement;
                  if (target.tagName !== 'INPUT' && !target.closest('button') && onRow) {
                    onRow(r);
                  }
                }}
              >
                {selectable && (
                  <td>
                    <input
                      type="checkbox"
                      aria-label="Select row"
                      checked={selected.has(r)}
                      onChange={(e) => handleSelectRow(r, e.target.checked)}
                    />
                  </td>
                )}
                {cols.map((c) => (
                  <td key={c.key} className={c.num ? 'num' : ''}>
                    {c.render ? c.render(r) : r[c.key] != null ? String(r[c.key]) : '—'}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        )}
      </table>
      {data.length === 0 && (
        <EmptyState
          icon="search"
          title="Nothing here"
          message={emptyMsg || 'No records match the current filters.'}
        />
      )}
    </div>
  );
}
