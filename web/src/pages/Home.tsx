import { useMemo } from 'react';
import { useT } from '../i18n';
import { useApp } from '../store';
import { regionName, useSensor, type Dataset } from '../lib/data';
import { availableYears, computeVerdict } from '../lib/stats';
import { versus } from '../lib/format';
import { LEVEL_STYLE, levelRank } from '../levels';
import { LevelBadge } from '../components/Level';
import { PeriodPicker } from '../bulletin/Bulletin';
import { Globe } from '../globe/Globe';
import type { T } from '../i18n';
import type { Level } from '../levels';

const listFmt = new Intl.ListFormat('en-GB', { style: 'long', type: 'conjunction' });

/** One plain sentence for the period: who is above, within and below their usual level. */
function summary(tt: T, rows: { name: string; level: Level }[]): string {
  const rank = (l: Level) => levelRank(l);
  const above = rows.filter((x) => rank(x.level) >= rank('high')).map((x) => x.name);
  const below = rows.filter((x) => x.level === 'low').map((x) => x.name);
  const normal = rows.filter((x) => x.level === 'normal').map((x) => x.name);
  const parts = [
    above.length ? tt.tp('home.sumAbove', above.length, { names: listFmt.format(above) }) : tt.t('home.sumNone'),
    normal.length ? tt.tp('home.sumNormal', normal.length, { names: listFmt.format(normal) }) : '',
    below.length ? tt.tp('home.sumBelow', below.length, { names: listFmt.format(below) }) : '',
  ].filter(Boolean);
  return `${parts.join('; ')}.`;
}

function Kpi({ label, value, sub }: { label: string; value: string; sub: string }) {
  return (
    <div className="kpi">
      <dt>{label}</dt>
      <dd>
        <span className="kpi-value mono">{value}</span>
        <span className="kpi-sub">{sub}</span>
      </dd>
    </div>
  );
}

export function Home({ data }: { data: Dataset }) {
  const tt = useT();
  const { year, month, set } = useApp();
  const SENSOR = useSensor(data);
  const years = useMemo(() => availableYears(data, SENSOR), [data, SENSOR]);
  const period = tt.period(year, month);

  // One line per country for the chosen period, furthest from usual first
  const rows = useMemo(
    () => data.regions
      .flatMap((r) => { const v = computeVerdict(data, r.region_id, SENSOR, year, month); return v ? [{ r, v }] : []; })
      .sort((a, b) => (b.v.ratio ?? 0) - (a.v.ratio ?? 0)),
    [data, SENSOR, year, month],
  );

  const kpi = useMemo(() => {
    const n = rows.reduce((s, x) => s + x.v.n, 0);
    const usual = rows.reduce((s, x) => s + x.v.median, 0);
    const above = rows.filter((x) => levelRank(x.v.level) >= levelRank('high')).length;
    return { n, usual, above, top: rows[0] };
  }, [rows]);

  const open = (regionId: string) => set({ page: 'app', regionId });

  return (
    <main className="home" id="main">
      <header className="page-head home-hero">
        <div>
          <h1>{tt.t('home.title')}</h1>
          {rows.length > 0
            ? <p className="lead"><b>{period}:</b> {summary(tt, rows.map(({ r, v }) => ({ name: regionName(r), level: v.level })))}</p>
            : <p className="lead">{tt.t('home.lead')}</p>}
        </div>
        <PeriodPicker years={years} />
      </header>

      <dl className="kpis kpis-4">
        <Kpi label={tt.t('home.kpiDetections')} value={rows.length ? tt.num(kpi.n) : '—'} sub={tt.t('home.kpiDetectionsSub', { period, n: rows.length })} />
        <Kpi label={tt.t('home.kpiVs')} value={rows.length ? versus(tt, kpi.n, kpi.usual) : '—'} sub={tt.t('home.kpiVsSub', { n: tt.num(kpi.usual) })} />
        <Kpi label={tt.t('home.kpiAbove')} value={tt.t('home.kpiAboveValue', { n: kpi.above, total: rows.length })} sub={tt.t('home.kpiAboveSub')} />
        <Kpi
          label={tt.t('home.kpiTop')}
          value={kpi.top ? versus(tt, kpi.top.v.n, kpi.top.v.median) : '—'}
          sub={kpi.top ? `${regionName(kpi.top.r)} · ${tt.t(`level.${kpi.top.v.level}`)}` : tt.t('bulletin.noData')}
        />
      </dl>

      <ul className="cc-grid">
        {rows.map(({ r, v }) => (
          <li key={r.region_id}>
            <button className="cc" style={{ ['--lv' as string]: LEVEL_STYLE[v.level].fill }} onClick={() => open(r.region_id)} aria-label={tt.t('home.open', { name: regionName(r) })}>
              <span className="cc-top">
                <span className="cc-name">{regionName(r)}</span>
                <LevelBadge level={v.level} size="sm" />
              </span>
              <span className="cc-big mono">{versus(tt, v.n, v.median)}</span>
              <span className="cc-sub">{tt.t('home.ccLine', { n: tt.num(v.n), usual: tt.num(v.median) })}</span>
              <span className="cc-year" aria-hidden="true">
                {Array.from({ length: 12 }, (_, i) => {
                  const a = data.anomalyIndex.get(`${r.region_id}|${SENSOR}|${year}|${i + 1}`);
                  return (
                    <span key={i} className={month === i + 1 ? 'is-on' : ''} title={`${tt.monthName(i + 1)} ${year}${a ? ` · ${tt.t(`level.${a.level}`)}` : ''}`}>
                      <i style={a ? { background: LEVEL_STYLE[a.level].fill } : undefined} />
                      <b>{tt.monthShort(i + 1).slice(0, 1)}</b>
                    </span>
                  );
                })}
              </span>
            </button>
          </li>
        ))}
        {rows.length === 0 && <li className="muted">{tt.t('bulletin.noData')}</li>}
      </ul>

      <section className="home-globe" aria-label={tt.t('globe.label')}>
        <Globe data={data} mode="home" onPick={(id) => open(id)} />
      </section>

      <footer className="page-footer">
        <p>{tt.t('footer.source', { sensor: SENSOR })}</p>
        <p>{tt.t('home.kicker')}</p>
      </footer>
    </main>
  );
}
