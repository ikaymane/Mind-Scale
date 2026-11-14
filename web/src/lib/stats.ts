/**
 * Verdict d'une région pour une période (mois ou année entière).
 * Mois : on lit directement anomalies.json (M2).
 * Année entière : même méthode que M2 (leave-one-out, z robuste sur log1p), appliquée aux totaux annuels.
 */
import type { Level } from '../levels';
import type { Sensor } from '../store';
import type { AnomalyRow, Dataset } from './data';

export interface Verdict {
  level: Level;
  n: number;
  median: number;
  p10: number;
  p90: number;
  /** n / médiane ; null si médiane = 0 */
  ratio: number | null;
  /** 1 = valeur la plus haute de l'historique */
  rankHigh: number;
  /** 1 = valeur la plus basse */
  rankLow: number;
  yearsCount: number;
  firstYear: number;
  lastYear: number;
  /** très peu de feux : variations non significatives */
  fewFires: boolean;
}

export interface YearPoint { year: number; n: number; level: Level }

const quantile = (arr: number[], q: number) => {
  const s = [...arr].sort((a, b) => a - b);
  if (!s.length) return 0;
  const pos = (s.length - 1) * q, lo = Math.floor(pos), hi = Math.ceil(pos);
  return s[lo] + (s[hi] - s[lo]) * (pos - lo);
};

export function levelFromZ(z: number, n: number, median: number): Level {
  if (median < 5 && n < 5) return 'normal';
  if (z < -1) return 'low';
  if (z < 1) return 'normal';
  if (z < 2) return 'high';
  if (z < 3) return 'unusual';
  return 'extreme';
}

/** Série année → n pour un mois (ou le total annuel si month = null), avec le niveau de chaque année. */
export function yearSeries(data: Dataset, regionId: string, sensor: Sensor, month: number | null): YearPoint[] {
  const rows = data.bySeries.get(`${regionId}|${sensor}`) ?? [];
  if (month !== null) return rows.filter((r) => r.month === month).map((r) => ({ year: r.year, n: r.n, level: r.level }));
  const totals = new Map<number, number>();
  const monthsSeen = new Map<number, number>();
  for (const r of rows) {
    totals.set(r.year, (totals.get(r.year) ?? 0) + r.n);
    monthsSeen.set(r.year, (monthsSeen.get(r.year) ?? 0) + 1);
  }
  // seules les années complètes (12 mois) servent de référence
  const years = [...totals.keys()].filter((y) => monthsSeen.get(y) === 12).sort((a, b) => a - b);
  return years.map((y) => {
    const n = totals.get(y)!;
    const others = years.filter((o) => o !== y).map((o) => totals.get(o)!);
    const logs = others.map((v) => Math.log1p(v));
    const med = quantile(logs, 0.5);
    const mad = Math.max(quantile(logs.map((v) => Math.abs(v - med)), 0.5), 0.5 / 1.4826);
    const z = (Math.log1p(n) - med) / (1.4826 * mad);
    return { year: y, n, level: levelFromZ(z, n, quantile(others, 0.5)) };
  });
}

export function computeVerdict(
  data: Dataset, regionId: string, sensor: Sensor, year: number, month: number | null,
): Verdict | null {
  const series = yearSeries(data, regionId, sensor, month);
  const current = series.find((p) => p.year === year);
  if (!current) return null;
  const others = series.filter((p) => p.year !== year).map((p) => p.n);
  if (!others.length) return null;

  let row: AnomalyRow | undefined;
  if (month !== null) row = data.anomalyIndex.get(`${regionId}|${sensor}|${year}|${month}`);
  const median = row ? row.median : Math.round(quantile(others, 0.5));
  const p10 = row ? row.p10 : Math.round(quantile(others, 0.1));
  const p90 = row ? row.p90 : Math.round(quantile(others, 0.9));
  const n = current.n;
  return {
    level: row?.level ?? current.level,
    n, median, p10, p90,
    ratio: median > 0 ? n / median : null,
    rankHigh: 1 + others.filter((v) => v > n).length,
    rankLow: 1 + others.filter((v) => v < n).length,
    yearsCount: series.length,
    firstYear: series[0].year,
    lastYear: series[series.length - 1].year,
    fewFires: median < 5 && n < 5,
  };
}

/** Niveau d'une région pour la période (pour la vue liste / la carte). */
export function levelFor(data: Dataset, regionId: string, sensor: Sensor, year: number, month: number | null): Level | null {
  if (month !== null) return data.anomalyIndex.get(`${regionId}|${sensor}|${year}|${month}`)?.level ?? null;
  return yearSeries(data, regionId, sensor, null).find((p) => p.year === year)?.level ?? null;
}

/** Années disponibles pour un capteur (toutes régions confondues). */
export function availableYears(data: Dataset, sensor: Sensor): number[] {
  const s = new Set<number>();
  for (const a of data.anomalies) if (a.sensor === sensor) s.add(a.year);
  return [...s].sort((a, b) => a - b);
}
