import { useEffect, useMemo, useRef, useState } from 'react';
import { useT } from '../i18n';
import { useApp } from '../store';
import { useSensor, type Dataset } from '../lib/data';
import { computeVerdict } from '../lib/stats';
import { MapPanel } from '../map/MapPanel';
import { Bulletin } from '../bulletin/Bulletin';
import { VerdictStats } from '../bulletin/Verdict';

const W_KEY = 'niran.panel.w';
const W_DEFAULT = 430, W_MIN = 340;
const wMax = () => Math.max(W_MIN, Math.min(1100, innerWidth - 220));
const wWide = () => Math.min(wMax(), Math.max(760, Math.round(innerWidth * 0.56)));
const savedW = () => { try { const v = Number(localStorage.getItem(W_KEY)); return v >= W_MIN ? v : W_DEFAULT; } catch { return W_DEFAULT; } };

function useMedia(query: string) {
  const [on, setOn] = useState(() => matchMedia(query).matches);
  useEffect(() => {
    const m = matchMedia(query);
    const f = () => setOn(m.matches);
    m.addEventListener('change', f);
    return () => m.removeEventListener('change', f);
  }, [query]);
  return on;
}

/**
 * Desktop: the globe fills the page; the bulletin floats over its right side as glass cards.
 * The panel can be dragged wider (cards flow into columns), widened in one click, or hidden.
 * Phone: globe on top, bulletin in a sliding drawer (peek → full screen).
 */
export function AppView({ data }: { data: Dataset }) {
  const tt = useT();
  const { regionId, year, month } = useApp();
  const sensor = useSensor(data);
  const phone = useMedia('(max-width: 860px)');
  const [open, setOpen] = useState(false);
  const [drag, setDrag] = useState<number | null>(null);
  const start = useRef<{ y: number; open: boolean } | null>(null);
  const sheetRef = useRef<HTMLElement>(null);

  const [width, setWidth] = useState(savedW);
  const [hidden, setHidden] = useState(false);
  const [popped, setPopped] = useState(false);
  useEffect(() => {
    if (!popped) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setPopped(false); };
    addEventListener('keydown', onKey);
    return () => removeEventListener('keydown', onKey);
  }, [popped]);
  const [resizing, setResizing] = useState(false);
  const grip = useRef<{ x: number; w: number } | null>(null);
  const w = Math.min(width, wMax());
  const wide = w > (W_DEFAULT + wWide()) / 2;
  const keepW = (v: number) => { const n = Math.round(Math.max(W_MIN, Math.min(wMax(), v))); setWidth(n); try { localStorage.setItem(W_KEY, String(n)); } catch { /* not kept */ } };

  const verdict = useMemo(() => (regionId ? computeVerdict(data, regionId, sensor, year, month) : null), [data, regionId, sensor, year, month]);

  // new country → back to the top of the bulletin
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
  // tap / click / keyboard → toggle (unless it was a drag)
  const onClick = () => {
    if (dragged.current) { dragged.current = false; return; }
    setOpen((o) => !o);
  };

  const panelW = phone || hidden ? 0 : w;
  return (
    <main className={`app ${hidden ? 'is-panel-hidden' : ''} ${resizing ? 'is-resizing' : ''} ${popped ? 'is-popped' : ''}`} id="main" style={{ ['--panel-w' as string]: `${panelW}px` }}>
      <section className="app-map" aria-label={tt.t('map.listTitle')}>
        <MapPanel data={data} inset={panelW ? panelW + 24 : 0} />
      </section>

      {/* Widened: the bulletin opens as a see-through layer over the globe; a click on any empty spot closes it */}
      {popped && !phone && (
        <div
          className="bulletin-pop"
          role="dialog"
          aria-modal="true"
          aria-label={tt.t('bulletin.title')}
          onClick={(e) => { if ((e.target as HTMLElement).closest('.pop-keep, .panel-head, .block, .verdict, .panel-foot, button, select, a, input')) return; setPopped(false); }}
        >
          <div className="bulletin-pop-inner">
            <p className="pop-hint mono">Click any empty space to go back to the globe</p>
            {verdict && (
              <div className="pop-keep pop-kpis">
                <VerdictStats v={verdict} className="pop-stats" period={month === null ? String(year) : `${tt.monthShort(month)} ${year}`} />
              </div>
            )}
            <div className="pop-body">
              <Bulletin data={data} />
            </div>
          </div>
        </div>
      )}

      {hidden && !phone && (
        <button className="glass-btn panel-show" onClick={() => setHidden(false)}>
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="m14 6-6 6 6 6" /></svg>
          {tt.t('panel.show')}
        </button>
      )}

      <aside
        ref={sheetRef}
        className={`app-bulletin sheet ${open ? 'is-open' : ''} ${drag !== null ? 'is-dragging' : ''}`}
        style={drag !== null ? { ['--drag' as string]: `${drag}px` } : undefined}
        hidden={(hidden || popped) && !phone}
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

        <div className="panel-tools">
          <button className="glass-btn" onClick={() => (wide ? keepW(W_DEFAULT) : setPopped(true))} aria-label={tt.t(wide ? 'panel.narrow' : 'panel.widen')} title={tt.t(wide ? 'panel.narrow' : 'panel.widen')}>
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              {wide ? <path d="M4 12h7M8 8l4 4-4 4M20 5v14" /> : <path d="M20 12h-9M15 8l-4 4 4 4M4 5v14" />}
            </svg>
            {tt.t(wide ? 'panel.narrow' : 'panel.widen')}
          </button>
          <button className="glass-btn" onClick={() => setHidden(true)} aria-label={tt.t('panel.hide')} title={tt.t('panel.hide')}>
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="m10 6 6 6-6 6" /></svg>
            {tt.t('panel.hide')}
          </button>
        </div>
        <Bulletin data={data} />
      </aside>

      {!hidden && !popped && !phone && (
        <div
          className="panel-grip"
          role="separator"
          aria-orientation="vertical"
          aria-label={tt.t('panel.resize')}
          aria-valuemin={W_MIN} aria-valuemax={wMax()} aria-valuenow={w}
          tabIndex={0}
          title={tt.t('panel.resize')}
          onPointerDown={(e) => { grip.current = { x: e.clientX, w }; setResizing(true); e.currentTarget.setPointerCapture(e.pointerId); }}
          onPointerMove={(e) => { if (grip.current && e.buttons) keepW(grip.current.w + grip.current.x - e.clientX); }}
          onPointerUp={() => { grip.current = null; setResizing(false); }}
          onPointerCancel={() => { grip.current = null; setResizing(false); }}
          onDoubleClick={() => keepW(wide ? W_DEFAULT : wWide())}
          onKeyDown={(e) => {
            if (e.key === 'ArrowLeft') { e.preventDefault(); keepW(w + 40); }
            else if (e.key === 'ArrowRight') { e.preventDefault(); keepW(w - 40); }
          }}
        ><span /></div>
      )}
    </main>
  );
}
