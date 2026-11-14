/**
 * Shared state, globe ↔ bulletin: { regionId, year, month, sensor, mode, page }.
 * Mirrored in the URL so every view can be shared: ?page=app&region=MAR&year=2022&month=7
 */
import { create } from 'zustand';

export type Sensor = 'MODIS' | 'VIIRS';
export type Mode = 'history' | 'anomaly' | 'live';
export type Lang = 'en';
export type Page = 'home' | 'app' | 'method';

export interface AppState {
  /** null = whole-globe view */
  regionId: string | null;
  year: number;
  /** 1..12, or null = whole year */
  month: number | null;
  sensor: Sensor;
  mode: Mode;
  lang: Lang;
  page: Page;
  set: (patch: Partial<Omit<AppState, 'set'>>) => void;
}

const DEFAULTS = {
  regionId: 'MAR' as string | null,
  year: 2022,
  month: 7 as number | null,
  sensor: 'MODIS' as Sensor,
  mode: 'anomaly' as Mode,
  page: 'home' as Page,
};

const oneOf = <T extends string>(v: string | null, list: readonly T[], fallback: T): T =>
  v && (list as readonly string[]).includes(v) ? (v as T) : fallback;

function fromUrl() {
  const q = new URLSearchParams(location.search);
  const year = Number(q.get('year'));
  const monthRaw = q.get('month');
  const month = monthRaw === 'all' ? null : Number(monthRaw);
  const region = q.get('region');
  return {
    regionId: region === 'all' ? null : region ?? DEFAULTS.regionId,
    year: year >= 2001 && year <= 2100 ? year : DEFAULTS.year,
    month: monthRaw === null ? DEFAULTS.month : month === null || (month >= 1 && month <= 12) ? month : DEFAULTS.month,
    sensor: oneOf(q.get('sensor'), ['MODIS', 'VIIRS'] as const, DEFAULTS.sensor),
    mode: oneOf(q.get('mode'), ['history', 'anomaly', 'live'] as const, DEFAULTS.mode),
    lang: 'en' as Lang,
    page: oneOf(q.get('page'), ['home', 'app', 'method'] as const, DEFAULTS.page),
  };
}

export function toUrl(s: Omit<AppState, 'set'>): string {
  const q = new URLSearchParams();
  if (s.page !== 'home') q.set('page', s.page);
  if (s.page === 'app') {
    q.set('region', s.regionId ?? 'all');
    q.set('year', String(s.year));
    q.set('month', s.month === null ? 'all' : String(s.month));
  }
  const qs = q.toString();
  return `${location.pathname}${qs ? `?${qs}` : ''}`;
}

export const useApp = create<AppState>((set) => ({
  ...fromUrl(),
  set: (patch) => set(patch),
}));

let lastPage = useApp.getState().page;
useApp.subscribe((s) => {
  const url = toUrl(s);
  if (url === location.pathname + location.search) return;
  if (s.page !== lastPage) history.pushState(null, '', url);
  else history.replaceState(null, '', url);
  lastPage = s.page;
});
window.addEventListener('popstate', () => {
  const next = fromUrl();
  lastPage = next.page;
  useApp.setState(next);
});
