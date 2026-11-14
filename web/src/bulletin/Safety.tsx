import { useEffect, useMemo, useState } from 'react';
import { useT } from '../i18n';
import { useSensor, type Dataset } from '../lib/data';
import { dayRange, monthsLabel } from '../lib/format';
import { useNow } from '../lib/now';
import { driversOf, monthsToSeason, seasonOf } from '../lib/season';
import { levelRank } from '../levels';
import { LevelBadge } from '../components/Level';

type ChecklistState = { key: string; done: boolean[] };

function readChecklist(key: string, count: number): boolean[] {
  try {
    const parsed = JSON.parse(localStorage.getItem(key) ?? '[]') as unknown;
    return Array.from({ length: count }, (_, i) => Array.isArray(parsed) && parsed[i] === true);
  } catch {
    return Array.from({ length: count }, () => false);
  }
}

function ReadinessChecklist({ regionId, mode, items }: { regionId: string; mode: 'active' | 'prepare'; items: string[] }) {
  const tt = useT();
  const year = new Date().getUTCFullYear();
  const key = `niran.readiness.v1.${regionId}.${year}.${mode}`;
  const [saved, setSaved] = useState<ChecklistState>(() => ({ key, done: readChecklist(key, items.length) }));
  const done = saved.key === key ? saved.done : readChecklist(key, items.length);
  const count = done.filter(Boolean).length;
  const complete = count === items.length;

  useEffect(() => {
    if (saved.key !== key) setSaved({ key, done: readChecklist(key, items.length) });
  }, [items.length, key, saved.key]);

  useEffect(() => {
    if (saved.key !== key) return;
    try { localStorage.setItem(key, JSON.stringify(saved.done)); } catch { /* checklist still works for this visit */ }
  }, [key, saved]);

  const toggle = (index: number, checked: boolean) => {
    setSaved((current) => {
      const next = current.key === key ? [...current.done] : readChecklist(key, items.length);
      next[index] = checked;
      return { key, done: next };
    });
  };

  return (
    <div className="readiness-plan">
      <div className="readiness-head">
        <div>
          <strong>{tt.t('safety.planProgress', { done: count, total: items.length })}</strong>
          <span>{complete ? tt.t('safety.planComplete') : tt.t('safety.planPrompt')}</span>
        </div>
        {count > 0 && <button className="text-btn" onClick={() => setSaved({ key, done: items.map(() => false) })}>{tt.t('safety.planReset')}</button>}
      </div>
      <div className="readiness-track" role="progressbar" aria-label={tt.t('safety.planLabel')} aria-valuemin={0} aria-valuemax={items.length} aria-valuenow={count}>
        <span style={{ width: `${items.length ? (count / items.length) * 100 : 0}%` }} />
      </div>
      <ul className="todo">
        {items.map((item, i) => (
          <li key={`${mode}-${i}`}>
            <label className={done[i] ? 'is-done' : ''}>
              <input type="checkbox" checked={done[i] ?? false} onChange={(event) => toggle(i, event.currentTarget.checked)} />
              <span>{item}</span>
            </label>
          </li>
        ))}
      </ul>
      <p className="footnote">{tt.t('safety.planSaved')}</p>
    </div>
  );
}

/** Fire safety: what is happening now, when this country burns, what the weather was in bad months, what to do. */
export function Safety({ data, regionId }: { data: Dataset; regionId: string }) {
  const tt = useT();
  const now = useNow(data);
  const SENSOR = useSensor(data);
  const season = useMemo(() => seasonOf(data, regionId, SENSOR), [data, regionId, SENSOR]);
  const drivers = useMemo(() => driversOf(data, regionId, SENSOR), [data, regionId, SENSOR]);
  const thisMonth = new Date().getUTCMonth() + 1;
  const here = now ? now.regions.get(regionId) : undefined;

  const wait = season ? monthsToSeason(season, thisMonth) : null;
  const hotNow = !!here?.level && levelRank(here.level) >= levelRank('high');
  const alert = hotNow || wait === 0;
  const emergency = tt.tv<Record<string, string>>('safety.emergency')[regionId];
  const max = season ? Math.max(...season.share) : 0;

  return (
    <section className="block safety">
      <header className="block-head">
        <h3>{tt.t('safety.title')}</h3>
        <span className="block-src mono">{tt.t('safety.source')}</span>
      </header>

      <div className="safety-part">
        <h4>{tt.t('safety.nowTitle')}</h4>
        <p className="footnote">{tt.t('safety.nowNote')}</p>
        {now === undefined && <p className="muted">{tt.t('safety.nowLoading')}</p>}
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
            <p className="footnote">{tt.t('safety.perDayCaption', { range: dayRange(now.dates) })}</p>
            {now.failed > 0 && <p className="footnote">{tt.t('safety.nowPartial')}</p>}
          </>
        )}
      </div>

      {season && wait !== null && (
        <div className="safety-part">
          <h4>{tt.t('safety.seasonTitle')}</h4>
          <p className="block-lead">
            {tt.t('safety.seasonLine', { months: monthsLabel(tt, season.months), pct: Math.round(season.seasonShare * 100), peak: tt.monthName(season.peak) })}{' '}
            <strong>{wait === 0 ? tt.t('safety.seasonIn', { month: tt.monthName(thisMonth) }) : tt.tp('safety.seasonOut', wait, { n: wait })}</strong>
          </p>
          <div className="season" role="img" aria-label={tt.t('safety.seasonAxis')}>
            {season.share.map((s, i) => (
              <span key={i} className={`${season.months.includes(i + 1) ? 'is-season' : ''} ${thisMonth === i + 1 ? 'is-today' : ''}`} title={`${tt.monthName(i + 1)} · ${Math.round(s * 100)}%`}>
                <i style={{ height: `${Math.max(3, (100 * s) / max)}%` }} />
                <b>{tt.monthShort(i + 1).slice(0, 1)}</b>
              </span>
            ))}
          </div>
        </div>
      )}

      <div className="safety-part">
        <h4>{tt.t('safety.doTitle')}</h4>
        <p className="block-lead">{tt.t(hotNow ? 'safety.doWhyNow' : wait === 0 ? 'safety.doWhySeason' : 'safety.doWhyCalm')}</p>
        <ReadinessChecklist regionId={regionId} mode={alert ? 'active' : 'prepare'} items={tt.tv<string[]>(alert ? 'safety.doAlert' : 'safety.doCalm')} />
        {emergency && <p className="safety-call">{tt.t('safety.emergencyLabel')} <b className="mono">{emergency}</b></p>}
        <p className="footnote">
          {tt.t('safety.guideNote')} <a href={tt.t('safety.guideUrl')} target="_blank" rel="noreferrer">{tt.t('safety.guideSource')}</a>
        </p>
      </div>

      {drivers && (
        <div className="safety-part">
          <h4>{tt.t('safety.driversTitle')}</h4>
          {drivers.months === 0 ? <p className="muted">{tt.t('safety.driversNone')}</p> : (
            <ul className="plain tight">
              <li>{tt.t('safety.driversHot', { a: drivers.hotter, n: drivers.months, b: drivers.allHotter, m: drivers.allMonths })}</li>
              {drivers.rainKnown > 0 && <li>{tt.t('safety.driversDry', { a: drivers.drier, n: drivers.rainKnown, b: drivers.allDrier, m: drivers.allRainKnown })}</li>}
            </ul>
          )}
          <p className="footnote">{tt.t('safety.driversNote')}</p>
        </div>
      )}
    </section>
  );
}
