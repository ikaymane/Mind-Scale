import { useMemo } from 'react';
import { useT } from '../i18n';
import { useSensor, type ContextRow, type Dataset } from '../lib/data';
import { driversOf } from '../lib/season';

const COVER = [
  { key: 'forest', color: '#1F8A54' },
  { key: 'shrub', color: '#9AA53A' },
  { key: 'cropland', color: '#D9A53C' },
  { key: 'other', color: '#9AA3B2' },
] as const;

type Ctx = ContextRow & { t2m?: number; precip_mm_day?: number };

function Tile({ label, value, note, tone }: { label: string; value: string; note?: string; tone?: 'hot' | 'cool' | '' }) {
  return (
    <div className="tile">
      <dt>{label}</dt>
      <dd>
        <span className={`tile-value mono ${tone ? `is-${tone}` : ''}`}>{value}</span>
        {note && <span className="tile-note">{note}</span>}
      </dd>
    </div>
  );
}

/** Card — conditions on the ground: NASA POWER weather of the month + MODIS land cover of the detections. */
export function Conditions({ data, regionId, ctx, month }: { data: Dataset; regionId: string; ctx: ContextRow | undefined; month: number | null }) {
  const tt = useT();
  const SENSOR = useSensor(data);
  const drivers = useMemo(() => driversOf(data, regionId, SENSOR), [data, regionId, SENSOR]);
  const head = (
    <header className="block-head">
      <h3>{tt.t('why.title')}</h3>
      <span className="block-src mono">{tt.t('why.source')}</span>
    </header>
  );
  const record = drivers && drivers.months > 0 && (
    <ul className="plain tight">
      <li>{tt.t('safety.driversHot', { a: drivers.hotter, n: drivers.months, b: drivers.allHotter, m: drivers.allMonths })}</li>
      {drivers.rainKnown > 0 && <li>{tt.t('safety.driversDry', { a: drivers.drier, n: drivers.rainKnown, b: drivers.allDrier, m: drivers.allRainKnown })}</li>}
    </ul>
  );
  if (month === null) return <section className="block">{head}<p className="muted">{tt.t('why.yearNote')}</p>{record}</section>;
  if (!ctx || ctx.t2m_anom == null) return <section className="block">{head}<p className="muted">{tt.t('why.unavailable')}</p>{record}</section>;

  const sign = new Intl.NumberFormat('en-GB', { maximumFractionDigits: 1, signDisplay: 'exceptZero' });
  const c = ctx as Ctx;
  const p = c.precip_anom_pct;
  const lc = c.landcover;

  return (
    <section className="block">
      {head}
      <dl className="tiles">
        <Tile
          label={tt.t('why.temp')}
          value={`${sign.format(c.t2m_anom!)} °C`}
          tone={c.t2m_anom! >= 0.5 ? 'hot' : c.t2m_anom! <= -0.5 ? 'cool' : ''}
          note={c.t2m != null ? `${c.t2m.toFixed(1)} °C · ${tt.t('why.tempVs')}` : tt.t('why.tempVs')}
        />
        <Tile
          label={tt.t('why.rain')}
          value={p == null ? (c.precip_mm_day != null ? `${c.precip_mm_day.toFixed(1)} mm` : '—') : `${sign.format(p)}%`}
          tone={p == null ? '' : p <= -20 ? 'hot' : p >= 20 ? 'cool' : ''}
          note={p == null ? tt.t('why.rainDry') : Math.abs(p) < 10 ? tt.t('why.rainNear') : p < 0 ? tt.t('why.rainLess') : tt.t('why.rainMore')}
        />
        {c.rh_mean != null && <Tile label={tt.t('why.humidity')} value={`${Math.round(c.rh_mean)}%`} note={tt.t('why.monthMean')} />}
        {c.wind_mean != null && <Tile label={tt.t('why.wind')} value={`${c.wind_mean.toFixed(1)} m/s`} note={tt.t('why.monthMean')} />}
      </dl>

      {lc && (
        <div className="fuel">
          <span className="readout-name">{tt.t('why.fuel')}</span>
          <span className="fuel-bar" aria-hidden="true">
            {COVER.map(({ key, color }) => (lc[key] ?? 0) > 0 && <span key={key} style={{ flexGrow: lc[key], background: color }} />)}
          </span>
          <ul className="fuel-legend">
            {COVER.filter(({ key }) => (lc[key] ?? 0) >= 0.01).map(({ key, color }) => (
              <li key={key}><span className="sw" style={{ background: color }} />{tt.t(`why.cover.${key}`)} <b className="mono">{Math.round((lc[key] ?? 0) * 100)}%</b></li>
            ))}
          </ul>
        </div>
      )}
      {record}
      <p className="footnote">{tt.t('why.measuredAt')}</p>
    </section>
  );
}
