import { useEffect, useRef, useState } from 'react';
import { loadGlobeCells, regionName, type GlobeCellsFile, type Region } from '../lib/data';
import './intro.css';

/**
 * Entrance sequence, played on every page load.
 *
 *   0.0  a spark; its shock ring becomes the limb of a wireframe Earth
 *   0.4  the Earth turns past every monitored country — each ember is a real FIRMS grid cell
 *        from globe_cells.json, the counter runs up to the real number of detections
 *   2.5  the embers leave the globe and gather into the NIRAN flame
 *   3.3  wordmark and tagline
 *   4.5+ once the dataset is ready, an iris opens from the flame onto the page
 *
 * Everything is a pure function of the timeline time T (no per-frame state), so any frame can be
 * frozen in dev with ?intro=<seconds>&introOpen=<0..1>. Click or any key skips to the iris.
 * Reduced-motion users never see it.
 */

const BG = '#0B0D12';
const EMBER = '#F0803C';
const FLAME = 'M16 5c1 4 6 6.5 6 12.5A6 6 0 0 1 10 17.5c0-2.6 1.4-4.1 2.6-5.3.3 1.8 1.2 2.8 2.2 3.3C14.4 11.4 15 8 16 5z';
/** Flame bounding box in logo units, and the three history bars inside it. */
const FB = { x: 10, y: 5, w: 12, h: 18.5, cx: 16, cy: 14.25 };
const BARS = [{ x: 12.6, h: 3.5 }, { x: 15.1, h: 5.5 }, { x: 17.6, h: 4.5 }];
const BAR_BASE = 21.5;

const SPIN_A = 0.4;
const SPIN_B = 2.7;
const GATHER = 2.5;
const LOCK = 3.3;
const MIN_OPEN = 4.5;
const OPEN_S = 1.05;
const LON_FROM = -100;
const LON_TO = 152;
const LAT0 = (-14 * Math.PI) / 180;
const PARTICLES = 560;
const RAD = Math.PI / 180;

const clamp01 = (v: number) => (v < 0 ? 0 : v > 1 ? 1 : v);
const seg = (t: number, a: number, b: number) => clamp01((t - a) / (b - a));
const outCubic = (p: number) => 1 - (1 - p) ** 3;
const outExpo = (p: number) => (p >= 1 ? 1 : 1 - 2 ** (-10 * p));
const inOutCubic = (p: number) => (p < 0.5 ? 4 * p * p * p : 1 - (-2 * p + 2) ** 3 / 2);
const inOutQuart = (p: number) => (p < 0.5 ? 8 * p ** 4 : 1 - (-2 * p + 2) ** 4 / 2);
const lerp = (a: number, b: number, p: number) => a + (b - a) * p;
const lonAt = (T: number) => lerp(LON_FROM, LON_TO, inOutCubic(seg(T, SPIN_A, SPIN_B))) * RAD;

