/** Chargement des JSON pré-calculés (contrats §7) + index pour accès rapide. */
import { useEffect, useState } from 'react';
import type { Level } from '../levels';
import { useApp, type Lang, type Sensor } from '../store';

export interface AnomalyRow {
  region_id: string; sensor: Sensor; year: number; month: number;
  n: number; median: number; p10: number; p90: number;
  z: number; percentile: number; level: Level;
}
export interface CumulativeRegion {
  envelope: { doy: number; p10: number; p50: number; p90: number }[];
  years: Record<string, number[]>;
}
export interface ContextRow {
  region_id: string; year: number; month: number;
  t2m_anom: number | null; precip_anom_pct: number | null;
  /** detections of the month that got a land-cover class (weight for yearly shares) */
  fires_classified?: number;
  wind_mean?: number | null; rh_mean?: number | null;
  landcover?: Partial<Record<'forest' | 'cropland' | 'shrub' | 'other', number>> | null;
}
export interface Region {
  region_id: string; name_fr: string; name_ar: string; name_en: string; country: string;
  /** [lat, lon] et [ouest, sud, est, nord] — emprise des détections, pour le globe */
  center?: [number, number]; bbox?: [number, number, number, number];
}
export interface Cleaning { file: string; satellites?: string; steps: [string, number][] }
export interface Meta {
  generated?: string; data_until?: string; first_year?: number; last_year?: number;
  region_level?: 'country' | 'admin1';
  /** sensors present in the build, display order (MODIS first) */
  sensors?: Sensor[];
  /** sensor → country ISO3 → cleaning steps */
  cleaning?: Partial<Record<Sensor, Record<string, Cleaning>>>;
}

export interface Dataset {
  regions: Region[];
  regionById: Map<string, Region>;
  anomalies: AnomalyRow[];
  /** clé `${region}|${sensor}|${year}|${month}` */
  anomalyIndex: Map<string, AnomalyRow>;
  /** clé `${region}|${sensor}` → lignes triées */
  bySeries: Map<string, AnomalyRow[]>;
  cumulative: Partial<Record<Sensor, Record<string, CumulativeRegion>>>;
  contextIndex: Map<string, ContextRow>;
  meta: Meta;
}

const BASE = `${import.meta.env.BASE_URL}data/`;
/** MODIS keeps the historical file names; other sensors get a suffix: cumulative_VIIRS.json */
const fileFor = (stem: string, sensor: Sensor) => `${stem}${sensor === 'MODIS' ? '' : `_${sensor}`}.json`;

async function getJson<T>(name: string, optional = false): Promise<T | null> {
  try {
    const r = await fetch(BASE + name);
    if (!r.ok) throw new Error(`${name}: HTTP ${r.status}`);
    return (await r.json()) as T;
  } catch (e) {
    if (optional) return null;
    throw e;
  }
}

let promise: Promise<Dataset> | null = null;

export function loadDataset(): Promise<Dataset> {
  if (promise) return promise;
  promise = (async () => {
    const [geo, anomalies, context, meta] = await Promise.all([
      getJson<{ features: { properties: Region }[] }>('regions.geojson'),
      getJson<AnomalyRow[]>('anomalies.json'),
      // context.json (M3 : météo + végétation) — facultatif tant qu'il n'est pas produit
      getJson<ContextRow[]>('context.json', true),
      getJson<Meta>('meta.json', true),
    ]);
    const sensors: Sensor[] = meta?.sensors?.length ? meta.sensors : ['MODIS'];
    const cumFiles = await Promise.all(sensors.map((s) => getJson<Record<string, CumulativeRegion>>(fileFor('cumulative', s), true)));
    const cumulative: Dataset['cumulative'] = {};
    sensors.forEach((s, i) => { if (cumFiles[i]) cumulative[s] = cumFiles[i]!; });
    const regions = (geo?.features ?? []).map((f) => f.properties);
    const anomalyIndex = new Map<string, AnomalyRow>();
    const bySeries = new Map<string, AnomalyRow[]>();
    for (const a of anomalies ?? []) {
      anomalyIndex.set(`${a.region_id}|${a.sensor}|${a.year}|${a.month}`, a);
      const k = `${a.region_id}|${a.sensor}`;
      (bySeries.get(k) ?? bySeries.set(k, []).get(k)!).push(a);
    }
    bySeries.forEach((rows) => rows.sort((a, b) => a.year - b.year || a.month - b.month));
    const contextIndex = new Map<string, ContextRow>();
    for (const c of context ?? []) contextIndex.set(`${c.region_id}|${c.year}|${c.month}`, c);
    return {
      regions,
      regionById: new Map(regions.map((r) => [r.region_id, r])),
      anomalies: anomalies ?? [],
      anomalyIndex,
      bySeries,
      cumulative,
      contextIndex,
      meta: { ...meta, sensors },
    };
  })();
  return promise;
}

export type DataState = { status: 'loading' } | { status: 'error'; error: string } | { status: 'ready'; data: Dataset };

export function useDataset(): DataState {
  const [state, setState] = useState<DataState>({ status: 'loading' });
  useEffect(() => {
    let alive = true;
    loadDataset().then(
      (data) => alive && setState({ status: 'ready', data }),
      (e: unknown) => alive && setState({ status: 'error', error: String(e) }),
    );
    return () => { alive = false; };
  }, []);
  return state;
}

export const regionName = (r: Region | undefined, _lang?: Lang) => (r ? r.name_en || r.name_fr : '');

/** The sensor chosen in the app, if this build has it; MODIS otherwise. */
export function useSensor(data: Dataset): Sensor {
  const s = useApp((st) => st.sensor);
  return data.meta.sensors?.includes(s) ? s : 'MODIS';
}

/** Cellules de feu pour le globe (chargées à part : ~200 Ko gzip), un fichier par capteur */
export interface GlobeCellsFile { step: number; years: number[]; regions: string[]; cells: number[][] }
const cellsPromise = new Map<Sensor, Promise<GlobeCellsFile | null>>();
export function loadGlobeCells(sensor: Sensor = 'MODIS') {
  if (!cellsPromise.has(sensor)) cellsPromise.set(sensor, getJson<GlobeCellsFile>(fileFor('globe_cells', sensor), true));
  return cellsPromise.get(sensor)!;
}
