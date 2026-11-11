'use client';

import React, { useEffect, useRef } from 'react';

const LENGTH = 6;

/** Six one-digit boxes. Typing moves on, Backspace moves back, and a paste fills them all. */
export function CodeBoxes({
  value,
  onChange,
  invalid,
  disabled,
  describedBy,
}: {
  value: string;
  onChange: (code: string) => void;
  /** Red borders after a wrong code; the parent clears it when typing starts again. */
  invalid?: boolean;
  disabled?: boolean;
  describedBy?: string;
}) {
  const refs = useRef<(HTMLInputElement | null)[]>([]);
  const focusBox = (i: number) => refs.current[Math.max(0, Math.min(LENGTH - 1, i))]?.focus();

  // First empty box, so a wrong code or a fresh step puts the caret where typing goes.
  useEffect(() => {
    if (!disabled && value.length < LENGTH) focusBox(value.length);
  }, [disabled, value.length]);

  /** Writes digits from box `start`; also covers a paste and phone autofill into one box. */
  const fill = (start: number, digits: string) => {
    const clean = digits.replace(/\D/g, '');
    if (!clean) return;
    const chars = value.padEnd(LENGTH, ' ').split('');
    clean
      .slice(0, LENGTH - start)
      .split('')
      .forEach((d, k) => (chars[start + k] = d));
    const next = chars.join('').replace(/ .*$/, '');
    onChange(next);
    focusBox(Math.min(start + clean.length, LENGTH - 1));
  };

  const onKeyDown = (i: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Backspace') {
      e.preventDefault();
      const at = value[i] ? i : i - 1;
      if (at < 0) return;
      onChange(value.slice(0, at));
      focusBox(at);
    } else if (e.key === 'ArrowLeft') {
      e.preventDefault();
      focusBox(i - 1);
    } else if (e.key === 'ArrowRight') {
      e.preventDefault();
      focusBox(i + 1);
    }
  };

  return (
    <div
      role="group"
      aria-label="Verification code"
      className="grid w-full gap-2"
      style={{ gridTemplateColumns: `repeat(${LENGTH}, minmax(0, 1fr))` }}
    >
      {Array.from({ length: LENGTH }, (_, i) => (
        <input
          key={i}
          ref={(el) => {
            refs.current[i] = el;
          }}
          className="otp-box"
          inputMode="numeric"
          autoComplete={i === 0 ? 'one-time-code' : 'off'}
          aria-label={`Digit ${i + 1} of ${LENGTH}`}
          aria-invalid={invalid || undefined}
          aria-describedby={describedBy}
          disabled={disabled}
          value={value[i] ?? ''}
          // Only the first empty box takes input, so digits always fill left to right.
          onFocus={(e) => {
            if (i > value.length) focusBox(value.length);
            else e.target.select();
          }}
          onChange={(e) => {
            const raw = e.target.value;
            // Typing into a filled box without selecting it: keep only the new digit.
            fill(i, raw.length === 2 && value[i] ? raw.replace(value[i], '') : raw.slice(-LENGTH));
          }}
          onKeyDown={(e) => onKeyDown(i, e)}
          onPaste={(e) => {
            e.preventDefault();
            fill(0, e.clipboardData.getData('text'));
          }}
        />
      ))}
    </div>
  );
}
