'use client';

import React, { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { DayPicker } from 'react-day-picker';
import 'react-day-picker/style.css';
import { Icon } from '@/components/ui/Icons';

/*
 * Calendar pickers built on react-day-picker. Values are the same strings the
 * native inputs they replace produced, so call sites don't change shape:
 *   DateField      → "YYYY-MM-DD"        (was <input type="date">)
 *   DateTimeField  → "YYYY-MM-DDTHH:mm"  (was <input type="datetime-local">), local time
 * Both work controlled (`value`) or uncontrolled (`defaultValue`) — the modal
 * bodies in this app are uncontrolled, the page filters are controlled.
 */

const GAP = 6;
/** First guess at the popover's height, until it's measured. */
const POP_HEIGHT = 380;
/** Space kept between the popover and the viewport edge. */
const EDGE = 8;
const MINUTE_STEP = 5;

const pad = (n: number) => String(n).padStart(2, '0');

const toDateStr = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

/** Today as a local "YYYY-MM-DD" — handy for `min`. */
export const todayStr = () => toDateStr(new Date());

/** How far either side of today the month/year dropdowns reach. */
const YEARS_BACK = 100;
const YEARS_AHEAD = 10;

/**
 * Month + year dropdowns in the caption, so a distant date is two clicks rather
 * than paging month by month. react-day-picker's default range ends with the
 * current year, which would block deadlines, expiries and scheduled publishing,
 * so the range is set explicitly — from `min` when there is one, and stretched
 * to include an already-selected date outside the usual window.
 */
function calendarProps(minDate: Date | undefined, selected: Date | undefined) {
  const year = new Date().getFullYear();
  const startMonth = minDate
    ? new Date(minDate.getFullYear(), minDate.getMonth())
    : new Date(Math.min(year - YEARS_BACK, selected?.getFullYear() ?? year), 0);
  const endYear = Math.max(year + YEARS_AHEAD, selected?.getFullYear() ?? year);
  return { captionLayout: 'dropdown' as const, startMonth, endMonth: new Date(endYear, 11) };
}

/** Parses the date part of "YYYY-MM-DD[THH:mm]" as a local date. */
function parseDate(s: string | undefined): Date | undefined {
  const m = s?.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!m) return undefined;
  return new Date(+m[1], +m[2] - 1, +m[3]);
}

function parseTime(s: string | undefined): { h: number; m: number } {
  const m = s?.match(/T(\d{2}):(\d{2})/);
  return m ? { h: +m[1], m: +m[2] } : { h: 9, m: 0 };
}

const fmtDate = (d: Date) =>
  d.toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' });

interface BaseProps {
  value?: string;
  defaultValue?: string;
  onChange?: (value: string) => void;
  placeholder?: string;
  disabled?: boolean;
  /** Earliest selectable day, as "YYYY-MM-DD[THH:mm]". */
  min?: string;
  /** Show a clear (×) button once a value is set. Defaults to true. */
  clearable?: boolean;
  /** 32px-high control, to sit in a toolbar/filter row. */
  compact?: boolean;
  'aria-label'?: string;
  style?: React.CSSProperties;
}

function usePickerState({ value, defaultValue, onChange }: BaseProps) {
  const [inner, setInner] = useState(value ?? defaultValue ?? '');
  useEffect(() => {
    if (value !== undefined) setInner(value);
  }, [value]);
  const set = (next: string) => {
    setInner(next);
    onChange?.(next);
  };
  return [inner, set] as const;
}

