import { useEffect } from 'react';
import { useT } from './i18n';
import { useApp } from './store';
import { useDataset } from './lib/data';
import { Header } from './components/Header';
import { PageSkeleton } from './components/Skeleton';
import { AppView } from './pages/AppView';
import { Home } from './pages/Home';
import { Compare } from './pages/Compare';
import { Method } from './pages/Method';
import { Dispatch } from './pages/Dispatch';
import { AgentPanel } from './agent/AgentPanel';
import { Intro } from './components/Intro';

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
      <Header regions={state.status === 'ready' ? state.data.regions : []} sensors={state.status === 'ready' ? state.data.meta.sensors : undefined} />
      {state.status === 'loading' && <PageSkeleton label={tt.t('common.loading')} />}
      {state.status === 'error' && <div className="state state-error" role="alert">{tt.t('common.error')}</div>}
      {state.status === 'ready' && (
        page === 'home' ? <Home data={state.data} /> : page === 'dispatch' ? <Dispatch /> : page === 'method' ? <Method data={state.data} /> : page === 'compare' ? <Compare data={state.data} /> : <AppView data={state.data} />
      )}
      <AgentPanel />
      <Intro ready={state.status !== 'loading'} tagline={tt.t('app.tagline')} regions={state.status === 'ready' ? state.data.regions : []} />
    </div>
  );
}
