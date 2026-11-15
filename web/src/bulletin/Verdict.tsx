import { LEVEL_STYLE } from '../levels';
import { useT } from '../i18n';
import { LevelIcon } from '../components/Level';
import { verdictText } from '../lib/sentence';
import type { Verdict as V } from '../lib/stats';
import { useTween } from '../lib/tween';

/** The headline figure: how far from usual, in one glance. */
export function figure(tt: ReturnType<typeof useT>, v: V): { big: string; small: string } {
  if (v.median === 0 || v.ratio === null) return { big: tt.num(v.n), small: tt.t('bulletin.statNone') };
  if (v.ratio >= 1.05) return { big: `×${tt.ratio(v.ratio)}`, small: tt.t('bulletin.statRatio') };
  if (v.ratio <= 0.95) return { big: `−${Math.round((1 - v.ratio) * 100)}%`, small: tt.t('bulletin.statBelow') };
  return { big: '≈', small: tt.t('bulletin.statNear') };
}

/** The four figures behind a verdict: shown on the globe on wide screens, inside the card on a phone. */
export function VerdictStats({ v, className = '', period }: { v: V; className?: string; period?: string }) {
  const tt = useT();
  // the figures count towards the new month instead of jumping
  const n = useTween(v.n), median = useTween(v.median);
  const live = { ...v, n: Math.round(n), median: Math.round(median), ratio: v.ratio === null || median <= 0 ? v.ratio : n / median };
  const f = figure(tt, n === v.n && median === v.median ? v : live);
  return (
    <dl className={`stats ${className}`}>
      {period && <div className="stats-period"><dt>{tt.t('bulletin.statPeriod')}</dt><dd className="mono">{period}</dd></div>}
      <div><dt>{tt.t('bulletin.statDetections')}</dt><dd className="mono">{tt.num(live.n)}</dd></div>
      <div><dt>{tt.t('bulletin.statUsual')}</dt><dd className="mono">{tt.num(live.median)}</dd></div>
      <div><dt>{f.small}</dt><dd className="mono">{f.big}</dd></div>
      <div><dt>{tt.t('bulletin.statRank', { first: v.firstYear, last: v.lastYear })}</dt><dd className="mono">{tt.t('bulletin.rankValue', { rank: v.rankHigh, total: v.yearsCount })}</dd></div>
    </dl>
  );
}

export function Verdict({ v, year, month }: { v: V; year: number; month: number | null }) {
  const tt = useT();
  const s = LEVEL_STYLE[v.level];
  const text = verdictText(tt, v, year, month);
  return (
    <section className="verdict" style={{ ['--lv' as string]: s.fill }} aria-live="polite">
      <p className="verdict-level">
        <span className="verdict-icon" style={{ background: s.fill, color: s.ink }}><LevelIcon level={v.level} size={16} /></span>
        {tt.t(`level.${v.level}`)}
        <span className="verdict-long">{tt.t(`levelLong.${v.level}`)}</span>
      </p>
      <p className="verdict-sentence">{text.main}{text.rank && <> <strong>{text.rank}</strong></>}</p>
      <VerdictStats v={v} className="stats-inline" />
      {v.fewFires && <p className="note">{text.note}</p>}
    </section>
  );
}
