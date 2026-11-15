import { useMemo, useState } from 'react';
import { useT } from '../i18n';
import { useApp } from '../store';
import { regionName, useSensor, type Dataset } from '../lib/data';
import { availableYears, computeVerdict, yearSeries } from '../lib/stats';
import { LEVEL_STYLE } from '../levels';
import { LevelIcon } from '../components/Level';
import { Verdict } from './Verdict';
import { SeasonChart } from './SeasonChart';
import { HistoryBars } from './HistoryBars';
import { Conditions } from './Conditions';
import { NowCard, SeasonCard, TodoCard } from './Safety';

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

/** Country picker, set just above the period picker: switch country without going back to the globe. */
export function RegionPicker({ data }: { data: Dataset }) {
  const regionId = useApp((s) => s.regionId);
  const set = useApp((s) => s.set);
  const regions = [...data.regions].sort((a, b) => regionName(a).localeCompare(regionName(b)));
  return (
    <label className="period region-pick">
      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true"><circle cx="12" cy="12" r="9" /><path d="M3 12h18M12 3a14 14 0 0 1 0 18M12 3a14 14 0 0 0 0 18" /></svg>
      <span className="sr-only">Country</span>
      <select value={regionId ?? 'all'} onChange={(e) => set({ regionId: e.target.value === 'all' ? null : e.target.value })}>
        <option value="all">All countries</option>
        {regions.map((r) => <option key={r.region_id} value={r.region_id}>{regionName(r)}</option>)}
      </select>
    </label>
  );
}

