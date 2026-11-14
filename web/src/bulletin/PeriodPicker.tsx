import { useT } from '../i18n';
import { useApp } from '../store';

const Chevron = ({ right }: { right: boolean }) => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d={right ? 'm9 6 6 6-6 6' : 'm15 6-6 6 6 6'} />
  </svg>
);

export function PeriodPicker({ years }: { years: number[] }) {
  const tt = useT();
  const { year, month, set } = useApp();
  const minY = years[0], maxY = years[years.length - 1];
  const step = (d: number) => {
    if (month === null) { set({ year: Math.min(maxY, Math.max(minY, year + d)) }); return; }
    let m = month + d, y = year;
    if (m < 1) { m = 12; y--; }
    if (m > 12) { m = 1; y++; }
    if (y < minY || y > maxY) return;
    set({ year: y, month: m });
  };
  const atStart = year === minY && (month === null || month === 1);
  const atEnd = year === maxY && (month === null || month === 12);
  return (
    <div className="period">
      <button className="step" onClick={() => step(-1)} disabled={atStart} aria-label={tt.t('bulletin.prev')}><Chevron right={false} /></button>
      <label className="period-field">
        <span className="sr-only">{tt.t('bulletin.month')}</span>
        <select value={month ?? 'all'} onChange={(e) => set({ month: e.target.value === 'all' ? null : Number(e.target.value) })}>
          <option value="all">{tt.t('bulletin.allYear')}</option>
          {Array.from({ length: 12 }, (_, i) => <option key={i} value={i + 1}>{tt.monthName(i + 1)}</option>)}
        </select>
      </label>
      <label className="period-field">
        <span className="sr-only">{tt.t('bulletin.year')}</span>
        <select value={year} onChange={(e) => set({ year: Number(e.target.value) })}>
          {years.map((y) => <option key={y} value={y}>{y}</option>)}
        </select>
      </label>
      <button className="step" onClick={() => step(1)} disabled={atEnd} aria-label={tt.t('bulletin.next')}><Chevron right /></button>
    </div>
  );
}
