import { useMemo } from 'react';
import { useT } from '../i18n';
import { useApp } from '../store';
import { regionName, useSensor, type Dataset } from '../lib/data';
import { availableYears, computeVerdict } from '../lib/stats';
import { levelRank } from '../levels';
import { OverviewHero } from './home/OverviewHero';
import { MonthlySnapshot } from './home/MonthlySnapshot';
import { LiveActivitySection } from './home/LiveActivitySection';
import type { CountryMonthSummary } from './home/types';

const listFmt = new Intl.ListFormat('en-GB', { style: 'long', type: 'conjunction' });

/** One plain sentence summarises how countries compare with their historical baseline. */
function summarize(tt: ReturnType<typeof useT>, rows: CountryMonthSummary[]): string {
  const above = rows.filter(({ verdict }) => levelRank(verdict.level) >= levelRank('high')).map(({ region }) => regionName(region));
  const within = rows.filter(({ verdict }) => verdict.level === 'normal').map(({ region }) => regionName(region));
  const below = rows.filter(({ verdict }) => verdict.level === 'low').map(({ region }) => regionName(region));
  return [
    above.length ? tt.tp('home.sumAbove', above.length, { names: listFmt.format(above) }) : tt.t('home.sumNone'),
    within.length ? tt.tp('home.sumNormal', within.length, { names: listFmt.format(within) }) : '',
    below.length ? tt.tp('home.sumBelow', below.length, { names: listFmt.format(below) }) : '',
  ].filter(Boolean).join('; ') + '.';
}

export function Home({ data }: { data: Dataset }) {
  const tt = useT();
  const { year, month, set } = useApp();
  const sensor = useSensor(data);
  const years = useMemo(() => availableYears(data, sensor), [data, sensor]);
  const period = tt.period(year, month);

  const rows = useMemo(() => data.regions
    .flatMap((region) => {
      const verdict = computeVerdict(data, region.region_id, sensor, year, month);
      return verdict ? [{ region, verdict }] : [];
    })
    .sort((a, b) => {
      const distance = (ratio: number | null) => Math.abs(Math.log(Math.max(ratio ?? 1, 0.0001)));
      return distance(b.verdict.ratio) - distance(a.verdict.ratio);
    }), [data, sensor, year, month]);

  const archiveYears = useMemo(() => data.anomalies
    .filter((row) => row.sensor === sensor)
    .map((row) => row.year), [data, sensor]);
  const firstYear = archiveYears.length ? Math.min(...archiveYears) : undefined;
  const lastYear = archiveYears.length ? Math.max(...archiveYears) : undefined;
  const totalDetections = rows.reduce((sum, row) => sum + row.verdict.n, 0);
  const aboveUsual = rows.filter(({ verdict }) => levelRank(verdict.level) >= levelRank('high')).length;
  const insight = summarize(tt, rows);
  const open = (regionId: string) => set({ page: 'app', regionId, year, month });

  return (
    <main className="home overview-page" id="main">
      <OverviewHero
        years={years}
        period={period}
        insight={insight}
        countryCount={rows.length}
        aboveUsual={aboveUsual}
        onOpenMap={() => set({ page: 'app' })}
      />

      <MonthlySnapshot
        data={data}
        rows={rows}
        sensor={sensor}
        year={year}
        month={month}
        period={period}
        firstYear={firstYear}
        lastYear={lastYear}
        totalDetections={totalDetections}
        onOpen={open}
        onOpenMethod={() => set({ page: 'method' })}
      />

      <LiveActivitySection data={data} onOpen={open} />

      <footer className="overview-footer">
        <p>{tt.t('footer.source', { sensor })}{data.meta.data_until && <> · {tt.t('footer.until', { date: tt.date(data.meta.data_until) })}</>}</p>
        {firstYear && lastYear && <p>{tt.t('home.archive', { n: tt.num(data.anomalies.filter((row) => row.sensor === sensor).reduce((sum, row) => sum + row.n, 0)), first: firstYear, last: lastYear })}</p>}
      </footer>
    </main>
  );
}
