import { useEffect } from 'react';
import { useT } from './i18n';
import { useApp } from './store';
import { useDataset } from './lib/data';
import { Header } from './components/Header';
import { AppView } from './pages/AppView';
import { Home } from './pages/Home';
import { Method } from './pages/Method';

export function App() {
  const tt = useT();
  const page = useApp((s) => s.page);
  const state = useDataset();

  useEffect(() => { document.title = `NIRAN — ${tt.t('app.tagline')}`; }, [tt]);
  useEffect(() => { window.scrollTo({ top: 0 }); }, [page]);

  // Région inconnue dans les données (ex. ancien lien) → première région disponible
  useEffect(() => {
    if (state.status !== 'ready') return;
    const { regionId, set } = useApp.getState();
    if (regionId && !state.data.regionById.has(regionId)) set({ regionId: state.data.regions[0]?.region_id ?? null });
  }, [state]);

  return (
    <div className={`shell page-${page}`}>
      <a className="skip" href="#main">{tt.t('nav.skip')}</a>
      <Header regions={state.status === 'ready' ? state.data.regions : []} until={state.status === 'ready' ? state.data.meta.data_until : undefined} />
      {state.status === 'loading' && <div className="state" role="status"><span className="spinner" aria-hidden="true" />{tt.t('common.loading')}</div>}
      {state.status === 'error' && <div className="state state-error" role="alert">{tt.t('common.error')}</div>}
      {state.status === 'ready' && (
        page === 'home' ? <Home data={state.data} /> : page === 'method' ? <Method data={state.data} /> : <AppView data={state.data} />
      )}
    </div>
  );
}