function toCsv(data: Dataset, regionId: string) {
  const rows = (data.meta.sensors ?? ['MODIS']).flatMap((s) => data.bySeries.get(`${regionId}|${s}`) ?? []);
  const name = regionName(data.regionById.get(regionId)).replace(/"/g, '""');
  const head = 'region_id,region_name,sensor,year,month,detections,usual_median,p10,p90,level';
  const body = rows.map((r) => `${r.region_id},"${name}",${r.sensor},${r.year},${r.month},${r.n},${r.median},${r.p10},${r.p90},${r.level}`);
  return [head, ...body].join('\n');
}

function Actions({ data, regionId }: { data: Dataset; regionId: string }) {
  const tt = useT();
  const sensor = useSensor(data);
  const [copied, setCopied] = useState(false);
  const share = async () => {
    try { await navigator.clipboard.writeText(location.href); }
    catch {
      const ta = Object.assign(document.createElement('textarea'), { value: location.href });
      document.body.append(ta); ta.select(); document.execCommand('copy'); ta.remove();
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };
  const download = () => {
    const blob = new Blob([toCsv(data, regionId)], { type: 'text/csv;charset=utf-8' });
    const a = Object.assign(document.createElement('a'), { href: URL.createObjectURL(blob), download: `niran_${regionId}.csv` });
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  };
  return (
    <footer className="panel-foot">
      <div className="actions">
        <button className="text-btn" onClick={share}>
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M10 14a5 5 0 0 0 7 0l3-3a5 5 0 0 0-7-7l-1 1" /><path d="M14 10a5 5 0 0 0-7 0l-3 3a5 5 0 0 0 7 7l1-1" /></svg>
          <span role="status">{copied ? tt.t('footer.copied') : tt.t('footer.share')}</span>
        </button>
        <button className="text-btn" onClick={download}>
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M12 4v11M7 10l5 5 5-5M5 20h14" /></svg>
          {tt.t('footer.csv')}
        </button>
      </div>
      <p className="source mono">{tt.t('footer.source', { sensor })}</p>
    </footer>
  );
}

/** No country picked: one line per country, sorted by how far it is from usual. */
function Overview({ data, years }: { data: Dataset; years: number[] }) {
  const tt = useT();
  const { year, month, set } = useApp();
  const sensor = useSensor(data);
  const rows = data.regions
    .map((r) => ({ r, v: computeVerdict(data, r.region_id, sensor, year, month) }))
    .filter((x) => x.v)
    .sort((a, b) => (b.v!.ratio ?? 0) - (a.v!.ratio ?? 0));
  return (
    <article className="panel">
      <header className="panel-head">
        <div>
          <p className="eyebrow">{tt.t('bulletin.title')}</p>
          <h2 className="panel-title">{tt.t('bulletin.overview')}</h2>
        </div>
        <div className="pickers">
          <RegionPicker data={data} />
          <PeriodPicker years={years} />
        </div>
      </header>
      <div className="panel-cards">
      <section className="block">
      <header className="block-head"><h3>{tt.t('bulletin.pickYear')}</h3></header>
      <div className="year-chips" role="group" aria-label={tt.t('bulletin.year')}>
        {years.map((y) => <button key={y} className={y === year ? 'is-on' : ''} aria-pressed={y === year} onClick={() => set({ year: y })}>{y}</button>)}
      </div>
      </section>
      <section className="block">
      <header className="block-head"><h3>{tt.t('bulletin.pickRegion')}</h3><span className="block-src mono">{tt.period(year, month)}</span></header>
      <ul className="ov">
        {rows.map(({ r, v }) => (
          <li key={r.region_id}>
            <button className="ov-row" onClick={() => set({ regionId: r.region_id })} style={{ ['--lv' as string]: LEVEL_STYLE[v!.level].fill }}>
              <span className="ov-icon" style={{ background: LEVEL_STYLE[v!.level].fill, color: LEVEL_STYLE[v!.level].ink }}><LevelIcon level={v!.level} size={14} /></span>
              <span className="ov-name">{regionName(r)}<small>{tt.t(`level.${v!.level}`)}</small></span>
              <span className="ov-num mono">{tt.num(v!.n)}<small>{tt.t('bulletin.statUsual')} {tt.num(v!.median)}</small></span>
              <span className="ov-ratio mono">{v!.ratio !== null ? `×${tt.ratio(v!.ratio)}` : '—'}</span>
            </button>
          </li>
        ))}
      </ul>
      </section>
      </div>
    </article>
  );
}

export function Bulletin({ data }: { data: Dataset }) {
  const tt = useT();
  const { regionId, year, month } = useApp();
  const sensor = useSensor(data);
  const region = regionId ? data.regionById.get(regionId) : undefined;
  const years = useMemo(() => availableYears(data, sensor), [data, sensor]);
  const verdict = useMemo(() => (region ? computeVerdict(data, region.region_id, sensor, year, month) : null), [data, region, sensor, year, month]);
  const series = useMemo(() => (region ? yearSeries(data, region.region_id, sensor, month) : []), [data, region, sensor, month]);

  if (!region) return <Overview data={data} years={years} />;
  const ctx = month !== null ? data.contextIndex.get(`${region.region_id}|${year}|${month}`) : undefined;

  return (
    <article className="panel" aria-labelledby="panel-title">
      <header className="panel-head">
        <div>
          <p className="eyebrow">{tt.t('bulletin.title')}</p>
          <h2 className="panel-title" id="panel-title">{regionName(region)}</h2>
        </div>
        <div className="pickers">
          <RegionPicker data={data} />
          <PeriodPicker years={years} />
        </div>
      </header>
      <div className="panel-cards" key={region.region_id}>
      {verdict ? (
        <>
          <Verdict v={verdict} year={year} month={month} />
          <NowCard data={data} regionId={region.region_id} />
          <TodoCard data={data} regionId={region.region_id} />
          <SeasonCard data={data} regionId={region.region_id} />
          <Conditions data={data} regionId={region.region_id} ctx={ctx} month={month} />
          <SeasonChart cum={data.cumulative[sensor]?.[region.region_id]} year={year} month={month} level={verdict.level} />
          <HistoryBars series={series} year={year} month={month} median={verdict.median} />
        </>
      ) : (
        <section className="block"><p>{tt.t('bulletin.noData')}</p></section>
      )}
      <Actions data={data} regionId={region.region_id} />
      </div>
    </article>
  );
}
