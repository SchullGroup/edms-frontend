'use client';

import React, { useEffect, useState } from 'react';
import { useUIStore } from '@/store/useUIStore';
import { getBrandPreset } from '@/lib/brand';

/** Shown once, straight after set-up. Moving on needs "I've saved these codes". */
export function RecoveryCodes({
  codes,
  email,
  doneLabel,
  onDone,
}: {
  codes: string[];
  email: string;
  doneLabel: string;
  onDone: () => void;
}) {
  const { addToast } = useUIStore();
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    if (saved) return;
    const warn = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [saved]);

  const asText = () =>
    [
      `${getBrandPreset().appName} recovery codes${email ? ` for ${email}` : ''}`,
      `Created ${new Date().toLocaleString()}. Each code works once.`,
      '',
      ...codes,
      '',
    ].join('\n');

  const download = () => {
    const url = URL.createObjectURL(new Blob([asText()], { type: 'text/plain' }));
    const a = document.createElement('a');
    a.href = url;
    a.download = 'recovery-codes.txt';
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="flex w-full flex-col items-center">
      <ul
        className="grid grid-cols-2 gap-x-6 gap-y-1"
        aria-label="Recovery codes"
        style={{
          listStyle: 'none',
          margin: 0,
          fontFamily: '"Cascadia Code", Consolas, monospace',
          fontSize: 14,
          background: 'var(--surface)',
          border: '1px solid var(--border)',
          borderRadius: 8,
          padding: '12px 16px',
        }}
      >
        {codes.map((c) => (
          <li key={c}>{c}</li>
        ))}
      </ul>

      <div className="mt-3 flex flex-wrap justify-center gap-2">
        <button
          type="button"
          className="btn btn-secondary btn-sm"
          onClick={() =>
            navigator.clipboard
              .writeText(codes.join('\n'))
              .then(() => addToast('Recovery codes copied', 'success'))
              .catch(() => addToast('Couldn’t copy. Download them instead.', 'error'))
          }
        >
          Copy
        </button>
        <button type="button" className="btn btn-secondary btn-sm" onClick={download}>
          Download .txt
        </button>
      </div>

      <label className="mt-5 flex items-center gap-2 text-sm" style={{ cursor: 'pointer' }}>
        <input type="checkbox" checked={saved} onChange={(e) => setSaved(e.target.checked)} />
        I&apos;ve saved these codes
      </label>
      <button
        type="button"
        className="btn btn-primary mt-4 h-12 w-full justify-center"
        disabled={!saved}
        onClick={onDone}
      >
        {doneLabel}
      </button>
    </div>
  );
}
