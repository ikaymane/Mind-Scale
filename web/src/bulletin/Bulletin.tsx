import { useMemo, useState } from 'react';
import { useT } from '../i18n';
import { useApp } from '../store';
import { regionName, useSensor, type Dataset } from '../lib/data';
import { availableYears, computeVerdict, yearSeries } from '../lib/stats';
import { LEVEL_STYLE } from '../levels';
import { LevelIcon } from '../components/Level';
import { PeriodPicker } from './PeriodPicker';
import { Verdict } from './Verdict';
import { SeasonChart } from './SeasonChart';
import { HistoryBars } from './HistoryBars';
import { Conditions } from './Conditions';
import { Safety } from './Safety';

function toCsv(data: Dataset, regionId: string, sensor: string, year: number, month: number | null) {
  const rows = (data.bySeries.get(`${regionId}|${sensor}`) ?? []).filter((r) => r.year === year && (month === null || r.month === month));
  const name = regionName(data.regionById.get(regionId)).replace(/"/g, '""');
  const head = 'region_id,region_name,sensor,year,month,detections,usual_median,p10,p90,level';
  const body = rows.map((r) => `${r.region_id},"${name}",${r.sensor},${r.year},${r.month},${r.n},${r.median},${r.p10},${r.p90},${r.level}`);
  return [head, ...body].join('\n');
}

function Actions({ data, regionId }: { data: Dataset; regionId: string }) {
  const tt = useT();
  const sensor = useSensor(data);
  const { year, month } = useApp();
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
    const blob = new Blob([toCsv(data, regionId, sensor, year, month)], { type: 'text/csv;charset=utf-8' });
    const period = month === null ? 'all-months' : String(month).padStart(2, '0');
    const a = Object.assign(document.createElement('a'), { href: URL.createObjectURL(blob), download: `niran_${regionId}_${sensor}_${year}-${period}.csv` });
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
      <p className="source mono">
        {tt.t('footer.source', { sensor })}{data.meta.data_until && <> · {tt.t('footer.until', { date: tt.date(data.meta.data_until) })}</>}
      </p>
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
        <PeriodPicker years={years} />
      </header>
      <p className="muted pad">{tt.t('bulletin.pickRegion')}</p>
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
    </article>
  );
}

export function Bulletin({ data }: { data: Dataset }) {
  const tt = useT();
  const [safetyOpen, setSafetyOpen] = useState(false);
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
        <PeriodPicker years={years} />
      </header>
      {verdict ? (
        <>
          <Verdict v={verdict} year={year} month={month} />
          <details className="bulletin-details" data-tour="safety" onToggle={(event) => setSafetyOpen(event.currentTarget.open)}>
            <summary>
              <span>{tt.t('safety.disclosureTitle')}</span>
              <span className="block-src mono">{tt.t('safety.disclosureHint')}</span>
            </summary>
            {safetyOpen && <Safety data={data} regionId={region.region_id} />}
          </details>
          <SeasonChart cum={data.cumulative[sensor]?.[region.region_id]} year={year} month={month} level={verdict.level} />
          <HistoryBars series={series} year={year} month={month} median={verdict.median} />
          <Conditions ctx={ctx} month={month} />
        </>
      ) : (
        <section className="block"><p>{tt.t('bulletin.noData')}</p></section>
      )}
      <Actions data={data} regionId={region.region_id} />
    </article>
  );
}
