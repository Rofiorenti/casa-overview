import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/** Formatta numero come valuta EUR con tabular-nums, locale IT */
export function eur(v: number | null | undefined, opts: { decimals?: number; compact?: boolean } = {}) {
  if (v == null || Number.isNaN(v)) return '—';
  const { decimals = 0, compact = false } = opts;
  if (compact && Math.abs(v) >= 1000) {
    return new Intl.NumberFormat('it-IT', {
      style: 'currency',
      currency: 'EUR',
      notation: 'compact',
      maximumFractionDigits: 1,
    }).format(v);
  }
  return new Intl.NumberFormat('it-IT', {
    style: 'currency',
    currency: 'EUR',
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(v);
}

export function num(v: number | null | undefined, decimals = 0) {
  if (v == null || Number.isNaN(v)) return '—';
  return new Intl.NumberFormat('it-IT', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(v);
}

export function pct(v: number | null | undefined, decimals = 1) {
  if (v == null || Number.isNaN(v)) return '—';
  return new Intl.NumberFormat('it-IT', {
    style: 'percent',
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(v);
}

export function formatDate(isoLike: string | Date | undefined, opts: Intl.DateTimeFormatOptions = { day: '2-digit', month: 'short', year: 'numeric' }) {
  if (!isoLike) return '—';
  const d = typeof isoLike === 'string' ? new Date(isoLike) : isoLike;
  if (Number.isNaN(d.getTime())) return '—';
  return new Intl.DateTimeFormat('it-IT', opts).format(d);
}

export function monthKey(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

export function parseMonthKey(key: string): { year: number; month: number } {
  const [y, m] = key.split('-').map(Number);
  return { year: y, month: m };
}
