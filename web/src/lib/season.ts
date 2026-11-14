/** What the archive says about when a country burns, what the weather was in its worst months, and how two years differ. */
import { levelRank } from '../levels';
import type { Sensor } from '../store';
import type { AnomalyRow, Dataset } from './data';
import { computeVerdict, median, type Verdict } from './stats';

export interface Season {
  /** typical detections per month (median over the archive years), index 0 = January */
  typical: number[];
  /** share of a typical year, per month */
  share: number[];
  /** months (1..12) that carry more than an average month: the fire season */
  months: number[];
  /** share of a typical year inside the season */
  seasonShare: number;
  peak: number;
  years: number;
}

export function seasonOf(data: Dataset, regionId: string, sensor: Sensor): Season | null {
  const rows = data.bySeries.get(`${regionId}|${sensor}`) ?? [];
  if (!rows.length) return null;
  const typical = Array.from({ length: 12 }, (_, i) => median(rows.filter((r) => r.month === i + 1).map((r) => r.n)));
  const total = typical.reduce((a, b) => a + b, 0);
  if (total <= 0) return null;
  const share = typical.map((v) => v / total);
  const months = share.flatMap((s, i) => (s > 1 / 12 ? [i + 1] : []));
  return {
    typical, share, months,
    seasonShare: months.reduce((a, m) => a + share[m - 1], 0),
    peak: 1 + typical.indexOf(Math.max(...typical)),
    years: new Set(rows.map((r) => r.year)).size,
  };
}

/** Consecutive runs of months, wrapping over the new year: [11,12,1,2] gives [[11,2]]. */
export function monthRuns(months: number[]): [number, number][] {
  const set = new Set(months);
  if (!set.size) return [];
  if (set.size === 12) return [[1, 12]];
  const runs: [number, number][] = [];
  for (let m = 1; m <= 12; m++) {
    if (!set.has(m) || set.has(m === 1 ? 12 : m - 1)) continue;
    let end = m;
    while (set.has(end === 12 ? 1 : end + 1)) end = end === 12 ? 1 : end + 1;
    runs.push([m, end]);
  }
  return runs;
}

/** 0 = in season; otherwise months until the next season month. */
export function monthsToSeason(season: Season, month: number): number {
  for (let k = 0; k < 12; k++) if (season.months.includes(((month - 1 + k) % 12) + 1)) return k;
  return 0;
}

export interface Drivers { months: number; hotter: number; drier: number; rainKnown: number; allMonths: number; allHotter: number; allDrier: number; allRainKnown: number }

/** Weather of the months that ended above the usual level, against all months. Counts, not causes. */
export function driversOf(data: Dataset, regionId: string, sensor: Sensor): Drivers | null {
  const rows = data.bySeries.get(`${regionId}|${sensor}`) ?? [];
  const d: Drivers = { months: 0, hotter: 0, drier: 0, rainKnown: 0, allMonths: 0, allHotter: 0, allDrier: 0, allRainKnown: 0 };
  for (const r of rows) {
    const c = data.contextIndex.get(`${regionId}|${r.year}|${r.month}`);
    if (!c || c.t2m_anom == null) continue;
    const hot = c.t2m_anom >= 0.5, rain = c.precip_anom_pct != null, dry = rain && c.precip_anom_pct! <= -20;
    d.allMonths++; if (hot) d.allHotter++; if (rain) d.allRainKnown++; if (dry) d.allDrier++;
    if (levelRank(r.level) >= levelRank('high')) { d.months++; if (hot) d.hotter++; if (rain) d.rainKnown++; if (dry) d.drier++; }
  }
  return d.allMonths ? d : null;
}

export interface YearStats {
  year: number;
  total: number;
  verdict: Verdict | null;
  /** index 0 = January; undefined when the month is missing */
  months: (AnomalyRow | undefined)[];
  peak: AnomalyRow | null;
  /** months that ended above the usual level (high, unusual, extreme) */
  above: number;
  /** day of year by which half of the year's detections were reached */
  halfDoy: number | null;
  tAnom: number | null;
  rainAnom: number | null;
  forestShare: number | null;
}

export function yearStats(data: Dataset, regionId: string, sensor: Sensor, year: number): YearStats {
  const months = Array.from({ length: 12 }, (_, i) => data.anomalyIndex.get(`${regionId}|${sensor}|${year}|${i + 1}`));
  const present = months.filter((m): m is AnomalyRow => !!m);
  const total = present.reduce((s, m) => s + m.n, 0);
  const cum = data.cumulative[sensor]?.[regionId]?.years[String(year)];
  let halfDoy: number | null = null;
  if (cum && cum.length && cum[cum.length - 1] > 0) {
    const half = cum[cum.length - 1] / 2;
    halfDoy = 1 + cum.findIndex((v) => v >= half);
  }
  const ctx = present.map((m) => data.contextIndex.get(`${regionId}|${year}|${m.month}`)).filter((c) => !!c);
  const mean = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : null);
  const w = ctx.reduce((s, c) => s + (c!.landcover ? c!.fires_classified ?? 0 : 0), 0);
  return {
    year, total, months,
    verdict: computeVerdict(data, regionId, sensor, year, null),
    peak: present.length ? present.reduce((a, b) => (b.n > a.n ? b : a)) : null,
    above: present.filter((m) => levelRank(m.level) >= levelRank('high')).length,
    halfDoy,
    tAnom: mean(ctx.flatMap((c) => (c!.t2m_anom != null ? [c!.t2m_anom] : []))),
    rainAnom: mean(ctx.flatMap((c) => (c!.precip_anom_pct != null ? [c!.precip_anom_pct] : []))),
    forestShare: w > 0 ? ctx.reduce((s, c) => s + (c!.landcover?.forest ?? 0) * (c!.landcover ? c!.fires_classified ?? 0 : 0), 0) / w : null,
  };
}
