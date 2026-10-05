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
 * A single shimmering placeholder block (`.skel`, `globals.css`). Loading states
 * mirror the shape of the content they stand in for rather than showing a spinner.
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

/** Rows shaped like `.task-row` — task lists (avatar, title + caption, trailing chip). */
export function SkeletonTaskRows({ rows = 5 }: { rows?: number }) {
  return (
    <div className="rowlist" aria-hidden="true" role="presentation">
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="task-row" style={{ cursor: 'default' }}>
          <Skeleton width={30} height={30} radius={8} />
          <div style={{ flex: 1, minWidth: 0 }}>
            <Skeleton height={13} width={`${48 + ((i * 17) % 35)}%`} style={{ marginBottom: 6 }} />
            <Skeleton height={10} width={`${22 + ((i * 11) % 20)}%`} />
          </div>
          <Skeleton height={20} width={72} radius={99} />
        </div>
      ))}
    </div>
  );
}

/** Rows shaped like `.notif-item` — a dot, a message line and a timestamp line. */
export function SkeletonNotifRows({ rows = 4 }: { rows?: number }) {
  return (
    <div aria-hidden="true">
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="notif-item" style={{ cursor: 'default' }}>
          <Skeleton width={7} height={7} circle style={{ marginTop: 6, flexShrink: 0 }} />
          <div style={{ flex: 1 }}>
            <Skeleton height={12} width={`${70 + ((i * 9) % 25)}%`} style={{ marginBottom: 6 }} />
            <Skeleton height={10} width={70} />
          </div>
        </div>
      ))}
    </div>
  );
}

/** A row of `.kpi` cards. */
export function SkeletonKpis({ count = 4 }: { count?: number }) {
  return (
    <div className={`grid cols-${count} mb-4`} aria-hidden="true">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="card kpi" style={{ cursor: 'default' }}>
          <Skeleton height={10} width="45%" style={{ marginBottom: 12 }} />
          <Skeleton height={24} width="40%" />
        </div>
      ))}
    </div>
  );
}

/** A titled card holding a chart-sized block — stands in for `Charts` panels. */
export function SkeletonChartCard({ height = 220 }: { height?: number }) {
  return (
    <div className="card" aria-hidden="true">
      <div className="card-head">
        <Skeleton height={14} width={140} />
      </div>
      <div className="card-body">
        <Skeleton height={height} radius={10} style={{ width: '100%' }} />
      </div>
    </div>
  );
}

/**
 * Whole-page placeholder for pages that gate their entire render on a data
 * load: page head, optional KPI row, then either a table or chart cards.
 * Exposes a single polite status so screen readers hear one "Loading".
 */
export function SkeletonPage({
  kpis = 0,
  columns,
  charts = 0,
  rows = 6,
}: {
  kpis?: number;
  /** Header labels for a body table; omit for no table. */
  columns?: string[];
  /** Number of chart cards, laid out two-up. */
  charts?: number;
  rows?: number;
}) {
  return (
    <div role="status" aria-busy="true" aria-label="Loading">
      <div className="page-head" aria-hidden="true">
        <div>
          <Skeleton height={26} width={240} style={{ marginBottom: 8 }} />
          <Skeleton height={12} width={360} />
        </div>
      </div>
      {kpis > 0 && <SkeletonKpis count={kpis} />}
      {charts > 0 && (
        <div className="grid cols-2 mb-4">
          {Array.from({ length: charts }).map((_, i) => (
            <SkeletonChartCard key={i} />
          ))}
        </div>
      )}
      {columns && <SkeletonTable columns={columns} rows={rows} />}
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
