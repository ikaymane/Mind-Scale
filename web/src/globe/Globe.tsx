import { useEffect, useMemo, useRef, useState } from 'react';
import { useT } from '../i18n';
import { useApp } from '../store';
import { loadGlobeCells, regionName, type Dataset } from '../lib/data';
import { levelFor } from '../lib/stats';
import { loadEonet } from '../lib/eonet';
import { LevelBadge } from '../components/Level';
import type { GlobeScene, LiveEvent, ReplayInfo, SatInfo } from './scene';

const fmtLL = (lat: number, lon: number) =>
  `${Math.abs(lat).toFixed(1)}°${lat >= 0 ? 'N' : 'S'} ${Math.abs(lon).toFixed(1)}°${lon >= 0 ? 'E' : 'W'}`;
const daysIn = (y: number, m: number) => new Date(Date.UTC(y, m, 0)).getUTCDate();

function webglOk() {
  try { const c = document.createElement('canvas'); return !!(c.getContext('webgl2') || c.getContext('webgl')); } catch { return false; }
}

const Play = () => <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M7 4.5v15l13-7.5z" /></svg>;
const Pause = () => <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M6 4h4v16H6zM14 4h4v16h-4z" /></svg>;

export function Globe({ data, mode, onPick, onUnsupported }: {
  data: Dataset; mode: 'app' | 'home'; onPick: (id: string) => void; onUnsupported?: () => void;
}) {
  const tt = useT();
  const { regionId, year, month } = useApp();
  const host = useRef<HTMLDivElement>(null);
  const [scene, setScene] = useState<GlobeScene | null>(null);
  const [ready, setReady] = useState(false);
  const [sats, setSats] = useState<SatInfo[]>([]);
  const [replay, setReplay] = useState<ReplayInfo | null>(null);
  const [zoomed, setZoomed] = useState(false);
  const [events, setEvents] = useState<LiveEvent[]>([]);
  const [showLive, setShowLive] = useState(true);
  const labelEls = useRef(new Map<string, HTMLElement>());
  const satEls = useRef(new Map<string, HTMLElement>());
  const pickRef = useRef(onPick);
  pickRef.current = onPick;

  const regions = useMemo(
    () => data.regions.filter((r) => r.center && r.bbox).map((r) => ({ id: r.region_id, center: r.center!, bbox: r.bbox! })),
    [data],
  );

  useEffect(() => {
    if (!webglOk()) { onUnsupported?.(); return; }
    let alive = true;
    let sc: GlobeScene | null = null;
    import('./scene').then(({ GlobeScene }) => {
      if (!alive || !host.current) return;
      try {
        sc = new GlobeScene(host.current, {
          reducedMotion: matchMedia('(prefers-reduced-motion: reduce)').matches,
          forestMaskUrl: `${import.meta.env.BASE_URL}data/forest_mask.png`,
          onPick: (id) => pickRef.current(id),
          onSatInfo: setSats,
          onReplay: setReplay,
          onZoom: setZoomed,
        });
        setScene(sc);
      } catch { onUnsupported?.(); }
    });
    return () => { alive = false; sc?.dispose(); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!scene) return;
    let alive = true;
    scene.setRegions(regions);
    labelEls.current.forEach((el, id) => scene.setLabel(id, el));
    satEls.current.forEach((el, id) => scene.setSatLabel(id, el));
    loadGlobeCells().then((cells) => {
      if (!alive || !cells) return;
      scene.setCells(cells);
      const s = useApp.getState();
      scene.setPeriod(s.year, s.month);
      if (mode === 'app') scene.focus(s.regionId);
      setReady(true);
    });
    loadEonet().then((ev) => { if (alive) { setEvents(ev); scene.setEvents(ev, true); } }).catch(() => {});
    return () => { alive = false; };
  }, [scene, regions, mode]);

  useEffect(() => { if (ready) scene?.setPeriod(year, month); }, [scene, ready, year, month]);
  useEffect(() => { if (ready && mode === 'app') scene?.focus(regionId); }, [scene, ready, regionId, mode]);
  useEffect(() => { scene?.setEventsVisible(showLive); }, [scene, showLive]);

  const focused = mode === 'app' && !!regionId;
  const canReplay = focused && month !== null && ready;
  const days = month ? daysIn(year, month) : 0;

  return (
    <div className={`globe ${ready ? 'is-ready' : ''} ${zoomed ? 'is-zoomed' : ''}`} aria-label={tt.t('globe.label')}>
      <div ref={host} className="globe-host" />

      <div className="globe-labels">
        {data.regions.map((r) => {
          const level = levelFor(data, r.region_id, 'MODIS', year, month);
          const sel = mode === 'app' && r.region_id === regionId;
          return (
            <button
              key={r.region_id}
              ref={(el) => { if (el) labelEls.current.set(r.region_id, el); else labelEls.current.delete(r.region_id); scene?.setLabel(r.region_id, el); }}
              className={`globe-label ${sel ? 'is-selected' : ''}`}
              onClick={() => onPick(r.region_id)}
              aria-pressed={mode === 'app' ? sel : undefined}
            >
              <span className="globe-label-name">{regionName(r)}</span>
              {level && <LevelBadge level={level} size="sm" />}
            </button>
          );
        })}
        {['Terra', 'Aqua'].map((name) => (
          <span key={name} className="sat-label" aria-hidden="true"
            ref={(el) => { if (el) satEls.current.set(name, el); else satEls.current.delete(name); scene?.setSatLabel(name, el); }}>
            {name}
          </span>
        ))}
      </div>

      <div className="globe-top">
        {focused ? (
          <button className="glass-btn" onClick={() => useApp.getState().set({ regionId: null })}>
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true"><circle cx="12" cy="12" r="9" /><path d="M3 12h18M12 3a14 14 0 0 1 0 18M12 3a14 14 0 0 0 0 18" /></svg>
            {tt.t('globe.reset')}
          </button>
        ) : (
          <span className="glass-chip">{tt.t('globe.hint')}</span>
        )}
        <div className="globe-top-end">
          {events.length > 0 && (
            <button className={`glass-chip live-chip ${showLive ? 'is-on' : ''}`} aria-pressed={showLive} onClick={() => setShowLive((v) => !v)} title={tt.t('globe.liveToggle')}>
              <span className="live-dot" aria-hidden="true" />
              {tt.tp('globe.live', events.length, { n: tt.num(events.length) })}
            </button>
          )}
          <span className="glass-chip mono">{tt.period(year, month)}</span>
        </div>
      </div>

      <div className="globe-bottom">
        {!zoomed && sats.length > 0 && (
          <div className="globe-hud">
            {sats.map((s) => (
              <div key={s.name} className="hud-row">
                <span className="hud-dot" />
                <span className="hud-name">{tt.t('globe.sat', { name: s.name })}</span>
                <span className="hud-ll mono">{fmtLL(s.lat, s.lon)}</span>
                <span className={`hud-n ${s.inSwath > 0 ? 'is-hot' : ''}`}>{tt.tp('globe.inSwath', s.inSwath, { n: tt.num(s.inSwath) })}</span>
              </div>
            ))}
          </div>
        )}

        {canReplay && (
          <div className="replay">
            <button
              className="replay-btn"
              onClick={() => (replay?.playing ? scene?.pauseReplay() : scene?.startReplay(days))}
              aria-label={replay?.playing ? tt.t('globe.pause') : tt.t('globe.replay', { period: tt.period(year, month) })}
            >
              {replay?.playing ? <Pause /> : <Play />}
              <span>{replay?.playing ? tt.t('globe.pause') : tt.t('globe.replay', { period: tt.period(year, month) })}</span>
            </button>
            {replay && (
              <>
                <input
                  className="replay-range" type="range" min={1} max={days} step={1} value={Math.max(1, replay.day)}
                  aria-label={tt.t('globe.day', { d: replay.day })}
                  onChange={(e) => scene?.seekReplay(Number(e.target.value) + 0.5, days)}
                />
                <span className="replay-stats mono">
                  <b>{tt.t('globe.day', { d: Math.max(1, replay.day) })}</b>
                  <span>{tt.tp('globe.burning', replay.burning, { n: tt.num(replay.burning) })}</span>
                  {replay.newToday > 0 && <span className="is-new">+{tt.tp('globe.newToday', replay.newToday, { n: tt.num(replay.newToday) })}</span>}
                </span>
              </>
            )}
          </div>
        )}

        <div className="globe-foot">
          <span className="key"><span className="key-fire" />{tt.t('globe.legendFire')}</span>
          {zoomed && <>
            <span className="key"><span className="key-sw key-forest" />{tt.t('globe.forest')}</span>
            <span className="key"><span className="key-sw key-shrub" />{tt.t('globe.shrub')}</span>
          </>}
          {showLive && events.length > 0 && <span className="key"><span className="key-live" />{tt.t('globe.liveSource')}</span>}
          <span className="globe-credit">{tt.t('globe.imagery')}{zoomed ? ` · ${tt.t('globe.landSource')}` : ''}</span>
        </div>
        {replay && <p className="globe-note">{tt.t('globe.replayHint')}</p>}
        {!replay && !zoomed && <p className="globe-note">{tt.t('globe.note')}</p>}
      </div>

      {!ready && <div className="globe-loading"><span className="spinner" aria-hidden="true" /></div>}
    </div>
  );
}
