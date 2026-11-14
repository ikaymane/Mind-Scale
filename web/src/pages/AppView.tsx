import { useEffect, useRef, useState } from 'react';
import { useT } from '../i18n';
import { useApp } from '../store';
import type { Dataset } from '../lib/data';
import { MapPanel } from '../map/MapPanel';
import { Bulletin } from '../bulletin/Bulletin';

/**
 * Bureau : carte ~60 % | bulletin ~40 % (s'inverse en arabe).
 * Mobile : carte en haut, bulletin en tiroir glissant (aperçu → plein écran).
 */
export function AppView({ data }: { data: Dataset }) {
  const tt = useT();
  const regionId = useApp((s) => s.regionId);
  const [open, setOpen] = useState(false);
  const [drag, setDrag] = useState<number | null>(null);
  const start = useRef<{ y: number; open: boolean } | null>(null);
  const sheetRef = useRef<HTMLElement>(null);

  // nouvelle région → on remonte en haut du bulletin
  useEffect(() => { sheetRef.current?.scrollTo({ top: 0 }); }, [regionId]);

  const onDown = (e: React.PointerEvent) => {
    start.current = { y: e.clientY, open };
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
  };
  const onMove = (e: React.PointerEvent) => { if (start.current && e.buttons) setDrag(e.clientY - start.current.y); };
  const dragged = useRef(false);
  const onUp = () => {
    if (!start.current) return;
    const d = drag ?? 0;
    dragged.current = Math.abs(d) >= 6;
    if (d < -40) setOpen(true);
    else if (d > 40) setOpen(false);
    start.current = null;
    setDrag(null);
  };
  // toucher / clic / clavier → bascule (sauf si on vient de glisser)
  const onClick = () => {
    if (dragged.current) { dragged.current = false; return; }
    setOpen((o) => !o);
  };

  return (
    <main className="app" id="main">
      <section className="app-map" aria-label={tt.t('map.listTitle')}>
        <MapPanel data={data} />
      </section>
      <aside
        ref={sheetRef}
        className={`app-bulletin sheet ${open ? 'is-open' : ''} ${drag !== null ? 'is-dragging' : ''}`}
        style={drag !== null ? { ['--drag' as string]: `${drag}px` } : undefined}
      >
        <button
          className="sheet-handle"
          aria-expanded={open}
          aria-label={open ? tt.t('bulletin.collapse') : tt.t('bulletin.expand')}
          onPointerDown={onDown}
          onPointerMove={onMove}
          onPointerUp={onUp}
          onPointerCancel={onUp}
          onClick={onClick}
        >
          <span />
        </button>
        <Bulletin data={data} />
      </aside>
    </main>
  );
}
