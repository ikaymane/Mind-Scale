/**
 * Phrases automatiques : modèles remplis par les données (pas d'IA).
 * Cas limites gérés : n = 0, médiane = 0 (jamais de « ×∞ »), pluriels (dont arabe : duel, few, many), très peu de feux.
 */
import type { T } from '../i18n';
import type { Verdict } from './stats';

export interface VerdictText {
  /** phrase de comparaison chiffrée */
  main: string;
  /** rang historique (record…) ou null */
  rank: string | null;
  /** phrase propre au niveau */
  note: string;
}

export function verdictText(t: T, v: Verdict, year: number, month: number | null): VerdictText {
  const period = t.t('sentence.periodIn', { period: t.period(year, month) });
  const median = t.num(v.median);
  const detections = t.tp('sentence.detections', v.n, { n: t.num(v.n) });

  let main: string;
  if (v.n === 0) {
    main = v.median === 0 ? t.t('sentence.noneUsual', { period }) : t.t('sentence.noneButUsually', { period, median });
  } else if (v.median === 0 || v.ratio === null) {
    main = t.t('sentence.whenUsuallyNone', { detections, period });
  } else if (v.ratio >= 1.5 || (v.ratio > 1 && ['high', 'unusual', 'extreme'].includes(v.level))) {
    const rounded = v.ratio >= 10 ? Math.round(v.ratio) : Math.round(v.ratio * 10) / 10;
    main = t.tp('sentence.timesMore', rounded, { detections, period, ratio: t.ratio(v.ratio), median });
  } else if (v.ratio <= 0.67 || (v.ratio < 1 && v.level === 'low')) {
    main = t.t('sentence.lessPct', { detections, period, pct: t.num(Math.round((1 - v.ratio) * 100)), median });
  } else {
    main = t.t('sentence.nearNormal', { detections, period, median });
  }

  let rank: string | null = null;
  const vars = { first: v.firstYear, last: v.lastYear, ofMonth: month ? t.ofMonth(month) : '' };
  const suffix = month === null ? 'Year' : 'Month';
  if (!v.fewFires && v.yearsCount >= 4 && v.n > 0) {
    if (v.rankHigh === 1 && (v.level === 'high' || v.level === 'unusual' || v.level === 'extreme')) rank = t.t(`sentence.recordHigh${suffix}`, vars);
    else if (v.rankHigh <= 3 && v.yearsCount >= 10 && v.level !== 'normal' && v.level !== 'low') rank = t.t(`sentence.top3${suffix}`, vars);
    else if (v.rankLow === 1 && v.level === 'low') rank = t.t(`sentence.recordLow${suffix}`, vars);
  } else if (!v.fewFires && v.n === 0 && v.median > 0 && v.rankLow === 1) {
    rank = t.t(`sentence.recordLow${suffix}`, vars);
  }

  const note = v.fewFires ? t.t('sentence.fewFires') : t.t(`levelNote.${v.level}`);
  return { main, rank, note };
}
