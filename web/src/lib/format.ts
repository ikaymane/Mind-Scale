/** Small shared formatters, so every page writes the same figure the same way. */
import type { T } from '../i18n';
import { monthRuns } from './season';

/** How far from usual, as one short figure: ×2.4 from 1.5 times up, else a signed percentage. Never ×∞. */
export function versus(tt: T, n: number, usual: number): string {
  if (usual <= 0) return '—';
  const r = n / usual;
  if (r >= 1.5) return `×${tt.ratio(r)}`;
  return signedPct(Math.round((r - 1) * 100));
}

export const signedPct = (pct: number) => (pct === 0 ? '0%' : `${pct > 0 ? '+' : '−'}${Math.abs(pct)}%`);
export const signed = (v: number, digits = 0) => (v === 0 ? '0' : `${v > 0 ? '+' : '−'}${Math.abs(v).toFixed(digits)}`);

/** [8,9,10] gives "Aug–Oct"; wraps over the new year. */
export function monthsLabel(tt: T, months: number[]): string {
  return monthRuns(months).map(([a, b]) => (a === b ? tt.monthShort(a) : `${tt.monthShort(a)}–${tt.monthShort(b)}`)).join(', ');
}

const dm = new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short', timeZone: 'UTC' });
const dmy = new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' });
/** ["2026-11-07", …, "2026-11-13"] gives "7 Nov – 13 Nov 2026" */
export function dayRange(dates: string[]): string {
  if (!dates.length) return '';
  const a = new Date(`${dates[0]}T12:00:00Z`), b = new Date(`${dates[dates.length - 1]}T12:00:00Z`);
  return `${dm.format(a)} – ${dmy.format(b)}`;
}
/** Day of year (1..365) as "14 Aug" */
export const doyLabel = (doy: number) => dm.format(new Date(Date.UTC(2001, 0, doy)));
