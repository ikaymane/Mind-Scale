import { Bar, BarChart, CartesianGrid, Cell, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { LEVEL_STYLE } from '../levels';
import { useT } from '../i18n';
import { useApp } from '../store';
import type { YearPoint } from '../lib/stats';

/** Bloc 3 — l'historique : une barre par année, colorée selon le niveau, l'année choisie mise en évidence. */
export function HistoryBars({ series, year, month, median }: { series: YearPoint[]; year: number; month: number | null; median: number }) {
  const tt = useT();
  const set = useApp((s) => s.set);
  if (!series.length) return null;
  const first = series[0].year, last = series[series.length - 1].year;
  const compact = new Intl.NumberFormat(tt.locale, { notation: 'compact', maximumFractionDigits: 1 });

  return (
    <section className="block" data-tour="history">
      <header className="block-head">
        <h3>{month === null ? tt.t('history.titleYear') : tt.t('history.title', { ofMonth: tt.ofMonth(month) })}</h3>
        <span className="block-src mono">{first}–{last}</span>
      </header>
      <div className="chart" dir="ltr">
        <ResponsiveContainer width="100%" height={170}>
          <BarChart data={series} margin={{ top: 16, right: 12, bottom: 0, left: 0 }} onClick={(e) => { const y = Number(e?.activeLabel); if (y) set({ year: y }); }}>
            <CartesianGrid stroke="var(--line)" vertical={false} />
            <XAxis dataKey="year" tick={{ fontSize: 12, fill: 'var(--muted)' }} tickLine={false} interval="preserveStartEnd" />
            <YAxis width={44} tickFormatter={(v: number) => compact.format(v)} tick={{ fontSize: 12, fill: 'var(--muted)' }} allowDecimals={false} />
            <Tooltip
              cursor={{ fill: 'var(--hover)' }}
              formatter={(v: number, _k, item) => [`${tt.tp('sentence.detections', v, { n: tt.num(v) })} · ${tt.t(`level.${(item.payload as YearPoint).level}`)}`, '']}
              separator=""
              contentStyle={{ borderRadius: 4, border: '1px solid #C9CED6', background: '#FFFFFF', color: '#0B0D12', fontSize: 13, boxShadow: '0 6px 20px rgba(11,13,18,.08)' }} itemStyle={{ color: '#0B0D12' }} labelStyle={{ color: '#5B6472' }}
            />
            <ReferenceLine y={median} stroke="var(--ink)" strokeDasharray="4 4" label={{ value: tt.t('history.normal'), position: 'insideTopRight', fontSize: 12, fill: 'var(--ink-2)' }} />
            <Bar dataKey="n" radius={[2, 2, 0, 0]} isAnimationActive={false} style={{ cursor: 'pointer' }}>
              {series.map((p) => (
                <Cell
                  key={p.year}
                  fill={LEVEL_STYLE[p.level].fill}
                  fillOpacity={p.year === year ? 1 : 0.45}
                  stroke={p.year === year ? '#0B0D12' : 'none'}
                  strokeWidth={2}
                />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
      <p className="hint">{tt.t('history.hint')}</p>
    </section>
  );
}
