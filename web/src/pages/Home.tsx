import { useMemo } from 'react';
import { useT, type T } from '../i18n';
import { useApp } from '../store';
import { regionName, type Dataset } from '../lib/data';
import { availableYears, computeVerdict } from '../lib/stats';
import { EONET_LIMIT, useLiveEvents } from '../lib/eonet';
import { LEVEL_STYLE, levelRank } from '../levels';
import { LevelBadge, LevelLegend } from '../components/Level';
import { PeriodPicker } from '../bulletin/Bulletin';
import { Globe } from '../globe/Globe';

const SENSOR = 'MODIS' as const;

/** How far from usual, as one short figure: ×2.4 from 1.5 times up, else a signed percentage. Never ×∞. */
function versus(tt: T, n: number, median: number): string {
  if (median <= 0) return '—';
  const r = n / median;
  if (r >= 1.5) return `×${tt.ratio(r)}`;
  const pct = Math.round((r - 1) * 100);
  return pct === 0 ? '0%' : `${pct > 0 ? '+' : '−'}${Math.abs(pct)}%`;
}

function Kpi({ label, value, sub, tone }: { label: string; value: string; sub: string; tone?: string }) {
  return (
    <div className="kpi">
      <dt>{label}</dt>
      <dd>
        <span className="kpi-value mono" style={tone ? { color: tone } : undefined}>{value}</span>
        <span className="kpi-sub">{sub}</span>
      </dd>
    </div>
  );
}

