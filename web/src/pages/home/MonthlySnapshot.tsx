import { useT } from '../../i18n';
import { regionName, type Dataset } from '../../lib/data';
import type { Sensor } from '../../store';
import { versus } from '../../lib/format';
import { LEVEL_STYLE } from '../../levels';
import { LevelBadge } from '../../components/Level';
import type { CountryMonthSummary } from './types';

function CountrySignalCard({ data, row, sensor, year, month, onOpen }: {
  data: Dataset;
  row: CountryMonthSummary;
  sensor: Sensor;
  year: number;
  month: number | null;
  onOpen: (regionId: string) => void;
}) {
  const tt = useT();
  const name = regionName(row.region);
  const { verdict } = row;

  return (
    <li>
      <button
        className="country-signal-card"
        style={{ ['--signal-color' as string]: LEVEL_STYLE[verdict.level].fill, ['--signal-soft' as string]: LEVEL_STYLE[verdict.level].soft }}
        onClick={() => onOpen(row.region.region_id)}
        aria-label={`${tt.t('home.open', { name })}. ${tt.t(`level.${verdict.level}`)}. ${versus(tt, verdict.n, verdict.median)} ${tt.t('home.ccVsUsual')}.`}
      >
        <span className="country-signal-top">
          <span className="country-signal-name">{name}</span>
          <LevelBadge level={verdict.level} size="sm" />
        </span>
        <span className="country-signal-main">
          <span className="country-signal-delta mono">{versus(tt, verdict.n, verdict.median)}</span>
          <span className="country-signal-detail">{tt.t('home.ccLine', { n: tt.num(verdict.n), usual: tt.num(verdict.median) })}</span>
        </span>
        <span className="country-month-track" aria-hidden="true">
          {Array.from({ length: 12 }, (_, index) => {
            const monthNumber = index + 1;
            const anomaly = data.anomalyIndex.get(`${row.region.region_id}|${sensor}|${year}|${monthNumber}`);
            return (
              <span key={monthNumber} className={month === monthNumber ? 'is-current' : ''}>
                <i style={anomaly ? { background: LEVEL_STYLE[anomaly.level].fill } : undefined} />
              </span>
            );
          })}
        </span>
        <span className="country-month-labels" aria-hidden="true"><span>{tt.monthShort(1)}</span><span>{month === null ? tt.t('bulletin.allYear') : tt.monthName(month)}</span><span>{tt.monthShort(12)}</span></span>
        <span className="country-signal-link">{tt.t('home.ccOpen')}<span aria-hidden="true">↗</span></span>
      </button>
    </li>
  );
}

export function MonthlySnapshot({ data, rows, sensor, year, month, period, firstYear, lastYear, totalDetections, onOpen, onOpenMethod }: {
  data: Dataset;
  rows: CountryMonthSummary[];
  sensor: Sensor;
  year: number;
  month: number | null;
  period: string;
  firstYear?: number;
  lastYear?: number;
  totalDetections: number;
  onOpen: (regionId: string) => void;
  onOpenMethod: () => void;
}) {
  const tt = useT();

  return (
    <section className="overview-section monthly-section" aria-labelledby="monthly-heading">
      <header className="overview-section-heading">
        <div>
          <p className="overview-section-eyebrow">{tt.t('home.step1')}</p>
          <h2 id="monthly-heading">{tt.t('home.monthTitle', { period })}</h2>
          <p className="overview-section-description">{tt.t('home.snapshotDescription')}</p>
        </div>
        <span className="overview-source-pill"><span aria-hidden="true" />NASA FIRMS <b>{sensor}</b></span>
      </header>

      <ul className="country-signal-grid" data-tour="countries">
        {rows.map((row) => <CountrySignalCard key={row.region.region_id} data={data} row={row} sensor={sensor} year={year} month={month} onOpen={onOpen} />)}
        {rows.length === 0 && <li className="overview-empty muted">{tt.t('bulletin.noData')}</li>}
      </ul>

      <div className="overview-method-note">
        <span className="overview-method-icon" aria-hidden="true">i</span>
        <p>{tt.t('home.usualNote', { first: firstYear ?? '—', last: lastYear ?? '—' })}<br /><b>{tt.t('home.periodTotal', { n: tt.num(totalDetections) })}</b></p>
        <button className="overview-method-link" onClick={onOpenMethod}>{tt.t('home.ctaMethod')}<span aria-hidden="true">↗</span></button>
      </div>
    </section>
  );
}
