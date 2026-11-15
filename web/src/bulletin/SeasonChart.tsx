import { useMemo } from 'react';
import { Area, CartesianGrid, ComposedChart, Line, ReferenceDot, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { LEVEL_STYLE, type Level } from '../levels';
import { useT } from '../i18n';
import type { CumulativeRegion } from '../lib/data';

const MONTH_START = [1, 32, 60, 91, 121, 152, 182, 213, 244, 274, 305, 335];
const monthEnd = (m: number | null) => (m === null ? 365 : m === 12 ? 365 : MONTH_START[m] - 1);

/** Bloc 2 — courbe cumulée de l'année choisie sur la zone habituelle (p10–p90). */
export function SeasonChart({ cum, year, month, level }: { cum: CumulativeRegion | undefined; year: number; month: number | null; level: Level }) {
  const tt = useT();
  const series = cum?.years[String(year)];

  const data = useMemo(() => {
    if (!cum || !series) return [];
    return cum.envelope.map((e, i) => ({ doy: e.doy, band: [e.p10, e.p90] as [number, number], p50: e.p50, y: series[i] }));
  }, [cum, series]);

  if (!cum || !series) {
    return (
      <section className="block">
        <header className="block-head"><h3>{tt.t('season.title')}</h3></header>
        <p className="muted">{tt.t('season.unavailable')}</p>
      </section>
    );
  }

  const end = monthEnd(month);
  const at = data[end - 1];
  const statusKey = at.y > at.band[1] ? 'above' : at.y < at.band[0] ? 'below' : 'inside';
  const compact = new Intl.NumberFormat(tt.locale, { notation: 'compact', maximumFractionDigits: 1 });

  return (
    <section className="block">
      <header className="block-head"><h3>{tt.t('season.title')}</h3><span className="block-src mono">NASA FIRMS</span></header>
      <p className="block-lead">
        {tt.t('season.status', {
          period: tt.period(year, month),
          n: tt.tp('sentence.detections', at.y, { n: tt.num(at.y) }),
          status: tt.t(`season.${statusKey}`),
        })}
      </p>
      {/* Les graphiques restent de gauche à droite, même en arabe */}
      <div className="chart" dir="ltr" role="img" aria-label={tt.t('season.axis')}>
        <ResponsiveContainer width="100%" height={200}>
          <ComposedChart data={data} margin={{ top: 8, right: 12, bottom: 0, left: 0 }}>
            <CartesianGrid stroke="var(--line)" vertical={false} />
            <XAxis dataKey="doy" type="number" domain={[1, 365]} ticks={MONTH_START} tickFormatter={(d: number) => tt.monthShort(MONTH_START.indexOf(d) + 1)} tick={{ fontSize: 12, fill: 'var(--muted)' }} interval="preserveStartEnd" minTickGap={4} />
            <YAxis width={44} tickFormatter={(v: number) => compact.format(v)} tick={{ fontSize: 12, fill: 'var(--muted)' }} allowDecimals={false} />
            <Tooltip
              formatter={(value: number | [number, number], key: string) =>
                key === 'band' && Array.isArray(value)
                  ? [`${tt.num(value[0])} – ${tt.num(value[1])}`, tt.t('season.band')]
                  : [tt.num(value as number), key === 'p50' ? tt.t('season.median') : String(year)]}
              labelFormatter={(d: number) => {
                const m = MONTH_START.findLastIndex((s) => s <= d);
                return `${d - MONTH_START[m] + 1} ${tt.monthName(m + 1)}`;
              }}
              contentStyle={{ borderRadius: 4, border: '1px solid var(--line-2)', background: 'var(--surface)', color: 'var(--ink)', fontSize: 13, boxShadow: '0 6px 20px rgba(11,13,18,.12)' }} itemStyle={{ color: 'var(--ink)' }} labelStyle={{ color: 'var(--muted)' }}
            />
            <Area dataKey="band" stroke="none" fill="var(--band)" isAnimationActive={false} />
            <Line dataKey="p50" stroke="var(--muted)" strokeDasharray="4 4" strokeWidth={1.5} dot={false} isAnimationActive={false} />
            <Line dataKey="y" stroke="var(--ink)" strokeWidth={2} dot={false} isAnimationActive={false} />
            <ReferenceDot x={end} y={at.y} r={6} fill={LEVEL_STYLE[level].fill} stroke="var(--surface)" strokeWidth={2} />
          </ComposedChart>
        </ResponsiveContainer>
      </div>
      <ul className="chart-legend">
        <li><span className="swatch swatch-band" />{tt.t('season.band')}</li>
        <li><span className="swatch swatch-dash" />{tt.t('season.median')}</li>
        <li><span className="swatch swatch-line" />{year}</li>
      </ul>
    </section>
  );
}