function PickerShell({
  label,
  hasValue,
  disabled,
  clearable,
  onClear,
  ariaLabel,
  style,
  compact,
  children,
}: {
  label: string;
  hasValue: boolean;
  disabled?: boolean;
  clearable: boolean;
  onClear: () => void;
  ariaLabel?: string;
  style?: React.CSSProperties;
  compact?: boolean;
  children: (close: () => void) => React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const [rect, setRect] = useState<DOMRect | null>(null);
  // Measured, not assumed: a six-week month plus the time row is taller than
  // the guess, and the month (so the height) can change while it's open.
  const [popHeight, setPopHeight] = useState(POP_HEIGHT);
  const controlRef = useRef<HTMLButtonElement>(null);
  const popRef = useRef<HTMLDivElement>(null);

  const syncRect = useCallback(() => {
    if (controlRef.current) setRect(controlRef.current.getBoundingClientRect());
  }, []);
  const close = useCallback(() => setOpen(false), []);

  useEffect(() => {
    if (!open) return;
    syncRect();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        // Don't let the surrounding modal close too.
        e.stopPropagation();
        close();
        controlRef.current?.focus();
      }
    };
    const onDocPointer = (e: MouseEvent) => {
      const t = e.target as Node;
      if (controlRef.current?.contains(t) || popRef.current?.contains(t)) return;
      close();
    };
    window.addEventListener('scroll', syncRect, true);
    window.addEventListener('resize', syncRect);
    window.addEventListener('keydown', onKey, true);
    document.addEventListener('mousedown', onDocPointer);
    return () => {
      window.removeEventListener('scroll', syncRect, true);
      window.removeEventListener('resize', syncRect);
      window.removeEventListener('keydown', onKey, true);
      document.removeEventListener('mousedown', onDocPointer);
    };
  }, [open, syncRect, close]);

  // The popover mounts once the control's rect is known, so re-run then.
  const positioned = rect !== null;
  useLayoutEffect(() => {
    const el = popRef.current;
    if (!open || !positioned || !el) return;
    const measure = () => setPopHeight(el.scrollHeight);
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(el);
    return () => observer.disconnect();
  }, [open, positioned]);

  let popStyle: React.CSSProperties | undefined;
  if (open && rect && typeof window !== 'undefined') {
    const vh = window.innerHeight;
    const roomBelow = vh - rect.bottom - GAP - EDGE;
    const roomAbove = rect.top - GAP - EDGE;
    // Below if it fits, else above if it fits. On a short screen where neither
    // does, pin it inside the viewport and let it scroll rather than run off.
    const placement =
      popHeight <= roomBelow
        ? { top: rect.bottom + GAP }
        : popHeight <= roomAbove
          ? { bottom: vh - rect.top + GAP }
          : { top: Math.max(EDGE, vh - popHeight - EDGE) };
    popStyle = {
      position: 'fixed',
      left: Math.max(EDGE, Math.min(rect.left, window.innerWidth - 300)),
      maxHeight: vh - 2 * EDGE,
      overflowY: 'auto',
      ...placement,
    };
  }

  return (
    <div className="datefield" style={style}>
      <button
        type="button"
        ref={controlRef}
        className="input datefield-control"
        disabled={disabled}
        aria-label={ariaLabel}
        aria-haspopup="dialog"
        aria-expanded={open}
        style={compact ? { height: '32px' } : undefined}
        onClick={() => setOpen((o) => !o)}
      >
        <Icon name="calendar" size={14} />
        <span className={hasValue ? '' : 'datefield-placeholder'}>{label}</span>
      </button>
      {clearable && hasValue && !disabled && (
        <button type="button" className="datefield-clear" aria-label="Clear date" onClick={onClear}>
          <Icon name="x" size={12} />
        </button>
      )}
      {open &&
        popStyle &&
        typeof document !== 'undefined' &&
        createPortal(
          <div className="datefield-pop" role="dialog" ref={popRef} style={popStyle}>
            {children(close)}
          </div>,
          document.body,
        )}
    </div>
  );
}

export function DateField(props: BaseProps) {
  const { placeholder = 'Pick a date', disabled, min, clearable = true, style } = props;
  const [value, setValue] = usePickerState(props);
  const selected = parseDate(value);
  const minDate = parseDate(min);

  return (
    <PickerShell
      label={selected ? fmtDate(selected) : placeholder}
      hasValue={!!selected}
      disabled={disabled}
      clearable={clearable}
      onClear={() => setValue('')}
      ariaLabel={props['aria-label']}
      style={style}
      compact={props.compact}
    >
      {(close) => (
        <DayPicker
          mode="single"
          {...calendarProps(minDate, selected)}
          selected={selected}
          defaultMonth={selected ?? minDate}
          disabled={minDate ? { before: minDate } : undefined}
          onSelect={(d) => {
            setValue(d ? toDateStr(d) : '');
            if (d) close();
          }}
        />
      )}
    </PickerShell>
  );
}

export function DateTimeField(props: BaseProps) {
  const { placeholder = 'Pick a date and time', disabled, min, clearable = true, style } = props;
  const [value, setValue] = usePickerState(props);
  const selected = parseDate(value);
  const { h, m } = parseTime(value);
  const minDate = parseDate(min);

  const commit = (day: Date | undefined, hour: number, minute: number) =>
    setValue(day ? `${toDateStr(day)}T${pad(hour)}:${pad(minute)}` : '');

  // Keep an off-step minute (e.g. a pre-filled 10:07) selectable.
  const minutes = Array.from({ length: 60 / MINUTE_STEP }, (_, i) => i * MINUTE_STEP);
  if (!minutes.includes(m)) (minutes.push(m), minutes.sort((a, b) => a - b));

  const label = selected
    ? `${fmtDate(selected)}, ${new Date(0, 0, 1, h, m).toLocaleTimeString(undefined, {
        hour: 'numeric',
        minute: '2-digit',
      })}`
    : placeholder;

  return (
    <PickerShell
      label={label}
      hasValue={!!selected}
      disabled={disabled}
      clearable={clearable}
      onClear={() => setValue('')}
      ariaLabel={props['aria-label']}
      style={style}
      compact={props.compact}
    >
      {(close) => (
        <>
          <DayPicker
            mode="single"
            {...calendarProps(minDate, selected)}
            selected={selected}
            defaultMonth={selected ?? minDate}
            disabled={minDate ? { before: minDate } : undefined}
            onSelect={(d) => commit(d, h, m)}
          />
          <div className="datefield-time">
            <Icon name="clock" size={14} />
            <select
              className="input"
              aria-label="Hour"
              value={h}
              disabled={!selected}
              onChange={(e) => commit(selected, +e.target.value, m)}
            >
              {Array.from({ length: 24 }, (_, i) => (
                <option key={i} value={i}>
                  {pad(i)}
                </option>
              ))}
            </select>
            <span>:</span>
            <select
              className="input"
              aria-label="Minute"
              value={m}
              disabled={!selected}
              onChange={(e) => commit(selected, h, +e.target.value)}
            >
              {minutes.map((i) => (
                <option key={i} value={i}>
                  {pad(i)}
                </option>
              ))}
            </select>
            <button
              type="button"
              className="btn btn-primary btn-sm"
              disabled={!selected}
              onClick={close}
            >
              Done
            </button>
          </div>
        </>
      )}
    </PickerShell>
  );
}
