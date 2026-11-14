import { useT } from '../i18n';
import type { ContextRow } from '../lib/data';

const COVER = [
  { key: 'forest', color: '#1F8A54' },
  { key: 'shrub', color: '#9AA53A' },
  { key: 'cropland', color: '#D9A53C' },
  { key: 'other', color: '#9AA3B2' },
] as const;

/** Diverging bar: centre = usual, left = below, right = above. */
function Diverge({ value, max, hot }: { value: number; max: number; hot: boolean }) {
  const w = Math.min(50, (Math.abs(value) / max) * 50);
  return (
    <span className="div-bar" aria-hidden="true">
      <span className="div-mid" />
      <span className={`div-fill ${hot ? 'is-hot' : 'is-cool'}`} style={value >= 0 ? { left: '50%', width: `${w}%` } : { right: '50%', width: `${w}%` }} />
    </span>
  );
}

/** Block 4 — conditions on the ground: NASA POWER weather + MODIS land cover of the detections. */
export function Conditions({ ctx, month }: { ctx: ContextRow | undefined; month: number | null }) {
  const tt = useT();
  const head = (
    <header className="block-head">
      <h3>{tt.t('why.title')}</h3>
      <span className="block-src mono">{tt.t('why.source')}</span>
    </header>
  );
  if (month === null) return <section className="block">{head}<p className="muted">{tt.t('why.yearNote')}</p></section>;
  if (!ctx || ctx.t2m_anom == null) return <section className="block">{head}<p className="muted">{tt.t('why.unavailable')}</p></section>;

  const sign = new Intl.NumberFormat('en-GB', { maximumFractionDigits: 1, signDisplay: 'exceptZero' });
  const p = ctx.precip_anom_pct;
  const lc = ctx.landcover;
  const extra = ctx as ContextRow & { t2m?: number; precip_mm_day?: number };

  return (
    <section className="block">
      {head}
      <div className="readouts">
        <div className="readout">
          <span className="readout-name">{tt.t('why.temp')}</span>
          <span className={`readout-value mono ${ctx.t2m_anom >= 0.5 ? 'is-hot' : ctx.t2m_anom <= -0.5 ? 'is-cool' : ''}`}>{sign.format(ctx.t2m_anom)} °C</span>
          <Diverge value={ctx.t2m_anom} max={4} hot={ctx.t2m_anom >= 0} />
          <span className="readout-note">{tt.t('why.tempVs')}{extra.t2m != null && <> · <span className="mono">{extra.t2m.toFixed(1)} °C</span></>}</span>
        </div>
        <div className="readout">
          <span className="readout-name">{tt.t('why.rain')}</span>
          {p == null ? (
            <>
              <span className="readout-value mono">{extra.precip_mm_day != null ? `${extra.precip_mm_day.toFixed(1)} mm/day` : '—'}</span>
              <span className="div-bar is-empty" aria-hidden="true"><span className="div-mid" /></span>
              <span className="readout-note">{tt.t('why.rainDry')}</span>
            </>
          ) : (
            <>
              <span className={`readout-value mono ${p <= -20 ? 'is-hot' : p >= 20 ? 'is-cool' : ''}`}>{sign.format(p)}%</span>
              <Diverge value={p} max={100} hot={p < 0} />
              <span className="readout-note">{Math.abs(p) < 10 ? tt.t('why.rainNear') : p < 0 ? tt.t('why.rainLess') : tt.t('why.rainMore')}</span>
            </>
          )}
        </div>
      </div>

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
      <p className="footnote">{tt.t('why.measuredAt')}</p>
    </section>
  );
}
