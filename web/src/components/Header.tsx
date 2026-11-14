import { useState } from 'react';
import { useT } from '../i18n';
import { useApp, type Page } from '../store';
import type { Region } from '../lib/data';
import { Logo } from './Logo';
import { RegionSearch } from './RegionSearch';

const NAV: { page: Page; key: string }[] = [
  { page: 'home', key: 'nav.overview' },
  { page: 'app', key: 'nav.bulletin' },
  { page: 'method', key: 'nav.method' },
];

export function Header({ regions, until }: { regions: Region[]; until?: string }) {
  const tt = useT();
  const { t } = tt;
  const page = useApp((s) => s.page);
  const set = useApp((s) => s.set);
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

        {until && <p className="header-status mono"><span className="status-dot" aria-hidden="true" />{t('home.status', { date: tt.date(until) })}</p>}

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
