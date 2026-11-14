import { LEVELS, LEVEL_STYLE } from '../levels';
import { useT } from '../i18n';
import { LevelIcon } from '../components/Level';
import { verdictText } from '../lib/sentence';
import type { Verdict as V } from '../lib/stats';

/** The headline figure: how far from usual, in one glance. */
function figure(tt: ReturnType<typeof useT>, v: V): { big: string; small: string } {
  if (v.median === 0 || v.ratio === null) return { big: tt.num(v.n), small: tt.t('bulletin.statNone') };
  if (v.ratio >= 1.05) return { big: `×${tt.ratio(v.ratio)}`, small: tt.t('bulletin.statRatio') };
  if (v.ratio <= 0.95) return { big: `−${Math.round((1 - v.ratio) * 100)}%`, small: tt.t('bulletin.statBelow') };
  return { big: '≈', small: tt.t('bulletin.statNear') };
}

export function Verdict({ v, year, month }: { v: V; year: number; month: number | null }) {
  const tt = useT();
  const s = LEVEL_STYLE[v.level];
  const text = verdictText(tt, v, year, month);
  const f = figure(tt, v);
  return (
    <section className="verdict" data-tour="verdict" style={{ ['--lv' as string]: s.fill }} aria-live="polite">
      <div className="verdict-row">
        <div>
          <p className="verdict-level">
            <span className="verdict-icon" style={{ background: s.fill, color: s.ink }}><LevelIcon level={v.level} size={16} /></span>
            {tt.t(`level.${v.level}`)}
          </p>
          <p className="verdict-long">{tt.t(`levelLong.${v.level}`)}</p>
        </div>
        <p className="verdict-figure">
          <span className="mono">{f.big}</span>
          <small>{f.small}</small>
        </p>
      </div>

      <p className="verdict-sentence">{text.main}{text.rank && <> <strong>{text.rank}</strong></>}</p>

      <div className="scale" role="img" aria-label={`${tt.t('bulletin.scale')}: ${tt.t(`level.${v.level}`)}`}>
        {LEVELS.map((l) => (
          <span key={l} className={`scale-seg ${l === v.level ? 'is-on' : ''}`} style={{ ['--c' as string]: LEVEL_STYLE[l].fill }}>
            <span className="scale-label">{tt.t(`level.${l}`)}</span>
          </span>
        ))}
      </div>

      <dl className="stats">
        <div><dt>{tt.t('bulletin.statDetections')}</dt><dd className="mono">{tt.num(v.n)}</dd></div>
        <div><dt>{tt.t('bulletin.statUsual')}</dt><dd className="mono">{tt.num(v.median)}</dd></div>
        <div><dt>{tt.t('bulletin.statRank', { first: v.firstYear, last: v.lastYear })}</dt><dd className="mono">{tt.t('bulletin.rankValue', { rank: v.rankHigh, total: v.yearsCount })}</dd></div>
      </dl>
      {v.fewFires && <p className="note">{text.note}</p>}
    </section>
  );
}
