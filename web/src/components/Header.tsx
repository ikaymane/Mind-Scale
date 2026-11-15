import { useEffect, useState } from 'react';
import { useT } from '../i18n';
import { useApp, type Page, type Sensor } from '../store';
import { useTheme } from '../lib/theme';
import type { Region } from '../lib/data';
import { Logo } from './Logo';
import { RegionSearch } from './RegionSearch';

const NAV: { page: Page; key: string }[] = [
  { page: 'home', key: 'nav.overview' },
  { page: 'app', key: 'nav.bulletin' },
  { page: 'compare', key: 'nav.compare' },
  { page: 'dispatch', key: 'nav.dispatch' },
  { page: 'method', key: 'nav.method' },
];

/** MODIS / VIIRS switch: shown only when the build holds more than one sensor. */
export function SensorSwitch({ sensors }: { sensors: Sensor[] }) {
  const { t } = useT();
  const raw = useApp((s) => s.sensor);
  const set = useApp((s) => s.set);
  const current = sensors.includes(raw) ? raw : sensors[0];
  if (sensors.length < 2) return null;
  return (
    <div className="sensor-switch" role="group" aria-label={t('sensor.label')}>
      {sensors.map((s) => (
        <button key={s} className={current === s ? 'is-on' : ''} aria-pressed={current === s} title={t(`sensor.${s}`)} onClick={() => set({ sensor: s })}>
          {s}
        </button>
      ))}
    </div>
  );
}

const isMac = /Mac|iPhone|iPad/.test(navigator.platform);

export function Header({ regions, sensors = ['MODIS'] }: { regions: Region[]; sensors?: Sensor[] }) {
  const { t } = useT();
  const page = useApp((s) => s.page);
  const set = useApp((s) => s.set);
  const { theme, toggle } = useTheme();
  const [searchOpen, setSearchOpen] = useState(false);

  // Ctrl/⌘ K anywhere, or "/" outside a field, opens the country search
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const typing = /^(INPUT|TEXTAREA|SELECT)$/.test((e.target as HTMLElement)?.tagName ?? '');
      if ((e.key.toLowerCase() === 'k' && (e.ctrlKey || e.metaKey)) || (e.key === '/' && !typing)) { e.preventDefault(); setSearchOpen(true); }
      else if (e.key === 'Escape') setSearchOpen(false);
    };
    addEventListener('keydown', onKey);
    return () => removeEventListener('keydown', onKey);
  }, []);

  const themeLabel = t(theme === 'dark' ? 'theme.toLight' : 'theme.toDark');

  return (
    <header className="header">
      <div className="header-row">
        <button className="logo-btn" onClick={() => set({ page: 'home' })} aria-label={`NIRAN — ${t('nav.home')}`}>
          <Logo tagline={t('app.tagline')} />
        </button>

        <nav className="header-nav" aria-label="NIRAN">
          {NAV.map((n) => (
            <button key={n.page} className={`nav-link ${page === n.page ? 'is-current' : ''}`} aria-current={page === n.page ? 'page' : undefined} onClick={() => set(n.page === 'app' && page !== 'app' ? { page: 'app', regionId: null } : { page: n.page })}>
              {t(n.key)}
            </button>
          ))}
        </nav>

        <div className="header-tools">
          <SensorSwitch sensors={sensors} />
          <button className="tool-btn search-btn" onClick={() => setSearchOpen(true)} aria-label={t('search.label')} aria-haspopup="dialog">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" aria-hidden="true"><circle cx="11" cy="11" r="7" /><path d="m20 20-3.5-3.5" /></svg>
            <kbd className="mono">{isMac ? '⌘K' : 'Ctrl K'}</kbd>
          </button>
          <button className="tool-btn" onClick={toggle} aria-label={themeLabel} title={themeLabel}>
            {theme === 'dark' ? (
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true"><circle cx="12" cy="12" r="4" /><path d="M12 2.5v2M12 19.5v2M2.5 12h2M19.5 12h2M5.3 5.3l1.4 1.4M17.3 17.3l1.4 1.4M5.3 18.7l1.4-1.4M17.3 6.7l1.4-1.4" /></svg>
            ) : (
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M20 14.5A8 8 0 0 1 9.5 4a8 8 0 1 0 10.5 10.5z" /></svg>
            )}
          </button>
        </div>
      </div>

      {searchOpen && (
        <div className="palette" role="dialog" aria-modal="true" aria-label={t('search.label')} onMouseDown={(e) => { if (e.target === e.currentTarget) setSearchOpen(false); }}>
          <div className="palette-box">
            <RegionSearch regions={regions} big autoFocus onPicked={() => setSearchOpen(false)} />
          </div>
        </div>
      )}
    </header>
  );
}
