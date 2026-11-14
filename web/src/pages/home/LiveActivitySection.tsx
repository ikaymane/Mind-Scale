import { useEffect, useMemo, useRef, useState } from 'react';
import { useT } from '../../i18n';
import { regionName, useSensor, type Dataset } from '../../lib/data';
import { useNow, type NowRegion } from '../../lib/now';
import { monthsToSeason, seasonOf } from '../../lib/season';
import { dayRange, monthsLabel, versus } from '../../lib/format';
import { LevelBadge } from '../../components/Level';
import { Globe } from '../../globe/Globe';

function DeferredGlobe({ data, onOpen }: { data: Dataset; onOpen: (regionId: string) => void }) {
  const tt = useT();
  const host = useRef<HTMLDivElement>(null);
  const [nearViewport, setNearViewport] = useState(false);

  useEffect(() => {
    const node = host.current;
    if (!node) return;
    if (!('IntersectionObserver' in window)) {
      setNearViewport(true);
      return;
    }
    const observer = new IntersectionObserver(([entry]) => {
      if (entry?.isIntersecting) {
        setNearViewport(true);
        observer.disconnect();
      }
    }, { rootMargin: '500px' });
    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  return (
    <div className="overview-globe-stage" ref={host}>
      {nearViewport
        ? <Globe data={data} mode="home" onPick={onOpen} />
        : <div className="overview-globe-loading" role="status"><span className="spinner" aria-hidden="true" />{tt.t('home.liveMapLoading')}</div>}
    </div>
  );
}

function LiveCountryRow({ region, signal, loading, hasMissingTiles, season, wait, onOpen }: {
  region: Dataset['regions'][number];
  signal?: NowRegion;
  loading: boolean;
  hasMissingTiles: boolean;
  season?: ReturnType<typeof seasonOf>;
  wait: number | null;
  onOpen: (regionId: string) => void;
}) {
  const tt = useT();
  const name = regionName(region);

  return (
    <li>
      <button className="live-country-row" onClick={() => onOpen(region.region_id)} aria-label={tt.t('home.open', { name })}>
        <span className="live-country-heading"><span>{name}</span>{signal?.level && <LevelBadge level={signal.level} size="sm" />}</span>
        <span className="live-country-count mono">{signal ? `${tt.num(signal.n)}${hasMissingTiles ? '+' : ''}` : loading ? '…' : '—'}</span>
        <span className="live-country-meta">
          {signal && signal.usual !== null ? tt.t('home.liveUsual', { n: tt.num(signal.usual), vs: versus(tt, signal.n, signal.usual) }) : tt.t('home.liveUnit')}
          {season && wait !== null && <> · <b>{wait === 0 ? tt.t('home.seasonIn') : tt.tp('home.seasonOut', wait, { n: wait })}</b> ({monthsLabel(tt, season.months)})</>}
        </span>
        <span className="live-country-arrow" aria-hidden="true">↗</span>
      </button>
    </li>
  );
}

export function LiveActivitySection({ data, onOpen }: { data: Dataset; onOpen: (regionId: string) => void }) {
  const tt = useT();
  const now = useNow(data);
  const sensor = useSensor(data);
  const thisMonth = new Date().getUTCMonth() + 1;
  const dateLabel = now ? dayRange(now.dates) : tt.t('home.nowSource');
  const seasons = useMemo(() => new Map(data.regions.map((region) => [region.region_id, seasonOf(data, region.region_id, sensor)])), [data, sensor]);

  return (
    <section className="overview-section live-activity-section" aria-labelledby="live-activity-heading">
      <header className="overview-section-heading live-section-heading">
        <div>
          <p className="overview-section-eyebrow">{tt.t('home.liveEyebrow')}</p>
          <h2 id="live-activity-heading">{tt.t('home.moreLive')}</h2>
          <p className="overview-section-description">{tt.t('home.liveIntro')}</p>
        </div>
        <span className="overview-live-source"><i aria-hidden="true" />{tt.t('globe.recentSource')}</span>
      </header>

      <div className="live-dashboard-grid">
        <div className="live-map-card">
          <header className="live-map-card-heading"><span>{tt.t('globe.label')}</span><span className="live-period-chip mono">{dateLabel}</span></header>
          <DeferredGlobe data={data} onOpen={onOpen} />
          <footer className="live-map-caption">
            <span>{tt.t('globe.legendFire')}</span>
            <span>{tt.t('globe.hint')}</span>
            <span>{tt.t('globe.imagery')} · {tt.t('globe.orbits')}</span>
          </footer>
        </div>

        <aside className="live-countries-card" data-tour="live">
          <header className="live-countries-heading">
            <div><h3>{tt.t('home.liveTitle')}</h3><p>{tt.t('home.liveSelectHint')}</p></div>
            <span className="live-period-status"><i aria-hidden="true" />{tt.t('home.liveNow')}</span>
          </header>
          <ul className="live-country-list">
            {data.regions.map((region) => {
              const season = seasons.get(region.region_id);
              return <LiveCountryRow key={region.region_id} region={region} signal={now?.regions.get(region.region_id)} loading={now === undefined} hasMissingTiles={!!now && now.failed > 0} season={season} wait={season ? monthsToSeason(season, thisMonth) : null} onOpen={onOpen} />;
            })}
          </ul>
          <p className="live-country-footnote">{now === null ? tt.t('safety.nowDown') : tt.t('home.liveNote')}</p>
        </aside>
      </div>
    </section>
  );
}
