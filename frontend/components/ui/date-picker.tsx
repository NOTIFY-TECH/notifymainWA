'use client';

import * as React from 'react';
import { cn } from '@/lib/utils';

/* ──────────────────────────────────────────────────────────────
   NotifyTechAI DatePicker
   - Controlled: value + onChange
   - Optional time picker below calendar
   - Range mode: rangeStart + rangeEnd + onRangeChange
   - No external library — pure React
   ────────────────────────────────────────────────────────────── */

const WEEKDAYS = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];
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

function getDaysInMonth(year: number, month: number) {
  return new Date(year, month + 1, 0).getDate();
}

function isSameDay(a: Date, b: Date) {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

function isBetween(date: Date, start: Date, end: Date) {
  return date > start && date < end;
}

/* ── ChevronLeft / ChevronRight tiny SVGs ── */
const ChevronLeft = () => (
  <svg
    width="14"
    height="14"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <path d="m15 18-6-6 6-6" />
  </svg>
);

const ChevronRight = () => (
  <svg
    width="14"
    height="14"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <path d="m9 18 6-6-6-6" />
  </svg>
);

const CalendarIcon = () => (
  <svg
    width="15"
    height="15"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <rect width="18" height="18" x="3" y="4" rx="2" ry="2" />
    <line x1="16" x2="16" y1="2" y2="6" />
    <line x1="8" x2="8" y1="2" y2="6" />
    <line x1="3" x2="21" y1="10" y2="10" />
  </svg>
);

/* ── Calendar grid ── */
interface CalendarProps {
  month: number;
  year: number;
  selected?: Date | null;
  rangeStart?: Date | null;
  rangeEnd?: Date | null;
  minDate?: Date;
  maxDate?: Date;
  onSelect: (date: Date) => void;
}

function Calendar({ month, year, selected, rangeStart, rangeEnd, minDate, maxDate, onSelect }: CalendarProps) {
  const firstDayOfWeek = new Date(year, month, 1).getDay();
  const daysInMonth = getDaysInMonth(year, month);
  const daysInPrevMonth = getDaysInMonth(year, month - 1);
  const today = new Date();

  const cells: { date: Date; otherMonth: boolean }[] = [];

  // Prev month trailing days
  for (let i = firstDayOfWeek - 1; i >= 0; i--) {
    cells.push({
      date: new Date(year, month - 1, daysInPrevMonth - i),
      otherMonth: true,
    });
  }

  // Current month
  for (let d = 1; d <= daysInMonth; d++) {
    cells.push({ date: new Date(year, month, d), otherMonth: false });
  }

  // Next month leading days
  const remaining = 42 - cells.length;
  for (let d = 1; d <= remaining; d++) {
    cells.push({ date: new Date(year, month + 1, d), otherMonth: true });
  }

  return (
    <div className="datepicker-grid">
      {WEEKDAYS.map(d => (
        <div key={d} className="datepicker-weekday">
          {d}
        </div>
      ))}
      {cells.map(({ date, otherMonth }, i) => {
        const isSelected = selected ? isSameDay(date, selected) : false;
        const isToday = isSameDay(date, today);
        const isStart = rangeStart ? isSameDay(date, rangeStart) : false;
        const isEnd = rangeEnd ? isSameDay(date, rangeEnd) : false;
        const isInRange = rangeStart && rangeEnd ? isBetween(date, rangeStart, rangeEnd) : false;
        const isDisabled = (minDate && date < minDate) || (maxDate && date > maxDate);

        return (
          <button
            key={i}
            type="button"
            onClick={() => !isDisabled && onSelect(date)}
            className={cn(
              'datepicker-day',
              otherMonth && 'other-month',
              isToday && !isSelected && 'today',
              isSelected && 'selected',
              isStart && 'range-start',
              isEnd && 'range-end',
              isInRange && 'in-range',
              isDisabled && 'disabled',
            )}
          >
            {date.getDate()}
          </button>
        );
      })}
    </div>
  );
}

/* ── Single Date Picker ── */
export interface DatePickerProps {
  value?: Date | null;
  onChange?: (date: Date | null) => void;
  placeholder?: string;
  label?: string;
  showTime?: boolean;
  minDate?: Date;
  maxDate?: Date;
  disabled?: boolean;
  className?: string;
}

export const DatePicker: React.FC<DatePickerProps> = ({
  value,
  onChange,
  placeholder = 'Pick a date',
  label,
  showTime = false,
  minDate,
  maxDate,
  disabled,
  className,
}) => {
  const [open, setOpen] = React.useState(false);
  const ref = React.useRef<HTMLDivElement>(null);

  const now = value ?? new Date();
  const [viewMonth, setViewMonth] = React.useState(now.getMonth());
  const [viewYear, setViewYear] = React.useState(now.getFullYear());
  const [timeH, setTimeH] = React.useState(value ? String(value.getHours()).padStart(2, '0') : '00');
  const [timeM, setTimeM] = React.useState(value ? String(value.getMinutes()).padStart(2, '0') : '00');

  // Close on outside click
  React.useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const handleSelect = (date: Date) => {
    if (showTime) {
      const d = new Date(date);
      d.setHours(Number(timeH));
      d.setMinutes(Number(timeM));
      onChange?.(d);
    } else {
      onChange?.(date);
      setOpen(false);
    }
  };

  const handleTimeApply = () => {
    if (value) {
      const d = new Date(value);
      d.setHours(Number(timeH));
      d.setMinutes(Number(timeM));
      onChange?.(d);
    }
    setOpen(false);
  };

  const formatDisplay = (d: Date) => {
    const date = d.toLocaleDateString('en-IN', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    });
    if (showTime) {
      const time = d.toLocaleTimeString('en-IN', {
        hour: '2-digit',
        minute: '2-digit',
        hour12: false,
      });
      return `${date}, ${time}`;
    }
    return date;
  };

  const prevMonth = () => {
    if (viewMonth === 0) {
      setViewMonth(11);
      setViewYear(y => y - 1);
    } else setViewMonth(m => m - 1);
  };

  const nextMonth = () => {
    if (viewMonth === 11) {
      setViewMonth(0);
      setViewYear(y => y + 1);
    } else setViewMonth(m => m + 1);
  };

  return (
    <div ref={ref} style={{ position: 'relative', display: 'inline-block' }}>
      {label && (
        <label className="input-label" style={{ display: 'block', marginBottom: 4 }}>
          {label}
        </label>
      )}
      <button
        type="button"
        className={cn('datepicker-trigger', className)}
        onClick={() => !disabled && setOpen(o => !o)}
        disabled={disabled}
      >
        <CalendarIcon />
        {value ? <span>{formatDisplay(value)}</span> : <span className="placeholder">{placeholder}</span>}
      </button>

      {open && (
        <div className="datepicker-panel" style={{ position: 'absolute', top: '100%', left: 0, marginTop: 4 }}>
          <div className="datepicker-header">
            <button type="button" className="datepicker-nav-btn" onClick={prevMonth}>
              <ChevronLeft />
            </button>
            <span className="datepicker-month-label">
              {MONTHS[viewMonth]} {viewYear}
            </span>
            <button type="button" className="datepicker-nav-btn" onClick={nextMonth}>
              <ChevronRight />
            </button>
          </div>

          <Calendar
            month={viewMonth}
            year={viewYear}
            selected={value}
            minDate={minDate}
            maxDate={maxDate}
            onSelect={handleSelect}
          />

          {showTime && (
            <div className="datepicker-time">
              <input
                type="number"
                min={0}
                max={23}
                value={timeH}
                onChange={e => setTimeH(String(e.target.value).padStart(2, '0'))}
                className="datepicker-time-input"
                style={{ width: 52 }}
              />
              <span className="datepicker-time-sep">:</span>
              <input
                type="number"
                min={0}
                max={59}
                value={timeM}
                onChange={e => setTimeM(String(e.target.value).padStart(2, '0'))}
                className="datepicker-time-input"
                style={{ width: 52 }}
              />
              <button
                type="button"
                className="btn btn-primary btn-sm"
                onClick={handleTimeApply}
                style={{ marginLeft: 'auto' }}
              >
                Apply
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

/* ── Date Range Picker ── */
export interface DateRangePickerProps {
  startDate?: Date | null;
  endDate?: Date | null;
  onChange?: (range: { start: Date | null; end: Date | null }) => void;
  placeholder?: string;
  label?: string;
  minDate?: Date;
  maxDate?: Date;
  disabled?: boolean;
  className?: string;
}

export const DateRangePicker: React.FC<DateRangePickerProps> = ({
  startDate,
  endDate,
  onChange,
  placeholder = 'Select date range',
  label,
  minDate,
  maxDate,
  disabled,
  className,
}) => {
  const [open, setOpen] = React.useState(false);
  const [selecting, setSelecting] = React.useState<'start' | 'end'>('start');
  const ref = React.useRef<HTMLDivElement>(null);

  const now = new Date();
  const [viewMonth, setViewMonth] = React.useState(now.getMonth());
  const [viewYear, setViewYear] = React.useState(now.getFullYear());

  React.useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
        setSelecting('start');
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const handleSelect = (date: Date) => {
    if (selecting === 'start') {
      onChange?.({ start: date, end: null });
      setSelecting('end');
    } else {
      if (startDate && date < startDate) {
        onChange?.({ start: date, end: startDate });
      } else {
        onChange?.({ start: startDate ?? null, end: date });
      }
      setOpen(false);
      setSelecting('start');
    }
  };

  const formatRange = () => {
    const fmt = (d: Date) => d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
    if (startDate && endDate) return `${fmt(startDate)} – ${fmt(endDate)}`;
    if (startDate) return `${fmt(startDate)} – ?`;
    return null;
  };

  const prevMonth = () => {
    if (viewMonth === 0) {
      setViewMonth(11);
      setViewYear(y => y - 1);
    } else setViewMonth(m => m - 1);
  };

  const nextMonth = () => {
    if (viewMonth === 11) {
      setViewMonth(0);
      setViewYear(y => y + 1);
    } else setViewMonth(m => m + 1);
  };

  return (
    <div ref={ref} style={{ position: 'relative', display: 'inline-block' }}>
      {label && (
        <label className="input-label" style={{ display: 'block', marginBottom: 4 }}>
          {label}
        </label>
      )}
      <button
        type="button"
        className={cn('datepicker-trigger', className)}
        onClick={() => !disabled && setOpen(o => !o)}
        disabled={disabled}
        style={{ minWidth: 240 }}
      >
        <CalendarIcon />
        {formatRange() ? <span>{formatRange()}</span> : <span className="placeholder">{placeholder}</span>}
      </button>

      {open && (
        <div className="datepicker-panel" style={{ position: 'absolute', top: '100%', left: 0, marginTop: 4 }}>
          <div className="datepicker-header">
            <button type="button" className="datepicker-nav-btn" onClick={prevMonth}>
              <ChevronLeft />
            </button>
            <span className="datepicker-month-label">
              {MONTHS[viewMonth]} {viewYear}
            </span>
            <button type="button" className="datepicker-nav-btn" onClick={nextMonth}>
              <ChevronRight />
            </button>
          </div>

          <Calendar
            month={viewMonth}
            year={viewYear}
            rangeStart={startDate}
            rangeEnd={endDate}
            minDate={minDate}
            maxDate={maxDate}
            onSelect={handleSelect}
          />

          <div
            style={{
              paddingTop: 'var(--space-3)',
              marginTop: 'var(--space-3)',
              borderTop: '1px solid var(--border)',
              fontSize: 'var(--text-xs)',
              color: 'var(--text-muted)',
              textAlign: 'center',
            }}
          >
            {selecting === 'start' ? 'Click to set start date' : 'Now click end date'}
          </div>
        </div>
      )}
    </div>
  );
};
