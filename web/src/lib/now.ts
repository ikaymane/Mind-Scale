/**
 * "Right now": the last 7 complete days of MODIS fire detections, read from NASA GIBS vector tiles
 * (LANCE / FIRMS near-real-time, Terra + Aqua), compared with the same 7 calendar days in the archive.
 *
 * Same confidence cut as the pipeline (30 % and above). Two archive steps cannot be applied to
 * near-real-time points and are stated in the UI: the "type" filter and the persistent-site filter.
 * A point is given to a country when it falls in a 0.5 degree cell where the archive holds detections
 * for that country (the project has no boundary file yet).
 */
import { useEffect, useState } from 'react';
import type { Level } from '../levels';
import { loadGlobeCells, type Dataset } from './data';
import { levelFromZ, median, robustZ } from './stats';

const GIBS = 'https://gibs.earthdata.nasa.gov/wmts/epsg4326/best';
const LAYERS = ['MODIS_Terra_Thermal_Anomalies_All', 'MODIS_Aqua_Thermal_Anomalies_All'];
const ZOOM = 2;
const TILE_DEG = 288 / 2 ** ZOOM;
export const NOW_DAYS = 7;
export const NOW_MIN_CONF = 30;

export interface NowRegion {
  regionId: string;
  n: number;
  perDay: number[];
  /** median of the same 7 calendar days in the archive years; null when the archive cannot say */
  usual: number | null;
  refYears: number;
  level: Level | null;
}
export interface NowData {
  dates: string[];
  regions: Map<string, NowRegion>;
  points: { lat: number; lon: number }[];
  total: number;
  /** tiles that did not load: counts are then a lower bound */
  failed: number;
  tiles: number;
}

// ---- minimal Mapbox Vector Tile reader (points with attributes only) ----
function varints(u: Uint8Array): number[] {
  const out: number[] = [];
  let i = 0;
  while (i < u.length) {
    let r = 0, m = 1, c: number;
    do { c = u[i++]; r += (c & 127) * m; m *= 128; } while (c >= 128);
    out.push(r);
  }
  return out;
}
type Field = { f: number; v: number | Uint8Array };
function fields(b: Uint8Array): Field[] {
  const out: Field[] = [];
  let i = 0;
  const varint = () => {
    let r = 0, m = 1, c: number;
    do { c = b[i++]; r += (c & 127) * m; m *= 128; } while (c >= 128);
    return r;
  };
  while (i < b.length) {
    const k = varint(), f = Math.floor(k / 8), w = k & 7;
    if (w === 0) out.push({ f, v: varint() });
    else if (w === 2) { const n = varint(); out.push({ f, v: b.subarray(i, i + n) }); i += n; }
    else if (w === 5) { out.push({ f, v: b.subarray(i, i + 4) }); i += 4; }
    else if (w === 1) { out.push({ f, v: b.subarray(i, i + 8) }); i += 8; }
    else break;
  }
  return out;
}
const td = new TextDecoder();
function value(b: Uint8Array): string | number | null {
  for (const { f, v } of fields(b)) {
    if (f === 1) return td.decode(v as Uint8Array);
    if (f === 2) { const u = v as Uint8Array; return new DataView(u.buffer, u.byteOffset, 4).getFloat32(0, true); }
    if (f === 3) { const u = v as Uint8Array; return new DataView(u.buffer, u.byteOffset, 8).getFloat64(0, true); }
    if (f === 4 || f === 5) return v as number;
    if (f === 6) { const n = v as number; return n % 2 ? -(n + 1) / 2 : n / 2; }
  }
  return null;
}
interface Pt { lat: number; lon: number; conf: number; uid: string }
function readTile(buf: ArrayBuffer): Pt[] {
  const out: Pt[] = [];
  for (const layer of fields(new Uint8Array(buf))) {
    if (layer.f !== 3) continue;
    const keys: string[] = [], vals: Uint8Array[] = [], feats: Uint8Array[] = [];
    for (const x of fields(layer.v as Uint8Array)) {
      if (x.f === 2) feats.push(x.v as Uint8Array);
      else if (x.f === 3) keys.push(td.decode(x.v as Uint8Array));
      else if (x.f === 4) vals.push(x.v as Uint8Array);
    }
    const cache = new Map<number, string | number | null>();
    const val = (i: number) => { if (!cache.has(i)) cache.set(i, value(vals[i])); return cache.get(i)!; };
    for (const ft of feats) {
      const p: Record<string, string | number | null> = {};
      for (const x of fields(ft)) {
        if (x.f !== 2) continue;
        const tags = varints(x.v as Uint8Array);
        for (let i = 0; i + 1 < tags.length; i += 2) p[keys[tags[i]]] = val(tags[i + 1]);
      }
      const lat = Number(p.LATITUDE), lon = Number(p.LONGITUDE);
      if (!Number.isFinite(lat) || !Number.isFinite(lon)) continue;
      out.push({ lat, lon, conf: Number(p.CONFIDENCE ?? 0), uid: `${p.SATELLITE}|${p.UID}` });
    }
  }
  return out;
}

