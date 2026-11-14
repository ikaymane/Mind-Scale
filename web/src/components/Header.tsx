import { useState } from 'react';
import { useT } from '../i18n';
import { useApp, type Page, type Sensor } from '../store';
import type { Region } from '../lib/data';
import { Logo } from './Logo';
import { RegionSearch } from './RegionSearch';
import { useTour } from './Tour';

const NAV: { page: Page; key: string }[] = [
  { page: 'home', key: 'nav.overview' },
  { page: 'app', key: 'nav.bulletin' },
  { page: 'compare', key: 'nav.compare' },
  { page: 'method', key: 'nav.method' },
];

/** MODIS / VIIRS switch: shown only when the build holds more than one sensor. */
function SensorSwitch({ sensors }: { sensors: Sensor[] }) {
  const { t } = useT();
  const raw = useApp((s) => s.sensor);
  const set = useApp((s) => s.set);
  const current = sensors.includes(raw) ? raw : sensors[0];
  if (sensors.length < 2) return null;
  return (
    <div className="sensor-switch" data-tour="sensor" role="group" aria-label={t('sensor.label')}>
      {sensors.map((s) => (
        <button key={s} className={current === s ? 'is-on' : ''} aria-pressed={current === s} title={t(`sensor.${s}`)} onClick={() => set({ sensor: s })}>
          {s}
        </button>
      ))}
    </div>
  );
}

export function Header({ regions, until, sensors = ['MODIS'] }: { regions: Region[]; until?: string; sensors?: Sensor[] }) {
  const tt = useT();
  const { t } = tt;
  const page = useApp((s) => s.page);
  const set = useApp((s) => s.set);
  const raw = useApp((s) => s.sensor);
  const sensor = sensors.includes(raw) ? raw : sensors[0];
  const [searchOpen, setSearchOpen] = useState(false);

  return (
    <header className="header">
      <div className="header-row">
        <button className="logo-btn" onClick={() => set({ page: 'home' })} aria-label={`NIRAN — ${t('nav.home')}`}>
          <Logo tagline={t('app.tagline')} />
        </button>

        <nav className="header-nav" aria-label="NIRAN">
          {NAV.map((n) => (
            <button key={n.page} className={`nav-link ${page === n.page ? 'is-current' : ''}`} aria-current={page === n.page ? 'page' : undefined} onClick={() => set({ page: n.page })}>
              {t(n.key)}
            </button>
          ))}
        </nav>

        <button className="tour-btn" onClick={() => useTour.getState().start()} title={t('tour.headerTitle')}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true"><circle cx="12" cy="12" r="9" /><path d="M10 8.5v7l5.5-3.5z" fill="currentColor" stroke="none" /></svg>
          <span>{t('tour.header')}</span>
        </button>
        <SensorSwitch sensors={sensors} />
        {until && <p className="header-status mono"><span className="status-dot" aria-hidden="true" />{t('home.status', { sensor, date: tt.date(until) })}</p>}

        <div className="header-search">
          <RegionSearch regions={regions} />
        </div>
        <button className="icon-btn search-toggle" aria-label={t('search.label')} aria-expanded={searchOpen} onClick={() => setSearchOpen((o) => !o)}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" aria-hidden="true"><circle cx="11" cy="11" r="7" /><path d="m20 20-3.5-3.5" /></svg>
        </button>
      </div>
      {searchOpen && (
        <div className="header-search-mobile">
          <RegionSearch regions={regions} onPicked={() => setSearchOpen(false)} />
        </div>
      )}
    </header>
  );
}
