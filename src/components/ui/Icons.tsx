import React from 'react';

const paths: Record<string, string> = {
  home: 'M3 10.5 12 3l9 7.5M5 9.5V21h14V9.5M9 21v-6h6v6',
  inbox: 'M3 13h4l2 3h6l2-3h4M5 6h14l2 7v6H3v-6l2-7',
  folder: 'M3 6h6l2 2h10v11H3V6',
  upload: 'M12 16V4m0 0 -4 4m4-4 4 4M4 20h16',
  doc: 'M7 3h7l5 5v13H7V3m7 0v5h5',
  search: 'M11 4a7 7 0 1 1 0 14 7 7 0 0 1 0-14Zm10 17-5-5',
  bell: 'M6 9a6 6 0 1 1 12 0c0 5 2 6 2 6H4s2-1 2-6m4 9a2 2 0 0 0 4 0',
  chart: 'M4 20V10m6 10V4m6 16v-7m-13 7h16',
  speaker: 'M4 10v4h3l6 5V5l-6 5H4Zm13-1s2 1 2 3-2 3-2 3',
  users:
    'M8 11a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7Zm8 0a3 3 0 1 0-2-5.6M2 20c0-3 3-5 6-5s6 2 6 5m2-4.6c2.3.4 4 1.9 4 4.6',
  gauge: 'M12 13 8 9m-4 4a8 8 0 1 1 16 0M4 19h16',
  approve: 'M20 6 9 17l-5-5',
  clock: 'M12 3a9 9 0 1 1 0 18 9 9 0 0 1 0-18Zm0 4v5l3 3',
  swap: 'M7 4 3 8l4 4M3 8h13m1 4 4 4-4 4m4-4H8',
  alert: 'M12 3 2 21h20L12 3Zm0 8v4m0 3v.5',
  grid: 'M4 4h7v7H4V4Zm9 0h7v7h-7V4ZM4 13h7v7H4v-7Zm9 0h7v7h-7v-7',
  trend: 'M3 17l6-6 4 4 8-8m0 0h-5m5 0v5',
  shield: 'M12 3 5 6v5c0 5 3.5 8.5 7 10 3.5-1.5 7-5 7-10V6l-7-3Zm-3 9 2 2 4-4',
  report: 'M8 3h8l4 4v14H4V7l4-4Zm0 9h8m-8 4h5',
  settings:
    'M12 9a3 3 0 1 1 0 6 3 3 0 0 1 0-6Zm7.5 3 2-1.5-2-3.5-2.3.8a7 7 0 0 0-1.7-1L15 4H9l-.5 2.8a7 7 0 0 0-1.7 1L4.5 7l-2 3.5 2 1.5v0l-2 1.5 2 3.5 2.3-.8a7 7 0 0 0 1.7 1L9 20h6l.5-2.8a7 7 0 0 0 1.7-1l2.3.8 2-3.5-2-1.5',
  cabinet: 'M4 3h16v18H4V3Zm0 6h16M4 15h16m-9-9h2m-2 6h2m-2 6h2',
  flow: 'M5 3h5v5H5V3Zm9 13h5v5h-5v-5ZM7.5 8v4a2 2 0 0 0 2 2h5m-4-4 4 4-4 4',
  policy: 'M12 3 5 6v5c0 5 3.5 8.5 7 10 3.5-1.5 7-5 7-10V6l-7-3Zm-2 8h4m-2-2v4',
  brush: 'M14 4l6 6-8 8H6v-6l8-8Zm-3 3 6 6',
  building: 'M4 21V5l8-3v19m8 0V9l-8-3M8 9h.5M8 13h.5M8 17h.5m7-5h.5m-.5 4h.5',
  billing: 'M3 7h18v12H3V7Zm0 4h18M7 15h4',
  pulse: 'M3 12h4l2-6 4 12 2-6h6',
  flag: 'M5 21V4m0 1h13l-2.5 4L18 13H5',
  list: 'M8 6h13M8 12h13M8 18h13M3.5 6h.5m-.5 6h.5m-.5 6h.5',
  eye: 'M2 12s4-7 10-7 10 7 10 7-4 7-10 7-10-7-10-7Zm10-3a3 3 0 1 1 0 6 3 3 0 0 1 0-6Z',
  finding: 'M11 4a7 7 0 1 1 0 14 7 7 0 0 1 0-14Zm10 17-5-5m-5-8v4m0 3v.5',
  sign: 'M4 18c2-4 4-9 5-9s1 7 2 7 2-4 3-4 1 3 2 3 2-1 4-1M4 22h16',
  redact: 'M4 6h16M4 10h9m-9 4h16M4 18h6m4 0h6',
  download: 'M12 4v10m0 0-4-4m4 4 4-4M4 20h16',
  print: 'M7 8V3h10v5M7 17H4V9h16v8h-3m-10-1h10v6H7v-6',
  share:
    'M18 5a2.5 2.5 0 1 1-.7 4.9L9 14a2.6 2.6 0 0 1 0 .9l8.3 4a2.5 2.5 0 1 1-.8 1.4l-8.3-4a2.5 2.5 0 1 1 0-4.6l8.3-4A2.5 2.5 0 0 1 18 5Z',
  x: 'M6 6l12 12M18 6 6 18',
  plus: 'M12 5v14m-7-7h14',
  edit: 'M14 5l5 5L8 21H3v-5L14 5Zm2-2 3-1 2 2-1 3',
  chevR: 'm9 5 7 7-7 7',
  chevD: 'm5 9 7 7 7-7',
  menu: 'M4 6h16M4 12h16M4 18h16',
  moon: 'M20 13A8 8 0 1 1 11 4a6.5 6.5 0 0 0 9 9Z',
  sun: 'M12 8a4 4 0 1 1 0 8 4 4 0 0 1 0-8Zm0-5v2m0 14v2M3 12h2m14 0h2M5.6 5.6l1.4 1.4m10 10 1.4 1.4m0-12.8-1.4 1.4m-10 10-1.4 1.4',
  logout: 'M15 4h5v16h-5M10 8l-4 4 4 4m-4-4h11',
  key: 'M14 10a4 4 0 1 1 4 4c-.7 0-1.4-.2-2-.5L9 20H5v-4l6.5-6.5c-.3-.6-.5-1.3-.5-2Z',
  send: 'M22 2 11 13M22 2l-7 20-4-9-9-4 20-7Z',
  filter: 'M3 5h18l-7 8v6l-4-2v-4L3 5Z',
  save: 'M5 3h11l5 5v13H5V3Zm3 0v5h7V3M8 21v-7h8v7',
  copy: 'M8 8h12v12H8V8Zm-4 8V4h12',
  lock: 'M6 11V8a6 6 0 1 1 12 0v3m-14 0h16v10H4V11Zm8 4v3',
  globe:
    'M12 3a9 9 0 1 1 0 18 9 9 0 0 1 0-18Zm-9 9h18M12 3c2.5 2.5 3.5 5.5 3.5 9s-1 6.5-3.5 9c-2.5-2.5-3.5-5.5-3.5-9s1-6.5 3.5-9Z',
  scale: 'M12 3v18m-7-3h14M5 18V8m14 10V8M2 8l3-4 3 4M2 8h6m8 0 3-4 3 4m-6 0h6',
  cart: 'M3 4h2l2.5 12h11L21 7H6.5M9 20a1 1 0 1 0 0-2 1 1 0 0 0 0 2Zm9 0a1 1 0 1 0 0-2 1 1 0 0 0 0 2Z',
  gear: 'M12 9a3 3 0 1 1 0 6 3 3 0 0 1 0-6Zm8-1-1.5-2.6-2.4.7a6.7 6.7 0 0 0-1.6-1L14 2h-4l-.5 3.1a6.7 6.7 0 0 0-1.6 1l-2.4-.7L4 8l1.9 2a6.7 6.7 0 0 0 0 2L4 14l1.5 2.6 2.4-.7a6.7 6.7 0 0 0 1.6 1L10 20h4l.5-3.1a6.7 6.7 0 0 0 1.6-1l2.4.7L20 14l-1.9-2a6.7 6.7 0 0 0 0-2L20 8Z',
  calendar: 'M5 5h14v16H5V5Zm0 5h14M9 3v4m6-4v4',
  circle: 'M12 3a9 9 0 1 1 0 18 9 9 0 0 1 0-18Z',
  check: 'M20 6 9 17l-5-5',
};

export const Icon = ({ name, size = 18 }: { name: string; size?: number }) => {
  return (
    <svg
      viewBox="0 0 24 24"
      width={size}
      height={size}
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d={paths[name] || paths['circle']} />
    </svg>
  );
};

export const IconEl = ({ name, size = 18 }: { name: string; size?: number }) => (
  <span className="nav-icon">
    <Icon name={name} size={size} />
  </span>
);
