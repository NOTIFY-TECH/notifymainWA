'use client';

import { useEffect, useRef, useState } from 'react';
import { Calendar as CalendarIcon, ChevronLeft, ChevronRight, Clock, X } from 'lucide-react';
import { cn } from '@/lib/utils';

// ─── Types ────────────────────────────────────────────────────────────────────

interface DateTimePickerProps {
  /** 'YYYY-MM-DDTHH:mm' — same shape as <input type="datetime-local">.value, or '' for unset */
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
  /** Days before this are not selectable. Defaults to now (no scheduling into the past). */
  minDate?: Date;
  /** Open the calendar popover upward instead of downward. Use when near the bottom of the viewport. */
  openUpward?: boolean;
}

// ─── Date helpers ─────────────────────────────────────────────────────────────

const WEEKDAYS = ['Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa', 'Su'];
const MONTHS = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
];

function pad(n: number): string {
  return n.toString().padStart(2, '0');
}

function parseValue(value: string): Date | null {
  if (!value) return null;
  const [datePart, timePart] = value.split('T');
  if (!datePart) return null;
  const [y, m, d] = datePart.split('-').map(Number);
  const [hh, mm] = (timePart ?? '00:00').split(':').map(Number);
  if (!y || !m || !d) return null;
  return new Date(y, m - 1, d, hh ?? 0, mm ?? 0);
}

