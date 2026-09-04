import React from 'react';

export interface SkeletonProps {
  width?: number | string;
  height?: number | string;
  radius?: number | string;
  circle?: boolean;
  className?: string;
  style?: React.CSSProperties;
}

/**
 * A single shimmering placeholder block. The shimmer itself (`.skel`,
 * `globals.css`) already existed in the design system but nothing used it —
 * every loading state in the app fell back to `<Spinner>` instead.
 */
export function Skeleton({
  width,
  height = 14,
  radius = 6,
  circle,
  className = '',
  style,
}: SkeletonProps) {
  return (
    <span
      aria-hidden="true"
      className={`skel ${className}`}
      style={{
        display: 'inline-block',
        width,
        height,
        borderRadius: circle ? '50%' : radius,
        ...style,
      }}
    />
  );
}

/**
 * A block of shimmering text lines. The last line runs short by default so it
 * reads as wrapped text rather than a stack of identical bars.
 */
export function SkeletonText({
  lines = 1,
  gap = 8,
  lastLineWidth = '60%',
}: {
  lines?: number;
  gap?: number;
  lastLineWidth?: string;
}) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap }} aria-hidden="true">
      {Array.from({ length: lines }).map((_, i) => (
        <Skeleton
          key={i}
          height={12}
          width={i === lines - 1 && lines > 1 ? lastLineWidth : '100%'}
        />
      ))}
    </div>
  );
}

/** Rows shaped like `.tree-item` — the cabinet/folder sidebar lists. */
export function SkeletonTreeRows({ rows = 5 }: { rows?: number }) {
  return (
    <div aria-hidden="true">
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="tree-item" style={{ cursor: 'default' }}>
          <Skeleton width={15} height={15} radius={4} />
          {/* Widths vary per row so the block doesn't read as one striped bar. */}
          <Skeleton height={12} width={`${58 + ((i * 13) % 30)}%`} />
        </div>
      ))}
    </div>
  );
}

/**
 * A full `.tbl`-shaped table, real header included, with shimmer body rows —
 * a drop-in for wherever `<Table>` renders once its data has loaded.
 */
export function SkeletonTable({
  columns,
  rows = 6,
}: {
  /** Header labels, in order. Pass `''` for a column with no header text
   *  (e.g. a trailing actions column) so the count still lines up. */
  columns: string[];
  rows?: number;
}) {
  return (
    <div className="tbl-wrap" aria-hidden="true">
      <table className="tbl">
        <thead>
          <tr>
            {columns.map((label, i) => (
              <th key={i}>{label}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {Array.from({ length: rows }).map((_, r) => (
            <tr key={r}>
              {columns.map((_, c) => (
                <td key={c}>
                  <Skeleton height={12} width={c === 0 ? '75%' : `${40 + ((c + r) % 3) * 15}%`} />
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
