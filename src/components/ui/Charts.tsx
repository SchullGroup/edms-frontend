import React from 'react';

export interface HBarItem {
  label: string;
  value: number;
  color?: string;
  onClick?: () => void;
}

export const HBarChart = ({
  items,
  max,
  unit = '',
}: {
  items: HBarItem[];
  max?: number;
  unit?: string;
}) => {
  const maxValue = max ?? Math.max(...items.map((i) => i.value), 1);
  return (
    <div className="hbar-chart">
      {items.map((it, idx) => (
        <div
          key={idx}
          onClick={it.onClick}
          style={{ cursor: it.onClick ? 'pointer' : 'default', marginBottom: '12px' }}
        >
          <div className="flex jcb aic" style={{ fontSize: '12.5px', marginBottom: '4px' }}>
            <span>{it.label}</span>
            <span style={{ fontWeight: 600 }}>
              {it.value}
              {unit}
            </span>
          </div>
          <div
            className="pbar"
            style={{
              height: '6px',
              background: 'var(--bg-body)',
              borderRadius: '3px',
              overflow: 'hidden',
            }}
          >
            <div
              style={{
                width: `${(it.value / maxValue) * 100}%`,
                height: '100%',
                background: it.color || 'var(--brand-primary)',
                borderRadius: '3px',
              }}
            ></div>
          </div>
        </div>
      ))}
    </div>
  );
};

export interface LineSeries {
  name: string;
  color: string;
  values: number[];
}

export const LineChart = ({ labels, series }: { labels: string[]; series: LineSeries[] }) => {
  const allValues = series.flatMap((s) => s.values);
  const max = Math.max(...allValues, 10); // buffer
  const width = 600;
  const height = 200;
  const paddingX = 40;
  const paddingY = 20;

  const point = (idx: number, val: number) => {
    const x = paddingX + (idx / Math.max(labels.length - 1, 1)) * (width - paddingX * 2);
    const y = height - paddingY - (val / max) * (height - paddingY * 2);
    return `${x},${y}`;
  };

  return (
    <div style={{ position: 'relative', width: '100%', overflowX: 'auto' }}>
      <svg
        viewBox={`0 0 ${width} ${height}`}
        style={{ width: '100%', height: 'auto', display: 'block' }}
      >
        {[0, 0.5, 1].map((f) => (
          <React.Fragment key={f}>
            <line
              x1={paddingX}
              y1={height - paddingY - f * (height - paddingY * 2)}
              x2={width - paddingX}
              y2={height - paddingY - f * (height - paddingY * 2)}
              stroke="var(--border)"
              strokeWidth="1"
            />
            <text
              x={paddingX - 10}
              y={height - paddingY - f * (height - paddingY * 2) + 4}
              fontSize="10"
              fill="currentColor"
              opacity="0.6"
              textAnchor="end"
            >
              {Math.round(f * max)}
            </text>
          </React.Fragment>
        ))}
        {labels.map((lbl, i) => {
          const x = paddingX + (i / Math.max(labels.length - 1, 1)) * (width - paddingX * 2);
          return (
            <text
              key={i}
              x={x}
              y={height - 5}
              fontSize="10"
              fill="currentColor"
              opacity="0.6"
              textAnchor="middle"
            >
              {lbl}
            </text>
          );
        })}
        {series.map((s, i) => (
          <polyline
            key={i}
            fill="none"
            stroke={s.color}
            strokeWidth="2.5"
            points={s.values.map((v, idx) => point(idx, v)).join(' ')}
          />
        ))}
        {series.map((s, i) =>
          s.values.map((v, idx) => {
            const [x, y] = point(idx, v).split(',');
            return (
              <circle
                key={`${i}-${idx}`}
                cx={x}
                cy={y}
                r="3"
                fill="var(--bg-card, #fff)"
                stroke={s.color}
                strokeWidth="2"
              />
            );
          }),
        )}
      </svg>
      <div
        className="flex g12"
        style={{ justifyContent: 'center', marginTop: '12px', fontSize: '11px' }}
      >
        {series.map((s, i) => (
          <div key={i} className="flex aic g8">
            <span
              style={{ width: '10px', height: '10px', borderRadius: '50%', background: s.color }}
            ></span>
            <span>{s.name}</span>
          </div>
        ))}
      </div>
    </div>
  );
};

export const DonutChart = ({
  value,
  label,
  color,
  size = 130,
}: {
  value: number;
  label: string;
  color: string;
  size?: number;
}) => {
  const strokeW = 12;
  const r = (size - strokeW) / 2;
  const c = Math.PI * (r * 2);
  const offset = ((100 - value) / 100) * c;
  return (
    <div style={{ position: 'relative', width: size, height: size }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke="var(--bg-hover)"
          strokeWidth={strokeW}
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke={color}
          strokeWidth={strokeW}
          strokeDasharray={c}
          strokeDashoffset={offset}
          strokeLinecap="round"
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
        />
      </svg>
      <div
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <span style={{ fontSize: '24px', fontWeight: 700, color: 'var(--text-main)' }}>
          {value}%
        </span>
        <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>{label}</span>
      </div>
    </div>
  );
};

export const Sparkline = ({ values, color }: { values: number[]; color: string }) => {
  const max = Math.max(...values, 1);
  const width = 100;
  const height = 30;
  const points = values
    .map((v, i) => `${(i / Math.max(values.length - 1, 1)) * width},${height - (v / max) * height}`)
    .join(' ');
  return (
    <svg
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      style={{ overflow: 'visible' }}
    >
      <polyline
        fill="none"
        stroke={color}
        strokeWidth="2"
        points={points}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
};