function mulberry32(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

interface Fires {
  n: number;
  cosLat: Float32Array; sinLat: Float32Array; lon: Float32Array;
  w: Float32Array; phase: Float32Array;
  /** cell indices grouped by colour bucket (dim → hot), and where each bucket starts */
  order: Uint32Array; bucketStart: number[];
  /** cells that fly into the flame, brightest of the last visible hemisphere first */
  picked: Uint32Array; isPicked: Uint8Array;
  total: number; regionIds: string[]; regionTotals: number[];
  period: string;
}

function prepare(file: GlobeCellsFile): Fires {
  const n = file.cells.length;
  const cosLat = new Float32Array(n), sinLat = new Float32Array(n), lon = new Float32Array(n);
  const w = new Float32Array(n), phase = new Float32Array(n);
  const regionTotals = file.regions.map(() => 0);
  const rand = mulberry32(20);
  let max = 1, total = 0;
  const sums = new Float64Array(n);
  for (let i = 0; i < n; i++) {
    const c = file.cells[i];
    let s = 0;
    for (let k = 4; k < c.length; k += 3) s += c[k];
    sums[i] = s; total += s; if (s > max) max = s;
    if (regionTotals[c[2]] !== undefined) regionTotals[c[2]] += s;
    cosLat[i] = Math.cos(c[0] * RAD); sinLat[i] = Math.sin(c[0] * RAD); lon[i] = c[1] * RAD;
    phase[i] = rand() * Math.PI * 2;
  }
  const lmax = Math.log1p(max);
  for (let i = 0; i < n; i++) w[i] = Math.log1p(sums[i]) / lmax;

  const bucket = (v: number) => (v < 0.45 ? 0 : v < 0.75 ? 1 : 2);
  const order = Uint32Array.from({ length: n }, (_, i) => i).sort((a, b) => bucket(w[a]) - bucket(w[b]));
  const bucketStart = [0, n, n, n];
  for (let k = 0, b = 0; k < n; k++) { const bb = bucket(w[order[k]]); while (b < bb) bucketStart[++b] = k; }

  // Embers that will gather: what faces the viewer when the globe stops
  const l0 = lonAt(GATHER), s0 = Math.sin(LAT0), c0 = Math.cos(LAT0);
  const vis: number[] = [];
  for (let i = 0; i < n; i++) if (s0 * sinLat[i] + c0 * cosLat[i] * Math.cos(lon[i] - l0) > 0.12) vis.push(i);
  vis.sort((a, b) => w[b] - w[a]);
  const picked = Uint32Array.from(vis.slice(0, PARTICLES));
  const isPicked = new Uint8Array(n);
  picked.forEach((i) => { isPicked[i] = 1; });

  const y = file.years;
  return {
    n, cosLat, sinLat, lon, w, phase, order, bucketStart, picked, isPicked,
    total, regionIds: file.regions, regionTotals,
    period: y.length ? `${y[0]} — ${y[y.length - 1]}` : '',
  };
}

/** Seeded points inside the flame, in logo units, plus per-particle delay and swirl. */
function flameTargets(count: number) {
  const ctx = document.createElement('canvas').getContext('2d');
  const path = new Path2D(FLAME);
  const rand = mulberry32(7);
  const tx = new Float32Array(count), ty = new Float32Array(count), delay = new Float32Array(count), swirl = new Float32Array(count);
  for (let i = 0; i < count; i++) {
    let x = FB.cx, y = FB.cy;
    for (let tries = 0; tries < 40; tries++) {
      const px = FB.x + rand() * FB.w, py = FB.y + rand() * FB.h;
      if (!ctx || ctx.isPointInPath(path, px, py)) { x = px; y = py; break; }
    }
    tx[i] = x; ty[i] = y; delay[i] = rand(); swirl[i] = (rand() - 0.5) * 2;
  }
  return { tx, ty, delay, swirl };
}

const HOT = ['#C2410C', EMBER, '#FFD9A8'];

export function Intro({ ready, tagline, regions }: { ready: boolean; tagline: string; regions: Region[] }) {
  const [done, setDone] = useState(() => window.matchMedia('(prefers-reduced-motion: reduce)').matches);
  const root = useRef<HTMLDivElement>(null);
  const canvas = useRef<HTMLCanvasElement>(null);
  const slot = useRef<HTMLDivElement>(null);
  const lockup = useRef<HTMLDivElement>(null);
  const hud = useRef<HTMLDivElement>(null);
  const hint = useRef<HTMLSpanElement>(null);
  const count = useRef<HTMLSpanElement>(null);
  const period = useRef<HTMLSpanElement>(null);
  const regionEl = useRef<HTMLSpanElement>(null);
  const word = useRef<HTMLParagraphElement>(null);
  const tag = useRef<HTMLSpanElement>(null);
  const src = useRef<HTMLSpanElement>(null);
  const readyRef = useRef(ready);
  readyRef.current = ready;
  const regionsRef = useRef(regions);
  regionsRef.current = regions;
  const skip = useRef(false);

  useEffect(() => {
    if (done) return;
    const cv = canvas.current, rootEl = root.current;
    const ctx = cv?.getContext('2d');
    if (!cv || !ctx || !rootEl) { setDone(true); return; }

    const params = import.meta.env.DEV ? new URLSearchParams(window.location.search) : null;
    const frozenT = params?.has('intro') ? Number(params.get('intro')) : null;
    const frozenOpen = Number(params?.get('introOpen') ?? 0);

    let fires: Fires | null = null;
    let firesAt = 0;
    let alive = true;
    const t0 = performance.now();
    const now = () => (frozenT !== null ? frozenT : (performance.now() - t0) / 1000);
    loadGlobeCells('MODIS').then((file) => {
      if (!alive || !file) return;
      fires = prepare(file);
      firesAt = frozenT !== null ? -1 : now();
      if (period.current) period.current.textContent = fires.period;
    }).catch(() => { /* the globe simply stays unlit */ });

    const targets = flameTargets(PARTICLES);
    const flamePath = new Path2D(FLAME);
    const letters = Array.from(word.current?.children ?? []) as HTMLElement[];

    let W = 0, H = 0, cx = 0, cy = 0, R = 0;
    let fx = 0, fy = 0, fs = 1; // flame centre on screen, px per logo unit
    const layout = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      W = window.innerWidth; H = window.innerHeight;
      cv.width = Math.round(W * dpr); cv.height = Math.round(H * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      cx = W / 2; cy = H / 2; R = Math.min(Math.min(W, H) * 0.34, 320);
      const r = slot.current?.getBoundingClientRect();
      if (r) { fs = r.height / FB.h; fx = r.left + r.width / 2; fy = r.top + r.height / 2; }
    };
    layout();
    window.addEventListener('resize', layout);

    const s0 = Math.sin(LAT0), c0 = Math.cos(LAT0);
    let lastCount = '', lastRegion = '';

    const draw = (T: number, openP: number) => {
      const out = 1 - clamp01(openP / 0.3);
      ctx.globalCompositeOperation = 'source-over';
      ctx.globalAlpha = 1;
      ctx.fillStyle = BG;
      ctx.fillRect(0, 0, W, H);

      // ── Globe ─────────────────────────────────────────────────────────
      const gA = seg(T, 0.3, 0.9) * (1 - seg(T, GATHER + 0.1, 3.3)) * out;
      const rr = R * (0.84 + 0.16 * outCubic(seg(T, 0.25, 1.3)));
      const l0 = lonAt(T);
      if (gA > 0.003) {
        const halo = ctx.createRadialGradient(cx, cy, rr * 0.92, cx, cy, rr * 1.35);
        halo.addColorStop(0, `rgba(240,128,60,${0.16 * gA})`);
        halo.addColorStop(1, 'rgba(240,128,60,0)');
        ctx.fillStyle = halo;
        ctx.fillRect(cx - rr * 1.4, cy - rr * 1.4, rr * 2.8, rr * 2.8);
        const disc = ctx.createRadialGradient(cx - rr * 0.3, cy - rr * 0.35, rr * 0.1, cx, cy, rr);
        disc.addColorStop(0, `rgba(30,37,52,${gA})`);
        disc.addColorStop(1, `rgba(11,13,18,${gA})`);
        ctx.fillStyle = disc;
        ctx.beginPath(); ctx.arc(cx, cy, rr, 0, Math.PI * 2); ctx.fill();

        ctx.strokeStyle = `rgba(150,166,194,${0.16 * gA})`;
        ctx.lineWidth = 1;
        ctx.beginPath();
        const line = (lat: number, lon: number, pen: boolean) => {
          const cl = Math.cos(lat), sl = Math.sin(lat), d = lon - l0, cd = Math.cos(d);
          if (s0 * sl + c0 * cl * cd <= 0) return false;
          const x = cx + rr * cl * Math.sin(d), y = cy - rr * (c0 * sl - s0 * cl * cd);
          if (pen) ctx.lineTo(x, y); else ctx.moveTo(x, y);
          return true;
        };
        for (let m = -180; m < 180; m += 30) { let pen = false; for (let la = -90; la <= 90; la += 6) pen = line(la * RAD, m * RAD, pen); }
        for (let p = -60; p <= 60; p += 30) { let pen = false; for (let lo = 0; lo <= 360; lo += 6) pen = line(p * RAD, lo * RAD, pen); }
        ctx.stroke();
        ctx.strokeStyle = `rgba(214,222,236,${0.42 * gA})`;
        ctx.beginPath(); ctx.arc(cx, cy, rr, 0, Math.PI * 2); ctx.stroke();
      }

      // ── Spark, and the ring that becomes the limb ─────────────────────
      const sparkA = (1 - seg(T, 0.3, 0.8)) * out;
      if (sparkA > 0.003) {
        const sr = 4 + 46 * outCubic(seg(T, 0, 0.35));
        const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, sr);
        g.addColorStop(0, `rgba(255,236,210,${sparkA * seg(T, 0, 0.08)})`);
        g.addColorStop(0.25, `rgba(240,128,60,${0.7 * sparkA * seg(T, 0, 0.08)})`);
        g.addColorStop(1, 'rgba(240,128,60,0)');
        ctx.fillStyle = g;
        ctx.fillRect(cx - sr, cy - sr, sr * 2, sr * 2);
        const ringP = seg(T, 0.08, 0.8);
        if (ringP > 0) {
          ctx.strokeStyle = `rgba(240,128,60,${(1 - seg(T, 0.45, 0.9)) * out})`;
          ctx.lineWidth = 1.5;
          ctx.beginPath(); ctx.arc(cx, cy, rr * outExpo(ringP), 0, Math.PI * 2); ctx.stroke();
        }
      }

      // ── Fire cells on the globe ───────────────────────────────────────
      const f = fires;
      const arrive = f ? (firesAt < 0 ? 1 : seg(T, firesAt, firesAt + 0.4)) : 0;
      const gathering = T >= GATHER;
      if (f && gA * arrive > 0.003) {
        ctx.globalCompositeOperation = 'lighter';
        for (let b = 0; b < 3; b++) {
          ctx.fillStyle = HOT[b];
          for (let k = f.bucketStart[b]; k < f.bucketStart[b + 1]; k++) {
            const i = f.order[k];
            if (gathering && f.isPicked[i]) continue;
            const d = f.lon[i] - l0, cd = Math.cos(d);
            const z = s0 * f.sinLat[i] + c0 * f.cosLat[i] * cd;
            if (z <= 0.02) continue;
            const wv = f.w[i];
            const a = gA * arrive * Math.min(1, z * 3.2) * (0.3 + 0.7 * wv) * (0.72 + 0.28 * Math.sin(T * 9 + f.phase[i]));
            const sz = 1.2 + 2.3 * wv;
            ctx.globalAlpha = a;
            ctx.fillRect(cx + rr * f.cosLat[i] * Math.sin(d) - sz / 2, cy - rr * (c0 * f.sinLat[i] - s0 * f.cosLat[i] * cd) - sz / 2, sz, sz);
          }
        }
        ctx.globalAlpha = 1;
        ctx.globalCompositeOperation = 'source-over';
      }

      // ── Flame: embers gather, then the mark sets ──────────────────────
      const fA = seg(T, LOCK - 0.1, LOCK + 0.4);
      const breathe = 1 + 0.014 * Math.sin(T * 5.2) * fA;
      const fScale = fs * breathe * (1 + 1.6 * inOutCubic(clamp01(openP / 0.6)));
      if (f && gathering && out > 0.003) {
        const lg = lonAt(GATHER), rg = R; // where the globe stood when they left
        ctx.globalCompositeOperation = 'lighter';
        const pA = out * (1 - 0.8 * fA);
        for (let k = 0; k < PARTICLES; k++) {
          const i = f.picked[k % Math.max(1, f.picked.length)];
          if (i === undefined) break;
          const d = f.lon[i] - lg, cd = Math.cos(d);
          const sx = cx + rg * f.cosLat[i] * Math.sin(d), sy = cy - rg * (c0 * f.sinLat[i] - s0 * f.cosLat[i] * cd);
          const ex = fx + (targets.tx[k] - FB.cx) * fScale, ey = fy + (targets.ty[k] - FB.cy) * fScale;
          const st = GATHER + targets.delay[k] * 0.32;
          const u = inOutCubic(seg(T, st, st + 0.62));
          const arc = Math.sin(Math.PI * u) * targets.swirl[k] * 70;
          const dx = ex - sx, dy = ey - sy, len = Math.hypot(dx, dy) || 1;
          const x = lerp(sx, ex, u) - (dy / len) * arc, y = lerp(sy, ey, u) + (dx / len) * arc;
          const wv = f.w[i];
          const sz = lerp(1.4 + 2 * wv, 1.5, u);
          ctx.fillStyle = HOT[u > 0.6 ? 1 : wv < 0.45 ? 0 : wv < 0.75 ? 1 : 2];
          ctx.globalAlpha = pA * (0.55 + 0.45 * Math.sin(T * 11 + f.phase[i]));
          ctx.fillRect(x - sz / 2, y - sz / 2, sz, sz);
        }
        ctx.globalAlpha = 1;
        ctx.globalCompositeOperation = 'source-over';
      }
      if (fA * out > 0.003) {
        ctx.save();
        ctx.translate(fx, fy); ctx.scale(fScale, fScale); ctx.translate(-FB.cx, -FB.cy);
        ctx.globalAlpha = fA * out;
        ctx.shadowColor = 'rgba(240,128,60,0.75)';
        ctx.shadowBlur = 26;
        ctx.fillStyle = EMBER;
        ctx.fill(flamePath);
        ctx.shadowBlur = 0;
        ctx.fillStyle = BG;
        BARS.forEach((bar, k) => {
          const h = bar.h * outCubic(seg(T, LOCK + 0.3 + k * 0.08, LOCK + 0.75 + k * 0.08));
          if (h <= 0.01) return;
          ctx.beginPath(); ctx.roundRect(bar.x, BAR_BASE - h, 1.8, h, Math.min(0.9, h / 2)); ctx.fill();
        });
        ctx.restore();
        // a few sparks keep rising while the page finishes loading
        ctx.globalCompositeOperation = 'lighter';
        ctx.fillStyle = '#FFD9A8';
        for (let k = 0; k < 14; k++) {
          const per = 1.5 + (k % 5) * 0.22;
          const life = ((T - LOCK) / per + k * 0.37) % 1;
          if (life < 0) continue;
          ctx.globalAlpha = Math.sin(Math.PI * life) * 0.75 * fA * out;
          const ex = fx + ((((k * 53) % 17) / 17) - 0.5) * FB.w * fs * 0.9 + Math.sin(life * 6 + k) * 5;
          ctx.fillRect(ex, fy - life * FB.h * fs * 1.25, 1.6, 1.6);
        }
        ctx.globalAlpha = 1;
        ctx.globalCompositeOperation = 'source-over';
      }

      // ── Iris: a hole opens from the flame onto the page ───────────────
      if (openP > 0) {
        const e = inOutQuart(openP);
        const rh = e * (Math.hypot(Math.max(fx, W - fx), Math.max(fy, H - fy)) + 60);
        ctx.globalCompositeOperation = 'destination-out';
        ctx.beginPath(); ctx.arc(fx, fy, rh, 0, Math.PI * 2); ctx.fill();
        ctx.globalCompositeOperation = 'source-over';
        const band = 70;
        const g = ctx.createRadialGradient(fx, fy, rh, fx, fy, rh + band);
        g.addColorStop(0, `rgba(240,128,60,${0.6 * (1 - e)})`);
        g.addColorStop(1, 'rgba(240,128,60,0)');
        ctx.strokeStyle = g;
        ctx.lineWidth = band;
        ctx.beginPath(); ctx.arc(fx, fy, rh + band / 2, 0, Math.PI * 2); ctx.stroke();
        ctx.strokeStyle = `rgba(255,214,170,${0.95 * (1 - e)})`;
        ctx.lineWidth = 1.5;
        ctx.beginPath(); ctx.arc(fx, fy, rh + 0.75, 0, Math.PI * 2); ctx.stroke();
      }

      // ── Text layers (DOM, driven by the same clock) ───────────────────
      if (hud.current) hud.current.style.opacity = String(seg(T, 0.6, 1.1) * (1 - seg(T, GATHER, GATHER + 0.45)) * out);
      if (hint.current) hint.current.style.opacity = String(seg(T, 1.4, 1.9) * out);
      if (f && count.current) {
        const txt = Math.round(f.total * inOutCubic(seg(T, 0.55, SPIN_B - 0.1))).toLocaleString('en-US');
        if (txt !== lastCount) { count.current.textContent = txt; lastCount = txt; }
      }
      if (f && regionEl.current) {
        let best: Region | undefined, bestD = 46;
        for (const r of regionsRef.current) {
          if (!r.center) continue;
          const dd = Math.abs((((r.center[1] - l0 / RAD) % 360) + 540) % 360 - 180);
          if (dd < bestD) { bestD = dd; best = r; }
        }
        const idx = best ? f.regionIds.indexOf(best.region_id) : -1;
        const txt = best && idx >= 0 ? `${regionName(best)} · ${f.regionTotals[idx].toLocaleString('en-US')}` : '';
        if (txt && txt !== lastRegion) { regionEl.current.textContent = txt; lastRegion = txt; }
        regionEl.current.style.opacity = String(txt ? clamp01((46 - bestD) / 14) : 0);
      }
      letters.forEach((el, i) => {
        const p = outExpo(seg(T, LOCK + i * 0.06, LOCK + i * 0.06 + 0.75));
        el.style.transform = `translateY(${(1 - p) * 108}%)`;
      });
      if (tag.current) tag.current.style.opacity = String(seg(T, LOCK + 0.5, LOCK + 0.95));
      if (src.current) src.current.style.opacity = String(seg(T, LOCK + 0.65, LOCK + 1.1));
      if (lockup.current) {
        lockup.current.style.opacity = String(out);
        lockup.current.style.transform = `scale(${1 + 0.08 * openP})`;
      }
    };

    let raf = 0;
    let openAt: number | null = null;
    const tick = () => {
      const T = now();
      let openP = frozenOpen;
      if (frozenT === null) {
        if (openAt === null && (skip.current || (T >= MIN_OPEN && readyRef.current))) {
          openAt = T;
          rootEl.classList.add('is-open');
        }
        openP = openAt === null ? 0 : clamp01((T - openAt) / OPEN_S);
      } else if (frozenOpen > 0) rootEl.classList.add('is-open');
      draw(T, openP);
      if (openP >= 1 && frozenT === null) { setDone(true); return; }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);

    const onKey = () => { skip.current = true; };
    window.addEventListener('keydown', onKey);
    const html = document.documentElement;
    const prevOverflow = html.style.overflow;
    html.style.overflow = 'hidden';

    return () => {
      alive = false;
      cancelAnimationFrame(raf);
      window.removeEventListener('resize', layout);
      window.removeEventListener('keydown', onKey);
      html.style.overflow = prevOverflow;
    };
  }, [done]);

  if (done) return null;

  return (
    <div className="intro" ref={root} aria-hidden="true" onClick={() => { skip.current = true; }}>
      <canvas ref={canvas} className="intro-canvas" />
      <div className="intro-hud" ref={hud}>
        <div className="intro-hud-tl">
          <span>NASA FIRMS · MODIS</span>
          <span ref={period} />
        </div>
        <div className="intro-hud-bl">
          <span>Fire detections</span>
          <span className="intro-count" ref={count}>—</span>
          <span className="intro-region" ref={regionEl} />
        </div>
      </div>
      <span className="intro-hint" ref={hint}>Click or press any key to enter</span>
      <div className="intro-lockup" ref={lockup}>
        <div className="intro-slot" ref={slot} />
        <p className="intro-word" ref={word}>
          {'NIRAN'.split('').map((ch, i) => <span key={i}>{ch}</span>)}
        </p>
        <span className="intro-tag" ref={tag}>{tagline}</span>
        <span className="intro-src" ref={src}>NASA FIRMS · GIBS · POWER</span>
      </div>
    </div>
  );
}
