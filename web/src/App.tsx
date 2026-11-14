import { lazy, Suspense, useEffect } from 'react';
import { useT } from './i18n';
import { useApp } from './store';
import { useDataset } from './lib/data';
import { Header } from './components/Header';
import { Tour } from './components/Tour';
import { Home } from './pages/Home';

const AppView = lazy(() => import('./pages/AppView').then((m) => ({ default: m.AppView })));
const Compare = lazy(() => import('./pages/Compare').then((m) => ({ default: m.Compare })));
const Method = lazy(() => import('./pages/Method').then((m) => ({ default: m.Method })));

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
      <Header regions={state.status === 'ready' ? state.data.regions : []} until={state.status === 'ready' ? state.data.meta.data_until : undefined} sensors={state.status === 'ready' ? state.data.meta.sensors : undefined} />
      {state.status === 'loading' && <div className="state" role="status"><span className="spinner" aria-hidden="true" />{tt.t('common.loading')}</div>}
      {state.status === 'error' && <div className="state state-error" role="alert">{tt.t('common.error')}</div>}
      {state.status === 'ready' && (
        <Suspense fallback={<div className="state" role="status"><span className="spinner" aria-hidden="true" />{tt.t('common.loading')}</div>}>
          {page === 'home' ? <Home data={state.data} /> : page === 'method' ? <Method data={state.data} /> : page === 'compare' ? <Compare data={state.data} /> : <AppView data={state.data} />}
        </Suspense>
      )}
      {state.status === 'ready' && <Tour />}
    </div>
  );
}
