/**
 * Panneau carte : globe 3D (src/globe) — vue liste accessible en repli (WebGL absent)
 * et toujours disponible sous forme de « puces » de régions.
 * État partagé : useApp (regionId, year, month…), couleurs : levels.ts.
 */
import { useState } from 'react';
import { useT } from '../i18n';
import { useApp } from '../store';
import { regionName, useSensor, type Dataset } from '../lib/data';
import { levelFor } from '../lib/stats';
import { LevelBadge } from '../components/Level';
import { LEVEL_STYLE } from '../levels';
import { Globe } from '../globe/Globe';

function RegionList({ data }: { data: Dataset }) {
  const tt = useT();
  const { regionId, year, month, set } = useApp();
  const sensor = useSensor(data);
  return (
    <div className="map-placeholder">
      <h2 className="eyebrow">{tt.t('map.listTitle')} · {tt.period(year, month)}</h2>
      <ul className="region-list">
        {data.regions.map((r) => {
          const level = levelFor(data, r.region_id, sensor, year, month);
          const selected = r.region_id === regionId;
          return (
            <li key={r.region_id}>
              <button
                className={`region-item ${selected ? 'is-selected' : ''}`}
                aria-pressed={selected}
                onClick={() => set({ regionId: r.region_id })}
                style={level ? { ['--lv' as string]: LEVEL_STYLE[level].fill } : undefined}
              >
                <span className="region-name">{regionName(r, tt.lang)}</span>
                {level && <LevelBadge level={level} size="sm" />}
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

export function MapPanel({ data, inset = 0 }: { data: Dataset; inset?: number }) {
  const set = useApp((s) => s.set);
  const [noGl, setNoGl] = useState(false);
  return (
    <div className="map-panel">
      {noGl ? <RegionList data={data} /> : <Globe data={data} mode="app" inset={inset} onPick={(id) => set({ regionId: id })} onUnsupported={() => setNoGl(true)} />}
    </div>
  );
}
