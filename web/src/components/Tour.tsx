/**
 * Guided tour: a 1-minute walk through NIRAN for first-time visitors (and hackathon judges).
 * Each step sets the app state (page, country, month), waits for its target to render,
 * then spotlights it with a short card. Copy lives in en.json → tour.steps (same order as STEPS).
 * Start: the homepage or header Tour button, the first-visit offer, or ?tour=1 in the URL.
 */
import { useEffect, useLayoutEffect, useRef, useState, type CSSProperties } from 'react';
import { create } from 'zustand';
import { useT } from '../i18n';
import { useApp, type AppState } from '../store';

type Patch = Partial<Omit<AppState, 'set'>>;
interface StepCfg { target: string; state?: Patch }

/** Australia, December 2023: a month that clearly left its usual range, with fires visible on the globe. */
const DEMO: Patch = { regionId: 'AUS', year: 2023, month: 12 };
const STEPS: StepCfg[] = [
  { target: '[data-tour="hero"]', state: { page: 'home', ...DEMO } },
  { target: '[data-tour="countries"]', state: { page: 'home', ...DEMO } },
  { target: '[data-tour="verdict"]', state: { page: 'app', ...DEMO } },
  { target: '[data-tour="history"]', state: { page: 'app', ...DEMO } },
  { target: '[data-tour="safety"] > summary', state: { page: 'app', ...DEMO } },
  { target: '[data-tour="replay"]', state: { page: 'app', ...DEMO } },
  { target: '[data-tour="sensor"]', state: { page: 'app', ...DEMO } },
  { target: '[data-tour="compare"] > :first-child', state: { page: 'compare', regionId: 'AUS', year: 2022, yearB: 2023 } },
  { target: '[data-tour="method"] > summary', state: { page: 'method' } },
];

const SEEN = 'niran.tour.seen.v2';
const markSeen = () => { try { localStorage.setItem(SEEN, '1'); } catch { /* storage blocked: offer again next time */ } };
const wasSeen = () => { try { return localStorage.getItem(SEEN) === '1'; } catch { return false; } };

export const useTour = create<{ step: number | null; start: () => void; go: (i: number) => void; stop: () => void }>((set) => ({
  step: null,
  start: () => { markSeen(); set({ step: 0 }); },
  go: (i) => set({ step: Math.max(0, Math.min(STEPS.length - 1, i)) }),
  stop: () => { markSeen(); set({ step: null }); },
}));

const PAD = 8, GAP = 14, EDGE = 16;
const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));

/** Where the card goes: under the target, else above, else beside it, else pinned to the bottom. */
function place(r: DOMRect | null, w: number, h: number): CSSProperties {
  const vw = innerWidth, vh = innerHeight;
  if (!r) return { left: '50%', top: '50%', transform: 'translate(-50%, -50%)' };
  if (vw < 860) {
    const headerBottom = document.querySelector<HTMLElement>('.header')?.getBoundingClientRect().bottom ?? 0;
    const top = Math.min(Math.max(EDGE + 12, headerBottom + 12), vh - h - EDGE);
    return r.top + r.height / 2 > vh / 2
      ? { left: EDGE, right: EDGE, top }
      : { left: EDGE, right: EDGE, bottom: EDGE };
  }
  const left = clamp(r.left, EDGE, vw - w - EDGE);
  if (r.bottom + PAD + GAP + h < vh - EDGE) return { left, top: r.bottom + PAD + GAP };
  if (r.top - PAD - GAP - h > EDGE) return { left, top: r.top - PAD - GAP - h };
  const top = clamp(r.top, EDGE, vh - h - EDGE);
  if (r.right + PAD + GAP + w < vw - EDGE) return { left: r.right + PAD + GAP, top };
  if (r.left - PAD - GAP - w > EDGE) return { left: r.left - PAD - GAP - w, top };
  return { left: clamp(r.left + r.width / 2 - w / 2, EDGE, vw - w - EDGE), bottom: EDGE };
}