// ---- dates ----
const iso = (d: Date) => d.toISOString().slice(0, 10);
const doyOf = (d: Date) => Math.min(365, Math.floor((d.getTime() - Date.UTC(d.getUTCFullYear(), 0, 0)) / 864e5));
function lastDays(): Date[] {
  const now = new Date();
  const t0 = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
  return Array.from({ length: NOW_DAYS }, (_, i) => new Date(t0 - (NOW_DAYS - i) * 864e5));
}

/** Detections of each archive year inside the same day-of-year window (cumulative curves, 365 days). */
export function windowCounts(years: Record<string, number[]>, d0: number, d1: number): number[] {
  const out: number[] = [];
  for (const [y, cum] of Object.entries(years)) {
    if (cum.length < 365) continue;
    if (d0 <= d1) out.push(cum[d1 - 1] - (d0 > 1 ? cum[d0 - 2] : 0));
    else {
      const prev = years[String(Number(y) - 1)];
      if (prev && prev.length >= 365) out.push(prev[364] - prev[d0 - 2] + cum[d1 - 1]);
    }
  }
  return out;
}

async function pool<A>(items: A[], size: number, fn: (a: A) => Promise<void>): Promise<void> {
  let next = 0;
  await Promise.all(Array.from({ length: Math.min(size, items.length) }, async () => {
    while (next < items.length) await fn(items[next++]);
  }));
}

async function build(data: Dataset): Promise<NowData | null> {
  const cells = await loadGlobeCells();
  if (!cells) return null;
  const cellRegion = new Map<string, number>();
  for (const c of cells.cells) cellRegion.set(`${Math.floor(c[0] / cells.step)}|${Math.floor(c[1] / cells.step)}`, c[2]);

  const days = lastDays();
  const dates = days.map(iso);
  const tileSet = new Set<string>();
  for (const r of data.regions) {
    if (!r.bbox) continue;
    const [w, s, e, n] = r.bbox;
    for (let col = Math.floor((w + 180) / TILE_DEG); col <= Math.floor((e + 180) / TILE_DEG); col++)
      for (let row = Math.floor((90 - n) / TILE_DEG); row <= Math.floor((90 - s) / TILE_DEG); row++) tileSet.add(`${row}/${col}`);
  }
  const jobs = dates.flatMap((date, di) => LAYERS.flatMap((layer) => [...tileSet].map((rc) => ({ di, url: `${GIBS}/${layer}/default/${date}/1km/${ZOOM}/${rc}.mvt` }))));

  const counts = cells.regions.map(() => new Array<number>(NOW_DAYS).fill(0));
  const points: { lat: number; lon: number }[] = [];
  const seen = new Set<string>();
  let failed = 0;
  await pool(jobs, 6, async ({ di, url }) => {
    const ctl = new AbortController();
    const timer = setTimeout(() => ctl.abort(), 20000);
    try {
      const r = await fetch(url, { signal: ctl.signal });
      if (!r.ok) throw new Error(String(r.status));
      for (const p of readTile(await r.arrayBuffer())) {
        if (p.conf < NOW_MIN_CONF) continue;
        const ri = cellRegion.get(`${Math.floor(p.lat / cells.step)}|${Math.floor(p.lon / cells.step)}`);
        if (ri === undefined) continue;
        const id = `${di}|${p.uid}`;
        if (seen.has(id)) continue;
        seen.add(id);
        counts[ri][di]++;
        points.push({ lat: p.lat, lon: p.lon });
      }
    } catch { failed++; } finally { clearTimeout(timer); }
  });
  if (failed === jobs.length) return null;

  const d0 = doyOf(days[0]), d1 = doyOf(days[days.length - 1]);
  const regions = new Map<string, NowRegion>();
  cells.regions.forEach((regionId, ri) => {
    const n = counts[ri].reduce((a, b) => a + b, 0);
    const cum = data.cumulative.MODIS?.[regionId];
    const ref = cum ? windowCounts(cum.years, d0, d1) : [];
    const usual = ref.length >= 3 ? Math.round(median(ref)) : null;
    regions.set(regionId, {
      regionId, n, perDay: counts[ri], usual, refYears: ref.length,
      level: usual === null ? null : levelFromZ(robustZ(n, ref), n, usual),
    });
  });
  return { dates, regions, points, total: points.length, failed, tiles: jobs.length };
}

let promise: Promise<NowData | null> | null = null;
export const loadNow = (data: Dataset) => (promise ??= build(data).catch(() => null));

/** undefined = loading, null = NASA GIBS not reachable. */
export function useNow(data: Dataset): NowData | null | undefined {
  const [now, setNow] = useState<NowData | null | undefined>(undefined);
  useEffect(() => {
    let alive = true;
    loadNow(data).then((n) => { if (alive) setNow(n); });
    return () => { alive = false; };
  }, [data]);
  return now;
}