function toValue(date: Date): string {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

function formatDisplay(date: Date): string {
  const datePart = `${date.getDate()} ${MONTHS[date.getMonth()].slice(0, 3)} ${date.getFullYear()}`;
  const timePart = `${pad(date.getHours())}:${pad(date.getMinutes())}`;
  return `${datePart}, ${timePart}`;
}

function startOfDay(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function isSameDay(a: Date, b: Date): boolean {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

function buildCalendarGrid(viewYear: number, viewMonth: number): Date[] {
  const firstOfMonth = new Date(viewYear, viewMonth, 1);
  const firstWeekday = (firstOfMonth.getDay() + 6) % 7;
  const gridStart = new Date(viewYear, viewMonth, 1 - firstWeekday);
  return Array.from({ length: 42 }, (_, i) => {
    const d = new Date(gridStart);
    d.setDate(gridStart.getDate() + i);
    return d;
  });
}

// ─── Component ────────────────────────────────────────────────────────────────

export function DateTimePicker({ value, onChange, placeholder, className, minDate, openUpward }: DateTimePickerProps) {
  const selected = parseValue(value);
  const floor = minDate ?? new Date();

  const [open, setOpen] = useState(false);
  const [viewDate, setViewDate] = useState(() => selected ?? new Date());
  const [hour, setHour] = useState(() => (selected ?? new Date()).getHours());
  const [minute, setMinute] = useState(() => (selected ?? new Date()).getMinutes());

  const containerRef = useRef<HTMLDivElement>(null);

  // Close on outside click
  useEffect(() => {
    if (!open) return;
    const handleClick = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [open]);

  // Reset calendar view + time to current value when popover opens
  useEffect(() => {
    if (!open) return;
    const base = selected ?? new Date();
    setViewDate(base);
    setHour(base.getHours());
    setMinute(base.getMinutes());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const grid = buildCalendarGrid(viewDate.getFullYear(), viewDate.getMonth());
  const today = startOfDay(new Date());

  const commit = (day: Date, h: number, m: number) => {
    onChange(toValue(new Date(day.getFullYear(), day.getMonth(), day.getDate(), h, m)));
  };

  const handleDayClick = (day: Date) => {
    if (startOfDay(day) < startOfDay(floor)) return;
    commit(day, hour, minute);
  };

  const handleClear = () => {
    onChange('');
    setOpen(false);
  };

  return (
    <div ref={containerRef} className={cn('relative', className)}>
      {/* ── Trigger button — same bg/border/height as every other input ── */}
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        className={cn(
          'w-full h-9 flex items-center justify-between gap-2 rounded-lg border border-[hsl(var(--border))]',
          'bg-[hsl(var(--muted))] px-3 text-sm text-left',
          'hover:border-[hsl(var(--green)/0.4)] transition-colors',
          'focus:outline-none focus:ring-1 focus:ring-[hsl(var(--green))]',
        )}
      >
        <span
          className={cn('flex items-center gap-2 text-sm truncate', !selected && 'text-[hsl(var(--muted-foreground))]')}
        >
          <CalendarIcon className="w-3.5 h-3.5 shrink-0" />
          <span className="truncate">{selected ? formatDisplay(selected) : (placeholder ?? 'Send immediately')}</span>
        </span>
        {selected && (
          <span
            role="button"
            tabIndex={0}
            onClick={e => {
              e.stopPropagation();
              handleClear();
            }}
            className="shrink-0 text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))] transition-colors"
          >
            <X className="w-3.5 h-3.5" />
          </span>
        )}
      </button>

      {/* ── Popover ── */}
      {open && (
        <div
          className={cn(
            'absolute z-50 w-[296px] rounded-xl border border-[hsl(var(--border))]',
            'bg-[hsl(var(--card))] shadow-2xl p-3',
            // Opens downward by default; upward when near the bottom of the viewport
            openUpward ? 'bottom-full mb-2 left-0' : 'top-full mt-2 left-0',
          )}
        >
          {/* Month nav */}
          <div className="flex items-center justify-between mb-2.5">
            <button
              type="button"
              onClick={() => setViewDate(d => new Date(d.getFullYear(), d.getMonth() - 1, 1))}
              className="p-1 rounded-md hover:bg-[hsl(var(--muted))] text-[hsl(var(--muted-foreground))] transition-colors"
              aria-label="Previous month"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <span className="text-xs font-semibold text-[hsl(var(--foreground))]">
              {MONTHS[viewDate.getMonth()]} {viewDate.getFullYear()}
            </span>
            <button
              type="button"
              onClick={() => setViewDate(d => new Date(d.getFullYear(), d.getMonth() + 1, 1))}
              className="p-1 rounded-md hover:bg-[hsl(var(--muted))] text-[hsl(var(--muted-foreground))] transition-colors"
              aria-label="Next month"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>

          {/* Weekday labels */}
          <div className="grid grid-cols-7 mb-1">
            {WEEKDAYS.map(w => (
              <div
                key={w}
                className="text-center text-[10px] font-semibold text-[hsl(var(--muted-foreground))] py-0.5 uppercase tracking-wide"
              >
                {w}
              </div>
            ))}
          </div>

          {/* Day grid */}
          <div className="grid grid-cols-7 gap-y-0.5">
            {grid.map((day, i) => {
              const inMonth = day.getMonth() === viewDate.getMonth();
              const isToday = isSameDay(day, today);
              const isSelected = !!selected && isSameDay(day, selected);
              const disabled = startOfDay(day) < startOfDay(floor);
              return (
                <button
                  key={i}
                  type="button"
                  disabled={disabled}
                  onClick={() => handleDayClick(day)}
                  className={cn(
                    'h-7 w-7 mx-auto flex items-center justify-center rounded-full text-xs transition-colors',
                    !inMonth && 'text-[hsl(var(--muted-foreground))]/30',
                    inMonth && !isSelected && 'text-[hsl(var(--foreground))]',
                    isToday && !isSelected && 'border border-[hsl(var(--green)/0.5)]',
                    isSelected && 'bg-[hsl(var(--green))] text-black font-semibold',
                    disabled && 'opacity-25 cursor-not-allowed',
                    !disabled && !isSelected && 'hover:bg-[hsl(var(--muted))]',
                  )}
                >
                  {day.getDate()}
                </button>
              );
            })}
          </div>

          {/* Time row */}
          <div className="mt-3 pt-3 border-t border-[hsl(var(--border))] flex items-center gap-2">
            <Clock className="w-3.5 h-3.5 text-[hsl(var(--muted-foreground))] shrink-0" />
            <select
              value={hour}
              onChange={e => {
                const h = Number(e.target.value);
                setHour(h);
                if (selected) commit(selected, h, minute);
              }}
              className="h-8 rounded-md border border-[hsl(var(--border))] bg-[hsl(var(--muted))] px-2 text-xs text-[hsl(var(--foreground))] focus:outline-none focus:ring-1 focus:ring-[hsl(var(--green))]"
            >
              {Array.from({ length: 24 }, (_, h) => (
                <option key={h} value={h}>
                  {pad(h)}
                </option>
              ))}
            </select>
            <span className="text-xs text-[hsl(var(--muted-foreground))]">:</span>
            <select
              value={minute}
              onChange={e => {
                const m = Number(e.target.value);
                setMinute(m);
                if (selected) commit(selected, hour, m);
              }}
              className="h-8 rounded-md border border-[hsl(var(--border))] bg-[hsl(var(--muted))] px-2 text-xs text-[hsl(var(--foreground))] focus:outline-none focus:ring-1 focus:ring-[hsl(var(--green))]"
            >
              {Array.from({ length: 60 }, (_, m) => (
                <option key={m} value={m}>
                  {pad(m)}
                </option>
              ))}
            </select>

            <div className="flex-1" />

            <button
              type="button"
              onClick={() => {
                if (!selected) commit(today, hour, minute);
                setOpen(false);
              }}
              className="text-xs font-semibold text-[hsl(var(--green))] hover:underline"
            >
              Done
            </button>
          </div>

          {selected && (
            <button
              type="button"
              onClick={handleClear}
              className="mt-2.5 w-full text-center text-[10px] text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))] transition-colors"
            >
              Clear — send immediately instead
            </button>
          )}
        </div>
      )}
    </div>
  );
}