export function Home({ data }: { data: Dataset }) {
  const tt = useT();
  const { year, month, set } = useApp();
  const live = useLiveEvents();
  const years = useMemo(() => availableYears(data, SENSOR), [data]);
  const period = tt.period(year, month);

  // One line per country for the chosen period, furthest from usual first
  const rows = useMemo(
    () => data.regions
      .flatMap((r) => { const v = computeVerdict(data, r.region_id, SENSOR, year, month); return v ? [{ r, v }] : []; })
      .sort((a, b) => (b.v.ratio ?? 0) - (a.v.ratio ?? 0)),
    [data, year, month],
  );

  const kpi = useMemo(() => {
    const n = rows.reduce((s, x) => s + x.v.n, 0);
    const usual = rows.reduce((s, x) => s + x.v.median, 0);
    const above = rows.filter((x) => levelRank(x.v.level) >= levelRank('high')).length;
    return { n, usual, above, top: rows[0] };
  }, [rows]);

  // The record: months that left their usual range the furthest, all years
  const records = useMemo(
    () => data.anomalies
      .filter((a) => a.sensor === SENSOR && (a.level === 'extreme' || a.level === 'unusual'))
      .sort((a, b) => b.z - a.z)
      .slice(0, 5),
    [data],
  );

  const archive = useMemo(() => data.anomalies.reduce((s, a) => s + (a.sensor === SENSOR ? a.n : 0), 0), [data]);
  const first = years[0], last = years[years.length - 1];
  const open = (regionId: string, y = year, m: number | null = month) => set({ page: 'app', regionId, year: y, month: m });

  return (
    <main className="home" id="main">
      <header className="page-head">
        <div>
          <h1>{tt.t('home.title')}</h1>
          <p className="lead">{tt.t('home.lead')}</p>
        </div>
        <PeriodPicker years={years} />
      </header>

      <dl className="kpis">
        <Kpi label={tt.t('home.kpiDetections')} value={rows.length ? tt.num(kpi.n) : '—'} sub={tt.t('home.kpiDetectionsSub', { period, n: rows.length })} />
        <Kpi label={tt.t('home.kpiVs')} value={rows.length ? versus(tt, kpi.n, kpi.usual) : '—'} sub={tt.t('home.kpiVsSub', { n: tt.num(kpi.usual) })} />
        <Kpi label={tt.t('home.kpiAbove')} value={tt.t('home.kpiAboveValue', { n: kpi.above, total: rows.length })} sub={tt.t('home.kpiAboveSub')} />
        <Kpi
          label={tt.t('home.kpiTop')}
          value={kpi.top ? versus(tt, kpi.top.v.n, kpi.top.v.median) : '—'}
          sub={kpi.top ? `${regionName(kpi.top.r)} · ${tt.t(`level.${kpi.top.v.level}`)}` : tt.t('bulletin.noData')}
        />
        <Kpi label={tt.t('home.kpiLive')} value={live && live.length ? `${tt.num(live.length)}${live.length >= EONET_LIMIT ? '+' : ''}` : '—'} sub={tt.t('home.kpiLiveSub')} />
      </dl>
      {first && <p className="kpi-note">{tt.t('home.usualNote', { first, last })}</p>}

      <div className="dash">
        <section className="dash-globe" aria-label={tt.t('globe.label')}>
          <Globe data={data} mode="home" onPick={(id) => open(id)} />
        </section>

        <div className="dash-side">
          <section>
            <header className="sec-head">
              <h2>{tt.t('home.countries')}</h2>
              <span className="mono">{period}</span>
            </header>
            <div className="table-wrap">
              <table className="data">
                <thead>
                  <tr>
                    <th scope="col">{tt.t('home.colCountry')}</th>
                    <th scope="col">{tt.t('home.colLevel')}</th>
                    <th scope="col" className="num">{tt.t('home.colDetections')}</th>
                    <th scope="col" className="num">{tt.t('home.colUsual')}</th>
                    <th scope="col" className="num">{tt.t('home.colVs')}</th>
                    <th scope="col" className="col-strip">{tt.t('home.colYear', { year })}</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map(({ r, v }) => (
                    <tr key={r.region_id} className="is-link" onClick={() => open(r.region_id)}>
                      <th scope="row">
                        <button className="row-btn" aria-label={tt.t('home.open', { name: regionName(r) })} onClick={(e) => { e.stopPropagation(); open(r.region_id); }}>
                          {regionName(r)}
                        </button>
                      </th>
                      <td><LevelBadge level={v.level} size="sm" /></td>
                      <td className="num">{tt.num(v.n)}</td>
                      <td className="num muted">{tt.num(v.median)}</td>
                      <td className="num strong">{versus(tt, v.n, v.median)}</td>
                      <td className="col-strip">
                        <span className="strip" aria-hidden="true">
                          {Array.from({ length: 12 }, (_, i) => {
                            const a = data.anomalyIndex.get(`${r.region_id}|${SENSOR}|${year}|${i + 1}`);
                            return (
                              <span
                                key={i}
                                className={month === i + 1 ? 'is-on' : ''}
                                title={`${tt.monthName(i + 1)}${a ? ` · ${tt.t(`level.${a.level}`)}` : ''}`}
                                style={a ? { background: LEVEL_STYLE[a.level].fill } : undefined}
                              />
                            );
                          })}
                        </span>
                      </td>
                    </tr>
                  ))}
                  {rows.length === 0 && <tr><td colSpan={6} className="muted">{tt.t('bulletin.noData')}</td></tr>}
                </tbody>
              </table>
            </div>
          </section>

          {records.length > 0 && (
            <section>
              <header className="sec-head">
                <h2>{tt.t('home.records')}</h2>
                <span className="mono">{first}–{last}</span>
              </header>
              <div className="table-wrap">
                <table className="data">
                  <thead>
                    <tr>
                      <th scope="col" className="num col-rank">{tt.t('home.colRank')}</th>
                      <th scope="col">{tt.t('home.colCountry')}</th>
                      <th scope="col">{tt.t('home.colPeriod')}</th>
                      <th scope="col" className="num">{tt.t('home.colDetections')}</th>
                      <th scope="col" className="num">{tt.t('home.colVs')}</th>
                      <th scope="col">{tt.t('home.colLevel')}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {records.map((a, i) => {
                      const name = regionName(data.regionById.get(a.region_id));
                      return (
                        <tr key={`${a.region_id}-${a.year}-${a.month}`} className="is-link" onClick={() => open(a.region_id, a.year, a.month)}>
                          <td className="num col-rank muted">{i + 1}</td>
                          <th scope="row">
                            <button className="row-btn" aria-label={tt.t('home.open', { name: `${name} ${tt.period(a.year, a.month)}` })} onClick={(e) => { e.stopPropagation(); open(a.region_id, a.year, a.month); }}>
                              {name}
                            </button>
                          </th>
                          <td>{tt.period(a.year, a.month)}</td>
                          <td className="num">{tt.num(a.n)}</td>
                          <td className="num strong">{versus(tt, a.n, a.median)}</td>
                          <td><LevelBadge level={a.level} size="sm" /></td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </section>
          )}
        </div>
      </div>

      <section className="guide">
        <div>
          <h2>{tt.t('home.levelsTitle')}</h2>
          <LevelLegend long />
        </div>
        <div>
          <h2>{tt.t('home.howTitle')}</h2>
          <ul className="plain">
            {tt.tv<string[]>('home.how').map((s, i) => <li key={i}>{s}</li>)}
          </ul>
          <button className="btn" onClick={() => set({ page: 'method' })}>{tt.t('home.ctaMethod')}</button>
        </div>
      </section>

      <footer className="page-footer">
        <p>{tt.t('footer.source')}{data.meta.data_until && <> · {tt.t('footer.until', { date: tt.date(data.meta.data_until) })}</>} · {tt.t('home.archive', { n: tt.num(archive), first, last })}</p>
        <p>{tt.t('home.kicker')}</p>
      </footer>
    </main>
  );
}
