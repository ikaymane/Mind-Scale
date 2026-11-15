import { useEffect, useMemo, useState } from 'react';
import { useT } from '../i18n';
import { useApp } from '../store';
import { useSensor, type Dataset } from '../lib/data';
import { dayRange, monthsLabel } from '../lib/format';
import { useNow } from '../lib/now';
import { monthsToSeason, seasonOf } from '../lib/season';
import { levelRank } from '../levels';
import { LevelBadge } from '../components/Level';
import { Sk } from '../components/Skeleton';

const thisMonth = () => new Date().getUTCMonth() + 1;

/** Card — fire safety right now: live NASA detections of the last 7 days against the usual level. */
export function NowCard({ data, regionId }: { data: Dataset; regionId: string }) {
  const tt = useT();
  const now = useNow(data);
  const here = now ? now.regions.get(regionId) : undefined;
  return (
    <section className="block safety">
      <header className="block-head">
        <h3>{tt.t('safety.title')}</h3>
        <span className="block-src mono">{tt.t('safety.nowSource')}</span>
      </header>
      {now === undefined && (
        <div className="sk-col" role="status" aria-label={tt.t('safety.nowLoading')}>
          <div className="sk-row"><Sk w={84} h={28} /><Sk w="60%" h={28} /></div>
          <Sk w="100%" h={36} />
        </div>
      )}
      {now === null && <p className="muted">{tt.t('safety.nowDown')}</p>}
      {now && here && (
        <>
          <p className="safety-now">
            <span className="mono safety-figure">{tt.num(here.n)}{now.failed > 0 ? '+' : ''}</span>
            <span>
              {tt.tp('safety.nowLine', here.n, { range: dayRange(now.dates) })}
              {here.usual !== null && <> {tt.t('safety.nowUsual', { usual: tt.num(here.usual), years: here.refYears })}</>}
            </span>
            {here.level && <LevelBadge level={here.level} size="sm" />}
          </p>
          <span className="days" role="img" aria-label={tt.t('safety.perDay')}>
            {here.perDay.map((n, i) => (
              <span key={i} title={`${now.dates[i]} · ${tt.num(n)}`}>
                <i style={{ height: `${Math.max(4, (100 * n) / Math.max(1, ...here.perDay))}%` }} />
              </span>
            ))}
          </span>
          {now.failed > 0 && <p className="footnote">{tt.t('safety.nowPartial')}</p>}
        </>
      )}
    </section>
  );
}

/** Card — what to do: guidance that follows the live level and the fire season. */
export function TodoCard({ data, regionId }: { data: Dataset; regionId: string }) {
  const tt = useT();
  const now = useNow(data);
  const SENSOR = useSensor(data);
  const season = useMemo(() => seasonOf(data, regionId, SENSOR), [data, regionId, SENSOR]);
  const here = now ? now.regions.get(regionId) : undefined;
  const wait = season ? monthsToSeason(season, thisMonth()) : null;
  const hotNow = !!here?.level && levelRank(here.level) >= levelRank('high');
  const alert = hotNow || wait === 0;
  const emergency = tt.tv<Record<string, string>>('safety.emergency')[regionId];
  return (
    <section className="block safety">
      <header className="block-head">
        <h3>{tt.t('safety.doTitle')}</h3>
        {emergency && <span className="safety-call">{tt.t('safety.emergencyLabel')} <b className="mono">{emergency}</b></span>}
      </header>
      <p className="block-lead">{tt.t(hotNow ? 'safety.doWhyNow' : wait === 0 ? 'safety.doWhySeason' : 'safety.doWhyCalm')}</p>
      <ol className="todo">
        {tt.tv<string[]>(alert ? 'safety.doAlert' : 'safety.doCalm').map((s, i) => <li key={i}>{s}</li>)}
      </ol>
      <p className="footnote">
        {tt.t('safety.guideNote')} <a href={tt.t('safety.guideUrl')} target="_blank" rel="noreferrer">{tt.t('safety.guideSource')}</a>
      </p>
    </section>
  );
}

/** Card — when it burns: the typical year, month by month. Each bar is a button that opens that month. */
export function SeasonCard({ data, regionId }: { data: Dataset; regionId: string }) {
  const tt = useT();
  const SENSOR = useSensor(data);
  const month = useApp((s) => s.month);
  const year = useApp((s) => s.year);
  const set = useApp((s) => s.set);
  const season = useMemo(() => seasonOf(data, regionId, SENSOR), [data, regionId, SENSOR]);

  // Play the year: January to December, one month every beat; the globe and the figures follow.
  const [playing, setPlaying] = useState(false);
  useEffect(() => {
    if (!playing) return;
    const t = setTimeout(() => {
      const m = useApp.getState().month ?? 0;
      if (m >= 12) setPlaying(false); else set({ month: m + 1 });
    }, 1500);
    return () => clearTimeout(t);
  }, [playing, month, set]);
  useEffect(() => { setPlaying(false); }, [regionId, year]);
  const play = () => {
    if (playing) { setPlaying(false); return; }
    set({ month: 1 });
    setPlaying(true);
  };
  if (!season) return null;
  const today = thisMonth();
  const wait = monthsToSeason(season, today);
  const max = Math.max(...season.share);
  return (
    <section className="block safety">
      <header className="block-head">
        <h3>{tt.t('safety.seasonTitle')}</h3>
        <button className={`play-btn ${playing ? 'is-on' : ''}`} onClick={play} aria-pressed={playing}>
          <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">{playing ? <path d="M6 4h4v16H6zM14 4h4v16h-4z" /> : <path d="M7 4.5v15l13-7.5z" />}</svg>
          {playing ? tt.t('globe.pause') : tt.t('safety.playYear', { year })}
        </button>
      </header>
      <p className="block-lead">
        {tt.t('safety.seasonLine', { months: monthsLabel(tt, season.months), pct: Math.round(season.seasonShare * 100), peak: tt.monthName(season.peak) })}{' '}
        <strong>{wait === 0 ? tt.t('safety.seasonIn', { month: tt.monthName(today) }) : tt.tp('safety.seasonOut', wait, { n: wait })}</strong>
      </p>
      <div className="season" role="group" aria-label={tt.t('safety.seasonAxis')}>
        {season.share.map((s, i) => (
          <button
            key={i}
            className={`${season.months.includes(i + 1) ? 'is-season' : ''} ${today === i + 1 ? 'is-today' : ''} ${month === i + 1 ? 'is-on' : ''}`}
            aria-pressed={month === i + 1}
            aria-label={`${tt.monthName(i + 1)} · ${Math.round(s * 100)}%`}
            title={`${tt.monthName(i + 1)} · ${Math.round(s * 100)}%`}
            onClick={() => { setPlaying(false); set({ month: i + 1 }); }}
          >
            <i style={{ height: `${Math.max(3, (100 * s) / max)}%` }} />
            <b>{tt.monthShort(i + 1).slice(0, 1)}</b>
          </button>
        ))}
      </div>
    </section>
  );
}
