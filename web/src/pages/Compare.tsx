import { useEffect, useMemo } from 'react';
import { Area, Bar, CartesianGrid, ComposedChart, Line, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { useT } from '../i18n';
import { useApp } from '../store';
import { regionName, useSensor, type Dataset } from '../lib/data';
import { availableYears } from '../lib/stats';
import { yearStats, type YearStats } from '../lib/season';
import { doyLabel, signed, signedPct, versus } from '../lib/format';
import { LevelBadge } from '../components/Level';
import { CleaningTable } from '../components/CleaningTable';

const COL_A = '#0B3D91', COL_B = '#B8400E';
const MONTH_START = [1, 32, 60, 91, 121, 152, 182, 213, 244, 274, 305, 335];
const TIP = { borderRadius: 4, border: '1px solid #C9CED6', background: '#FFFFFF', color: '#0B0D12', fontSize: 13, boxShadow: '0 6px 20px rgba(11,13,18,.08)' };

const pctChange = (a: number, b: number) => (a > 0 ? signedPct(Math.round((100 * (b - a)) / a)) : '—');
const tone = (d: number | null) => (d === null || d === 0 ? '' : d > 0 ? 'is-up' : 'is-down');

export function Compare({ data }: { data: Dataset }) {
  const tt = useT();
  const { regionId, year, yearB, set } = useApp();
  const SENSOR = useSensor(data);
  const years = useMemo(() => availableYears(data, SENSOR), [data, SENSOR]);
  const region = (regionId && data.regionById.get(regionId)) || data.regions[0];

  // keep both years inside what the data holds, and different from each other
  const a = years.includes(year) ? year : years[0];
  const b = years.includes(yearB) && yearB !== a ? yearB : years.find((y) => y !== a) ?? a;
  useEffect(() => {
    if (region && (region.region_id !== regionId || a !== year || b !== yearB)) set({ regionId: region.region_id, year: a, yearB: b });
  }, [region, regionId, a, b, year, yearB, set]);

  const A = useMemo(() => (region ? yearStats(data, region.region_id, SENSOR, a) : null), [data, region, SENSOR, a]);
  const B = useMemo(() => (region ? yearStats(data, region.region_id, SENSOR, b) : null), [data, region, SENSOR, b]);
  const cum = region ? data.cumulative[SENSOR]?.[region.region_id] : undefined;
  const compact = new Intl.NumberFormat(tt.locale, { notation: 'compact', maximumFractionDigits: 1 });

  const curve = useMemo(() => {
    const ya = cum?.years[String(a)], yb = cum?.years[String(b)];
    if (!cum || !ya || !yb) return [];
    return cum.envelope.map((e, i) => ({ doy: e.doy, band: [e.p10, e.p90] as [number, number], a: ya[i], b: yb[i] }));
  }, [cum, a, b]);
  const monthly = useMemo(
    () => (A && B ? A.months.map((m, i) => ({ month: i + 1, a: m?.n ?? null, b: B.months[i]?.n ?? null, usual: m?.median ?? B.months[i]?.median ?? null })) : []),
    [A, B],
  );

  if (!region || !A || !B) return <main className="home" id="main"><p className="state">{tt.t('bulletin.noData')}</p></main>;
  const cleaning = data.meta.cleaning?.[SENSOR]?.[region.country];
  const name = regionName(region);

  const row = (label: string, va: string, vb: string, change: string, d: number | null = null, note?: string) => (
    <tr key={label}>
      <th scope="row">{label}{note && <small>{note}</small>}</th>
      <td className="num">{va}</td>
      <td className="num">{vb}</td>
      <td className={`num strong ${tone(d)}`}>{change}</td>
    </tr>
  );
  const vsUsual = (s: YearStats) => (s.verdict ? versus(tt, s.verdict.n, s.verdict.median) : '—');
  const peak = (s: YearStats) => (s.peak ? `${tt.monthShort(s.peak.month)} · ${tt.num(s.peak.n)}` : '—');
  const fx = (v: number | null, digits: number, unit: string) => (v === null ? '—' : `${signed(v, digits)}${unit}`);
  const diff = (x: number | null, y: number | null) => (x === null || y === null ? null : y - x);
  const dHalf = diff(A.halfDoy, B.halfDoy), dT = diff(A.tAnom, B.tAnom), dR = diff(A.rainAnom, B.rainAnom), dF = diff(A.forestShare, B.forestShare);

  return (
    <main className="home compare" id="main">
      <header className="page-head">
        <div>
          <h1>{tt.t('compare.title')}</h1>
          <p className="lead">{tt.t('compare.lead')}</p>
        </div>
        <div className="period cmp-pick">
          <label className="period-field">
            <span className="sr-only">{tt.t('home.colCountry')}</span>
            <select value={region.region_id} onChange={(e) => set({ regionId: e.target.value })}>
              {data.regions.map((r) => <option key={r.region_id} value={r.region_id}>{regionName(r)}</option>)}
            </select>
          </label>
          <label className="period-field cmp-a">
            <span className="sr-only">{tt.t('compare.yearA')}</span>
            <select value={a} onChange={(e) => set({ year: Number(e.target.value) })}>
              {years.filter((y) => y !== b).map((y) => <option key={y} value={y}>{y}</option>)}
            </select>
          </label>
          <span className="cmp-vs mono">{tt.t('compare.vs')}</span>
          <label className="period-field cmp-b">
            <span className="sr-only">{tt.t('compare.yearB')}</span>
            <select value={b} onChange={(e) => set({ yearB: Number(e.target.value) })}>
              {years.filter((y) => y !== a).map((y) => <option key={y} value={y}>{y}</option>)}
            </select>
          </label>
        </div>
      </header>

      <dl className="kpis kpis-4">
        {[A, B].map((s, i) => (
          <div className="kpi" key={s.year}>
            <dt><span className="cmp-key" style={{ background: i ? COL_B : COL_A }} />{tt.t('compare.kpiYear', { year: s.year })}</dt>
            <dd>
              <span className="kpi-value mono">{tt.num(s.total)}</span>
              <span className="kpi-sub">{s.verdict ? <LevelBadge level={s.verdict.level} size="sm" /> : tt.t('compare.partial')} {s.verdict && tt.t('compare.vsUsual', { v: vsUsual(s) })}</span>
            </dd>
          </div>
        ))}
        <div className="kpi">
          <dt>{tt.t('compare.kpiChange', { a, b })}</dt>
          <dd>
            <span className={`kpi-value mono ${tone(B.total - A.total)}`}>{pctChange(A.total, B.total)}</span>
            <span className="kpi-sub">{tt.t('compare.kpiChangeSub', { n: `${signed(B.total - A.total).replace(/\d+/, (d) => tt.num(Number(d)))}` })}</span>
          </dd>
        </div>
        <div className="kpi">
          <dt>{tt.t('compare.kpiAbove')}</dt>
          <dd>
            <span className="kpi-value mono">{A.above} → {B.above}</span>
            <span className="kpi-sub">{tt.t('compare.kpiAboveSub')}</span>
          </dd>
        </div>
      </dl>

      <div className="cmp-grid" data-tour="compare">
        <section>
          <header className="sec-head"><h2>{tt.t('compare.figures')}</h2><span className="mono">{name}</span></header>
          <div className="table-wrap">
            <table className="data">
              <thead>
                <tr>
                  <th scope="col">{tt.t('compare.colMetric')}</th>
                  <th scope="col" className="num">{a}</th>
                  <th scope="col" className="num">{b}</th>
                  <th scope="col" className="num">{tt.t('compare.colChange')}</th>
                </tr>
              </thead>
              <tbody>
                {row(tt.t('compare.mTotal'), tt.num(A.total), tt.num(B.total), pctChange(A.total, B.total), B.total - A.total)}
                {row(tt.t('compare.mVsUsual'), vsUsual(A), vsUsual(B), '')}
                {row(tt.t('compare.mPeak'), peak(A), peak(B), A.peak && B.peak ? pctChange(A.peak.n, B.peak.n) : '—', A.peak && B.peak ? B.peak.n - A.peak.n : null)}
                {row(tt.t('compare.mAbove'), String(A.above), String(B.above), signed(B.above - A.above), B.above - A.above)}
                {row(tt.t('compare.mHalf'), A.halfDoy ? doyLabel(A.halfDoy) : '—', B.halfDoy ? doyLabel(B.halfDoy) : '—', dHalf === null ? '—' : tt.tp('compare.days', Math.abs(dHalf), { n: signed(dHalf) }), null, tt.t('compare.mHalfNote'))}
                {row(tt.t('compare.mTemp'), fx(A.tAnom, 1, ' °C'), fx(B.tAnom, 1, ' °C'), dT === null ? '—' : `${signed(dT, 1)} °C`, dT, tt.t('compare.mTempNote'))}
                {row(tt.t('compare.mRain'), fx(A.rainAnom, 0, '%'), fx(B.rainAnom, 0, '%'), dR === null ? '—' : `${signed(dR)} ${tt.t('compare.pts')}`, null, tt.t('compare.mRainNote'))}
                {row(tt.t('compare.mForest'), A.forestShare === null ? '—' : `${Math.round(A.forestShare * 100)}%`, B.forestShare === null ? '—' : `${Math.round(B.forestShare * 100)}%`, dF === null ? '—' : `${signed(Math.round(dF * 100))} ${tt.t('compare.pts')}`, null, tt.t('compare.mForestNote'))}
              </tbody>
            </table>
          </div>
        </section>

        <section>
          <header className="sec-head"><h2>{tt.t('compare.season')}</h2><span className="mono">NASA FIRMS</span></header>
          {curve.length > 0 ? (
            <>
              <div className="chart" dir="ltr" role="img" aria-label={tt.t('compare.seasonAxis', { a, b })}>
                <ResponsiveContainer width="100%" height={260}>
                  <ComposedChart data={curve} margin={{ top: 12, right: 12, bottom: 0, left: 0 }}>
                    <CartesianGrid stroke="var(--line)" vertical={false} />
                    <XAxis dataKey="doy" type="number" domain={[1, 365]} ticks={MONTH_START} tickFormatter={(d: number) => tt.monthShort(MONTH_START.indexOf(d) + 1)} tick={{ fontSize: 12, fill: 'var(--muted)' }} interval="preserveStartEnd" minTickGap={4} />
                    <YAxis width={44} tickFormatter={(v: number) => compact.format(v)} tick={{ fontSize: 12, fill: 'var(--muted)' }} allowDecimals={false} />
                    <Tooltip
                      formatter={(value: number | [number, number], key: string) =>
                        key === 'band' && Array.isArray(value) ? [`${tt.num(value[0])} – ${tt.num(value[1])}`, tt.t('season.band')] : [tt.num(value as number), key === 'a' ? String(a) : String(b)]}
                      labelFormatter={(d: number) => doyLabel(d)}
                      contentStyle={TIP} itemStyle={{ color: '#0B0D12' }} labelStyle={{ color: '#5B6472' }}
                    />
                    <Area dataKey="band" stroke="none" fill="var(--band)" isAnimationActive={false} />
                    <Line dataKey="a" stroke={COL_A} strokeWidth={2} dot={false} isAnimationActive={false} />
                    <Line dataKey="b" stroke={COL_B} strokeWidth={2} dot={false} isAnimationActive={false} />
                  </ComposedChart>
                </ResponsiveContainer>
              </div>
              <ul className="chart-legend">
                <li><span className="swatch swatch-line" style={{ background: COL_A }} />{a}</li>
                <li><span className="swatch swatch-line" style={{ background: COL_B }} />{b}</li>
                <li><span className="swatch swatch-band" />{tt.t('season.band')}</li>
              </ul>
            </>
          ) : <p className="muted pad-y">{tt.t('season.unavailable')}</p>}
        </section>
      </div>

      <section className="cmp-months">
        <header className="sec-head"><h2>{tt.t('compare.months')}</h2><span className="mono">{a} · {b}</span></header>
        <div className="chart" dir="ltr" role="img" aria-label={tt.t('compare.monthsAxis', { a, b })}>
          <ResponsiveContainer width="100%" height={220}>
            <ComposedChart data={monthly} margin={{ top: 12, right: 12, bottom: 0, left: 0 }} barGap={2}>
              <CartesianGrid stroke="var(--line)" vertical={false} />
              <XAxis dataKey="month" tickFormatter={(m: number) => tt.monthShort(m)} tick={{ fontSize: 12, fill: 'var(--muted)' }} />
              <YAxis width={44} tickFormatter={(v: number) => compact.format(v)} tick={{ fontSize: 12, fill: 'var(--muted)' }} allowDecimals={false} />
              <Tooltip
                formatter={(value: number, key: string) => [tt.num(value), key === 'a' ? String(a) : key === 'b' ? String(b) : tt.t('home.colUsual')]}
                labelFormatter={(m: number) => tt.monthName(m)}
                cursor={{ fill: 'rgba(11,13,18,0.04)' }} contentStyle={TIP} itemStyle={{ color: '#0B0D12' }} labelStyle={{ color: '#5B6472' }}
              />
              <Bar dataKey="a" fill={COL_A} radius={2} isAnimationActive={false} />
              <Bar dataKey="b" fill={COL_B} radius={2} isAnimationActive={false} />
              <Line dataKey="usual" stroke="var(--muted)" strokeDasharray="4 4" strokeWidth={1.5} dot={false} isAnimationActive={false} />
            </ComposedChart>
          </ResponsiveContainer>
        </div>
        <details className="cmp-detail">
          <summary>{tt.t('compare.monthTable')}</summary>
          <div className="table-wrap">
            <table className="data">
              <thead>
                <tr>
                  <th scope="col">{tt.t('compare.colMonth')}</th>
                  <th scope="col" className="num">{a}</th>
                  <th scope="col">{tt.t('home.colLevel')}</th>
                  <th scope="col" className="num">{b}</th>
                  <th scope="col">{tt.t('home.colLevel')}</th>
                  <th scope="col" className="num">{tt.t('compare.colChange')}</th>
                  <th scope="col" className="num">{tt.t('home.colUsual')}</th>
                </tr>
              </thead>
              <tbody>
                {monthly.map((m, i) => {
                  const ma = A.months[i], mb = B.months[i];
                  return (
                    <tr key={m.month}>
                      <th scope="row">{tt.monthName(m.month)}</th>
                      <td className="num">{ma ? tt.num(ma.n) : '—'}</td>
                      <td>{ma && <LevelBadge level={ma.level} size="sm" />}</td>
                      <td className="num">{mb ? tt.num(mb.n) : '—'}</td>
                      <td>{mb && <LevelBadge level={mb.level} size="sm" />}</td>
                      <td className={`num strong ${ma && mb ? tone(mb.n - ma.n) : ''}`}>{ma && mb ? (ma.n > 0 ? pctChange(ma.n, mb.n) : signed(mb.n - ma.n)) : '—'}</td>
                      <td className="num muted">{m.usual !== null ? tt.num(m.usual) : '—'}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </details>
        <p className="kpi-note">{tt.t('compare.usualNote')}</p>
      </section>

      {cleaning && (
        <details className="cmp-clean cmp-detail">
          <summary>
            <span role="heading" aria-level={2}>{tt.t('compare.cleaning')}</span>
            <span className="mono">{cleaning.file}</span>
          </summary>
          <div className="cmp-clean-content">
            <CleaningTable steps={cleaning.steps} className="data" />
            <p className="kpi-note">{tt.t('compare.cleaningNote')}</p>
            <button className="btn" onClick={() => set({ page: 'method' })}>{tt.t('home.ctaMethod')}</button>
          </div>
        </details>
      )}
    </main>
  );
}