export function Tour() {
  const tt = useT();
  const step = useTour((s) => s.step);
  const page = useApp((s) => s.page);
  const texts = tt.tv<{ title: string; body: string }[]>('tour.steps');
  const [found, setFound] = useState<{ rect: DOMRect | null; step: number } | null>(null);
  const [offer, setOffer] = useState(false);
  const [size, setSize] = useState({ w: 360, h: 220 });
  const card = useRef<HTMLDivElement>(null);
  const offerRef = useRef<HTMLElement>(null);
  const offerStartRef = useRef<HTMLButtonElement>(null);
  const returnFocusRef = useRef<HTMLElement | null>(null);

  // ?tour=1 starts the tour for demo links; first-time visitors get a dismissible offer.
  useEffect(() => {
    if (new URLSearchParams(location.search).get('tour') === '1') { useTour.getState().start(); return; }
    if (page !== 'home') { setOffer(false); return; }
    if (wasSeen()) return;
    const timer = window.setTimeout(() => setOffer(true), 800);
    return () => clearTimeout(timer);
  }, [page]);
  useEffect(() => { if (step !== null) setOffer(false); }, [step]);

  useEffect(() => {
    if (!offer) return;
    returnFocusRef.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    offerStartRef.current?.focus({ preventScroll: true });
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        markSeen();
        setOffer(false);
        requestAnimationFrame(() => returnFocusRef.current?.focus({ preventScroll: true }));
        return;
      }
      if (event.key !== 'Tab') return;
      const buttons = offerRef.current?.querySelectorAll<HTMLButtonElement>('button:not([disabled])');
      if (!buttons?.length) return;
      const first = buttons[0], last = buttons[buttons.length - 1];
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [offer]);

  const dismissOffer = () => {
    markSeen();
    setOffer(false);
    requestAnimationFrame(() => returnFocusRef.current?.focus({ preventScroll: true }));
  };

  // Apply the step's state, then follow its target (globe and panels move and scroll). A timer, not
  // requestAnimationFrame, so the tour still advances when the tab is in the background.
  useEffect(() => {
    if (step === null) { setFound(null); return; }
    const cfg = STEPS[step];
    // Put the card on screen immediately; it will glide to the first target when it mounts.
    setFound((current) => current ?? { rect: null, step });
    if (cfg.state) useApp.getState().set(cfg.state);
    const t0 = performance.now();
    let timer = 0, last = '', scrolled = 0;
    const tick = () => {
      const el = document.querySelector<HTMLElement>(cfg.target);
      const r = el?.getBoundingClientRect();
      if (el && r && r.width > 0 && r.height > 0) {
        const headerBottom = document.querySelector<HTMLElement>('.header')?.getBoundingClientRect().bottom ?? 0;
        const off = r.bottom < headerBottom + 12 || r.top > innerHeight - 40;
        if (!scrolled) {
          scrolled = performance.now();
          const smooth = !document.hidden && !matchMedia('(prefers-reduced-motion: reduce)').matches;
          el.scrollIntoView({ block: 'center', inline: 'nearest', behavior: smooth ? 'smooth' : 'auto' });
        } else if (off && performance.now() - scrolled > 1200) {
          scrolled = performance.now(); // smooth scroll was cut short: jump there
          el.scrollIntoView({ block: 'center', inline: 'nearest' });
        }
        const key = [r.left, r.top, r.width, r.height].map(Math.round).join();
        if (key !== last) { last = key; setFound({ rect: r, step }); }
      } else if (performance.now() - t0 > 2500 && last !== 'none') {
        last = 'none';
        setFound({ rect: null, step }); // target not on screen (e.g. phone layout): show the card centred
      }
      timer = window.setTimeout(tick, 40);
    };
    tick();
    return () => clearTimeout(timer);
  }, [step]);

  // Keep the dialog visible while the next page/target is entering view. The spotlight then
  // glides to the new target instead of briefly leaving an empty dim overlay.
  const shown = step !== null && found !== null;
  useLayoutEffect(() => {
    if (!shown || !card.current) return;
    const { offsetWidth: w, offsetHeight: h } = card.current;
    if (w !== size.w || h !== size.h) setSize({ w, h });
  });
  useEffect(() => { if (shown) card.current?.focus({ preventScroll: true }); }, [shown, step]);

  useEffect(() => {
    if (step === null) return;
    const onKey = (e: KeyboardEvent) => {
      const { go, stop } = useTour.getState();
      if (e.key === 'Escape') stop();
      else if (e.key === 'ArrowRight') { if (step < STEPS.length - 1) go(step + 1); else stop(); }
      else if (e.key === 'ArrowLeft') go(step - 1);
    };
    addEventListener('keydown', onKey);
    return () => removeEventListener('keydown', onKey);
  }, [step]);

  if (step === null) {
    if (!offer) return null;
    return (
      <>
      <div className="tour-offer-backdrop" aria-hidden="true" />
      <aside ref={offerRef} className="tour-offer" role="dialog" aria-modal="true" aria-labelledby="tour-offer-title" aria-describedby="tour-offer-body">
        <p className="tour-offer-title" id="tour-offer-title">{tt.t('tour.offerTitle')}</p>
        <p id="tour-offer-body">{tt.t('tour.offerBody')}</p>
        <div className="tour-actions">
          <button ref={offerStartRef} className="btn btn-primary" onClick={() => useTour.getState().start()}>{tt.t('tour.offerStart')}</button>
          <button className="tour-link" onClick={dismissOffer}>{tt.t('tour.offerLater')}</button>
        </div>
      </aside>
      </>
    );
  }

  // keep the spotlight on screen even for a target taller than the window
  const raw = shown ? found!.rect : null;
  const clip = raw && new DOMRect(raw.left, Math.max(raw.top, 8), raw.width, Math.min(raw.bottom, innerHeight - 8) - Math.max(raw.top, 8));
  const r = clip && clip.height > 0 ? clip : null;
  const last = step === STEPS.length - 1;
  const text = texts[step];
  const { go, stop } = useTour.getState();
  return (
    <div className="tour" role="presentation">
      {r ? (
        <div className="tour-spot" style={{ left: r.left - PAD, top: r.top - PAD, width: r.width + PAD * 2, height: r.height + PAD * 2 }} />
      ) : (
        <div className="tour-dim" />
      )}
      {shown && (
        <div
          ref={card} className="tour-card" role="dialog" aria-modal="true" aria-labelledby="tour-title" aria-describedby="tour-body" tabIndex={-1}
          style={place(r, size.w, size.h)}
        >
          <p className="tour-count mono">{tt.t('tour.count', { i: step + 1, n: STEPS.length })}</p>
          <h2 className="tour-title" id="tour-title">{text.title}</h2>
          <p className="tour-body" id="tour-body">{text.body}</p>
          <div className="tour-dots" aria-hidden="true">
            {STEPS.map((_, i) => <span key={i} className={i === step ? 'is-on' : i < step ? 'is-done' : ''} />)}
          </div>
          <div className="tour-actions">
            <button className="tour-link" onClick={stop}>{tt.t('tour.skip')}</button>
            <span className="tour-nav">
              {step > 0 && <button className="btn" onClick={() => go(step - 1)}>{tt.t('tour.back')}</button>}
              <button className="btn btn-primary" onClick={() => (last ? stop() : go(step + 1))}>{last ? tt.t('tour.finish') : tt.t('tour.next')}</button>
            </span>
          </div>
        </div>
      )}
    </div>
  );
}
