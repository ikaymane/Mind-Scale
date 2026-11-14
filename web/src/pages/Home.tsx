import { useMemo } from 'react';
import { useT } from '../i18n';
import { useApp } from '../store';
import { regionName, useSensor, type Dataset } from '../lib/data';
import { availableYears, computeVerdict } from '../lib/stats';
import { useNow } from '../lib/now';
import { monthsToSeason, seasonOf } from '../lib/season';
import { dayRange, monthsLabel, versus } from '../lib/format';
import { LEVEL_STYLE, levelRank } from '../levels';
import { LevelBadge, LevelLegend } from '../components/Level';
import { PeriodPicker } from '../bulletin/Bulletin';
import { Globe } from '../globe/Globe';
import { useTour } from '../components/Tour';
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
  const now = useNow(data);
  const SENSOR = useSensor(data);
  const thisMonth = new Date().getUTCMonth() + 1;
  const seasons = useMemo(() => new Map(data.regions.map((r) => [r.region_id, seasonOf(data, r.region_id, SENSOR)])), [data, SENSOR]);
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

  // The record: months that left their usual range the furthest, all years
  const records = useMemo(
    () => data.anomalies
      .filter((a) => a.sensor === SENSOR && (a.level === 'extreme' || a.level === 'unusual'))
      .sort((a, b) => b.z - a.z)
      .slice(0, 5),
    [data, SENSOR],
  );

  const archive = useMemo(() => data.anomalies.reduce((s, a) => s + (a.sensor === SENSOR ? a.n : 0), 0), [data, SENSOR]);
  const first = years[0], last = years[years.length - 1];
  const open = (regionId: string, y = year, m: number | null = month) => set({ page: 'app', regionId, year: y, month: m });

  return (
    <main className="home" id="main">
      <header className="page-head home-hero" data-tour="hero">
        <div>
          <h1>{tt.t('home.title')}</h1>
          <p className="lead">{tt.t('home.lead')}</p>
          {rows.length > 0 && (
            <p className="home-summary"><b>{period}:</b> {summary(tt, rows.map(({ r, v }) => ({ name: regionName(r), level: v.level })))}</p>
          )}
          <div className="hero-actions">
            <button className="btn btn-primary btn-lg" onClick={() => useTour.getState().start()}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M7 4.5v15l13-7.5z" /></svg>
              {tt.t('tour.heroStart')}
            </button>
            <button className="btn btn-lg" onClick={() => set({ page: 'app' })}>{tt.t('home.cta')}</button>
          </div>
        </div>
        <div className="hero-period">
          <span className="hero-period-label">{tt.t('home.pickPeriod')}</span>
          <PeriodPicker years={years} />
        </div>
      </header>

      {/* 1 — the month picked above */}
      <section className="ov-block" aria-labelledby="ov-month">
        <header className="ov-head">
          <div>
            <p className="eyebrow">{tt.t('home.step1')}</p>
            <h2 id="ov-month">{tt.t('home.monthTitle', { period })}</h2>
          </div>
          <span className="ov-src mono">NASA FIRMS · {SENSOR}</span>
        </header>
        <dl className="kpis kpis-4" data-tour="kpis">
          <Kpi label={tt.t('home.kpiDetections')} value={rows.length ? tt.num(kpi.n) : '—'} sub={tt.t('home.kpiDetectionsSub', { period, n: rows.length })} />
          <Kpi label={tt.t('home.kpiVs')} value={rows.length ? versus(tt, kpi.n, kpi.usual) : '—'} sub={tt.t('home.kpiVsSub', { n: tt.num(kpi.usual) })} />
          <Kpi label={tt.t('home.kpiAbove')} value={tt.t('home.kpiAboveValue', { n: kpi.above, total: rows.length })} sub={tt.t('home.kpiAboveSub')} />
          <Kpi
            label={tt.t('home.kpiTop')}
            value={kpi.top ? versus(tt, kpi.top.v.n, kpi.top.v.median) : '—'}
            sub={kpi.top ? `${regionName(kpi.top.r)} · ${tt.t(`level.${kpi.top.v.level}`)}` : tt.t('bulletin.noData')}
          />
        </dl>

        <ul className="cc-grid" data-tour="countries">
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
                <span className="cc-open">{tt.t('home.ccOpen')} <span aria-hidden="true">→</span></span>
              </button>
            </li>
          ))}
          {rows.length === 0 && <li className="muted">{tt.t('bulletin.noData')}</li>}
        </ul>
        {first && <p className="kpi-note">{tt.t('home.usualNote', { first, last })}</p>}
      </section>

      {/* 2 — right now: globe + live NASA feed */}
      <section className="ov-block ov-split" aria-labelledby="ov-live">
        <div className="dash-globe" aria-label={tt.t('globe.label')}>
          <Globe data={data} mode="home" onPick={(id) => open(id)} />
        </div>
        <div className="ov-live" data-tour="live">
          <header className="ov-head">
            <div>
              <p className="eyebrow">{tt.t('home.step2')}</p>
              <h2 id="ov-live">{tt.t('home.liveTitle')}</h2>
            </div>
            <span className="ov-src mono">{now ? dayRange(now.dates) : tt.t('home.nowSource')}</span>
          </header>
          <ul className="live-list">
            {data.regions.map((r) => {
              const h = now ? now.regions.get(r.region_id) : undefined;
              const season = seasons.get(r.region_id);
              const wait = season ? monthsToSeason(season, thisMonth) : null;
              return (
                <li key={r.region_id}>
                  <button className="live-row" onClick={() => open(r.region_id)} aria-label={tt.t('home.open', { name: regionName(r) })}>
                    <span className="live-name">{regionName(r)}</span>
                    <span className="live-n mono">{h ? `${tt.num(h.n)}${now && now.failed > 0 ? '+' : ''}` : now === undefined ? '…' : '—'}</span>
                    <span className="live-badge">{h?.level && <LevelBadge level={h.level} size="sm" />}</span>
                    <span className="live-meta">
                      {h && h.usual !== null ? tt.t('home.liveUsual', { n: tt.num(h.usual), vs: versus(tt, h.n, h.usual) }) : tt.t('home.liveUnit')}
                      {season && wait !== null && <> · <b>{wait === 0 ? tt.t('home.seasonIn') : tt.tp('home.seasonOut', wait, { n: wait })}</b> ({monthsLabel(tt, season.months)})</>}
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
          <p className="kpi-note">{now === null ? tt.t('safety.nowDown') : tt.t('home.liveNote')}</p>
        </div>
      </section>

      {/* 3 — the record */}
      {records.length > 0 && (
        <section className="ov-block" aria-labelledby="ov-rec">
          <header className="ov-head">
            <div>
              <p className="eyebrow">{tt.t('home.step3')}</p>
              <h2 id="ov-rec">{tt.t('home.records')}</h2>
            </div>
            <span className="ov-src mono">{first}–{last}</span>
          </header>
          <ol className="rec-list">
            {records.map((a, i) => {
              const name = regionName(data.regionById.get(a.region_id));
              return (
                <li key={`${a.region_id}-${a.year}-${a.month}`}>
                  <button className="rec" onClick={() => open(a.region_id, a.year, a.month)} aria-label={tt.t('home.open', { name: `${name} ${tt.period(a.year, a.month)}` })}>
                    <span className="rec-rank mono">{i + 1}</span>
                    <span className="rec-what"><b>{name}</b><span>{tt.period(a.year, a.month)}</span></span>
                    <span className="rec-vs mono">{versus(tt, a.n, a.median)}</span>
                    <LevelBadge level={a.level} size="sm" />
                  </button>
                </li>
              );
            })}
          </ol>
        </section>
      )}

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
        <p>{tt.t('footer.source', { sensor: SENSOR })}{data.meta.data_until && <> · {tt.t('footer.until', { date: tt.date(data.meta.data_until) })}</>} · {tt.t('home.archive', { n: tt.num(archive), first, last })}</p>
        <p>{tt.t('home.kicker')}</p>
      </footer>
    </main>
  );
}
