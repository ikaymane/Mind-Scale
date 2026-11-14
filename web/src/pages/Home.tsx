import { useMemo, useState } from 'react';
import { useT } from '../i18n';
import { useApp } from '../store';
import { regionName, useSensor, type Dataset } from '../lib/data';
import { availableYears, computeVerdict } from '../lib/stats';
import { useNow } from '../lib/now';
import { monthsToSeason, seasonOf } from '../lib/season';
import { dayRange, monthsLabel, versus } from '../lib/format';
import { LEVEL_STYLE, levelRank } from '../levels';
import { LevelBadge } from '../components/Level';
import { PeriodPicker } from '../bulletin/PeriodPicker';
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

function LiveActivity({ data, onOpen }: { data: Dataset; onOpen: (regionId: string) => void }) {
  const tt = useT();
  const now = useNow(data);
  const sensor = useSensor(data);
  const thisMonth = new Date().getUTCMonth() + 1;
  const seasons = useMemo(() => new Map(data.regions.map((r) => [r.region_id, seasonOf(data, r.region_id, sensor)])), [data, sensor]);

  return (
    <section className="ov-split" aria-label={tt.t('globe.label')}>
      <div className="dash-globe">
        <Globe data={data} mode="home" onPick={onOpen} />
      </div>
      <div className="ov-live" data-tour="live">
        <header className="ov-head">
          <h2>{tt.t('home.liveTitle')}</h2>
          <span className="ov-src mono">{now ? dayRange(now.dates) : tt.t('home.nowSource')}</span>
        </header>
        <ul className="live-list">
          {data.regions.map((r) => {
            const h = now ? now.regions.get(r.region_id) : undefined;
            const season = seasons.get(r.region_id);
            const wait = season ? monthsToSeason(season, thisMonth) : null;
            return (
              <li key={r.region_id}>
                <button className="live-row" onClick={() => onOpen(r.region_id)} aria-label={tt.t('home.open', { name: regionName(r) })}>
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
  );
}

export function Home({ data }: { data: Dataset }) {
  const tt = useT();
  const { year, month, set } = useApp();
  const [liveOpen, setLiveOpen] = useState(false);
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
            <button className="btn btn-primary btn-lg" onClick={() => set({ page: 'app' })}>{tt.t('home.cta')}</button>
            <button className="btn btn-lg" onClick={() => useTour.getState().start()}>{tt.t('tour.heroStart')}</button>
          </div>
        </div>
        <div className="hero-period">
          <span className="hero-period-label">{tt.t('home.pickPeriod')}</span>
          <PeriodPicker years={years} />
        </div>
      </header>

      {/* The selected period and the country comparisons are the main task. */}
      <section className="ov-block" aria-labelledby="ov-month">
        <header className="ov-head">
          <div>
            <p className="eyebrow">{tt.t('home.step1')}</p>
            <h2 id="ov-month">{tt.t('home.monthTitle', { period })}</h2>
          </div>
          <span className="ov-src mono">NASA FIRMS · {SENSOR}</span>
        </header>
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
        {first && <p className="home-note">{tt.t('home.usualNote', { first, last })} <button className="text-btn" onClick={() => set({ page: 'method' })}>{tt.t('home.ctaMethod')}</button></p>}
      </section>

      <details className="home-more" onToggle={(event) => setLiveOpen(event.currentTarget.open)}>
        <summary>{tt.t('home.moreLive')}</summary>
        {liveOpen && <LiveActivity data={data} onOpen={(id) => open(id)} />}
      </details>

      <footer className="page-footer">
        <p>{tt.t('footer.source', { sensor: SENSOR })}{data.meta.data_until && <> · {tt.t('footer.until', { date: tt.date(data.meta.data_until) })}</>} · {tt.t('home.archive', { n: tt.num(archive), first, last })}</p>
        <p>{tt.t('home.kicker')}</p>
      </footer>
    </main>
  );
}
