/**
 * NIRAN server — one Node process, no dependencies (Node 20+).
 *
 *   /            the built React site (web/dist), SPA fallback
 *   /api/live    NASA FIRMS near-real-time detections per country: last 7 days vs the usual level
 *   /api/chat    the NIRAN agent: answers from NASA facts only (LLM optional, falls back to a template)
 *   /api/watches the agent's watch list (countries where it sensed rising risk)
 *   /api/alerts  alerts sent to the fire service, + /api/alerts/stream (Server-Sent Events)
 *
 * Alert loop: every WATCH_INTERVAL_MIN the server re-reads FIRMS, and for each watched country it
 * clusters new VIIRS detections (~10 km cells). A cluster is "confirmed" when it has at least
 * two detections or one strong one (FRP >= 20 MW). Confirmed clusters become alerts, pushed to the
 * fire-service console and, when ALERT_WEBHOOK_URL is set, POSTed there as JSON (CAP-style fields).
 *
 * Env: PORT, LLM_API_KEY, LLM_BASE_URL (default DeepSeek), LLM_MODEL, ALERT_WEBHOOK_URL,
 *      WATCH_INTERVAL_MIN (default 10), DATA_DIR, DIST_DIR
 */
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

// ---------- config ----------
const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, '..');
loadDotEnv(path.join(ROOT, '.env'));
const PORT = Number(process.env.PORT || 8787);
const DIST = process.env.DIST_DIR || path.join(ROOT, 'web', 'dist');
const DATA = process.env.DATA_DIR
  || (fs.existsSync(path.join(DIST, 'data', 'meta.json')) ? path.join(DIST, 'data') : path.join(ROOT, 'web', 'public', 'data'));
const LLM = {
  key: process.env.LLM_API_KEY || process.env.DEEPSEEK_API_KEY || '',
  base: (process.env.LLM_BASE_URL || 'https://api.deepseek.com').replace(/\/+$/, ''),
  model: process.env.LLM_MODEL || 'deepseek-v4-pro',
};
const WEBHOOK = process.env.ALERT_WEBHOOK_URL || '';
const WATCH_MIN = Number(process.env.WATCH_INTERVAL_MIN || 10);
const FIRMS = 'https://firms.modaps.eosdis.nasa.gov/data/active_fire';
const FEEDS = {
  modis7d: `${FIRMS}/modis-c6.1/csv/MODIS_C6_1_Global_7d.csv`,
  n20_24h: `${FIRMS}/noaa-20-viirs-c2/csv/J1_VIIRS_C2_Global_24h.csv`,
  n21_24h: `${FIRMS}/noaa-21-viirs-c2/csv/J2_VIIRS_C2_Global_24h.csv`,
};
const LIVE_DAYS = 7;
const MODIS_MIN_CONF = 30;          // same cut as the pipeline
const CLUSTER_DEG = 0.1;            // ~10 km
const STRONG_FRP = 20;              // MW: one detection this strong confirms a fire on its own
const MAX_ALERTS_PER_RUN = 3;       // per country per run: the console must stay readable
const EMERGENCY = { MAR: 'Protection Civile — 15', BRA: 'Corpo de Bombeiros — 193', AUS: 'Emergency — 000' };

function loadDotEnv(file) {
  if (!fs.existsSync(file)) return;
  for (const line of fs.readFileSync(file, 'utf8').split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (m && !(m[1] in process.env)) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '');
  }
}

// ---------- archive (built by pipeline/build_web_data.py) ----------
const readJson = (name) => JSON.parse(fs.readFileSync(path.join(DATA, name), 'utf8'));
const geo = readJson('regions.geojson');
const REGIONS = geo.features.map((f) => f.properties);
const anomalies = readJson('anomalies.json');
const cumulative = readJson('cumulative.json');
const meta = readJson('meta.json');
const context = fs.existsSync(path.join(DATA, 'context.json')) ? readJson('context.json') : [];
const cellsFile = readJson('globe_cells.json');
const cellsViirs = fs.existsSync(path.join(DATA, 'globe_cells_VIIRS.json')) ? readJson('globe_cells_VIIRS.json') : null;
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

// 0.5° cell → region index. The project has no boundary file: a live point belongs to a country when it
// falls in (or next to) a cell where the archive holds detections for that country, inside its bbox.
const STEP = cellsFile.step;
const cellRegion = new Map();
for (const f of [cellsFile, cellsViirs].filter(Boolean))
  for (const c of f.cells) cellRegion.set(`${Math.floor(c[0] / STEP)}|${Math.floor(c[1] / STEP)}`, f.regions[c[2]]);
function regionOf(lat, lon) {
  const a = Math.floor(lat / STEP), o = Math.floor(lon / STEP);
  for (const [da, dO] of [[0, 0], [1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [1, -1], [-1, 1], [-1, -1]]) {
    const r = cellRegion.get(`${a + da}|${o + dO}`);
    if (!r) continue;
    const b = REGIONS.find((p) => p.region_id === r)?.bbox;
    if (!b || (lon >= b[0] && lon <= b[2] && lat >= b[1] && lat <= b[3])) return r;
  }
  return null;
}

// ---------- stats (same rules as the pipeline and web/src/lib/stats.ts) ----------
const quantile = (arr, q) => {
  const s = [...arr].sort((a, b) => a - b);
  if (!s.length) return 0;
  const pos = (s.length - 1) * q, lo = Math.floor(pos), hi = Math.ceil(pos);
  return s[lo] + (s[hi] - s[lo]) * (pos - lo);
};
function robustZ(n, ref) {
  const logs = ref.map((v) => Math.log1p(v));
  const med = quantile(logs, 0.5);
  const mad = Math.max(quantile(logs.map((v) => Math.abs(v - med)), 0.5), 0.5 / 1.4826);
  return (Math.log1p(n) - med) / (1.4826 * mad);
}
function levelFromZ(z, n, med) {
  if (med < 5 && n < 5) return 'normal';
  if (z < -1) return 'low';
  if (z < 1) return 'normal';
  if (z < 2) return 'high';
  if (z < 3) return 'unusual';
  return 'extreme';
}
const ELEVATED = new Set(['high', 'unusual', 'extreme']);
const doyOf = (d) => Math.min(365, Math.floor((d.getTime() - Date.UTC(d.getUTCFullYear(), 0, 0)) / 864e5));
function windowCounts(years, d0, d1) {
  const out = [];
  for (const [y, cum] of Object.entries(years)) {
    if (cum.length < 365) continue;
    if (d0 <= d1) out.push(cum[d1 - 1] - (d0 > 1 ? cum[d0 - 2] : 0));
    else {
      const prev = years[String(Number(y) - 1)];
      if (prev && prev.length >= 365) out.push(prev[364] - prev[d0 - 2] + cum[d1 - 1]);
    }
  }
  return out;
}

// ---------- NASA FIRMS near-real-time ----------
async function fetchText(url, ms = 90000) {
  const ctl = new AbortController();
  const t = setTimeout(() => ctl.abort(), ms);
  try {
    const r = await fetch(url, { signal: ctl.signal, headers: { 'user-agent': 'NIRAN/1.0' } });
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    return await r.text();
  } finally { clearTimeout(t); }
}
/** Parses a FIRMS CSV and keeps only rows inside one of our countries. */
function parseFirms(text, kind) {
  const lines = text.split('\n');
  const h = lines[0].split(',');
  const ix = (n) => h.indexOf(n);
  const [iLat, iLon, iDate, iTime, iSat, iConf, iFrp, iDn] = ['latitude', 'longitude', 'acq_date', 'acq_time', 'satellite', 'confidence', 'frp', 'daynight'].map(ix);
  const out = [];
  for (let i = 1; i < lines.length; i++) {
    const c = lines[i].split(',');
    if (c.length < h.length) continue;
    const lat = +c[iLat], lon = +c[iLon];
    const conf = c[iConf];
    if (kind === 'MODIS' ? Number(conf) < MODIS_MIN_CONF : conf === 'l') continue;
    const region = regionOf(lat, lon);
    if (!region) continue;
    out.push({ region, lat, lon, date: c[iDate], time: c[iTime].padStart(4, '0'), sat: c[iSat], conf, frp: +c[iFrp] || 0, dn: c[iDn]?.trim(), kind });
  }
  return out;
}

// ---------- activity log: every step the agent takes, with its numbers, streamed to the console ----------
const logs = [];
const fmt = (n) => Number(n).toLocaleString('en');
function log(kind, text, extra = {}) {
  const e = { t: new Date().toISOString(), kind, text, ...extra };
  logs.push(e);
  if (logs.length > 300) logs.shift();
  const msg = `event: log\ndata: ${JSON.stringify(e)}\n\n`;
  for (const res of sse) res.write(msg);
  return e;
}

const live = { updated: null, error: null, modis: [], viirs: [], status: [] };
async function pull(label, url, kind) {
  const t0 = Date.now();
  log('fetch', `Downloading ${label} from NASA FIRMS…`);
  const text = await fetchText(url);
  const rows = text.split('\n').length - 2;
  const kept = parseFirms(text, kind);
  log('fetch', `${label}: ${fmt(rows)} detections worldwide (${(text.length / 1e6).toFixed(1)} MB, ${((Date.now() - t0) / 1000).toFixed(1)} s) → ${fmt(kept.length)} inside our countries`);
  return kept;
}
async function refreshLive() {
  const results = await Promise.allSettled([
    pull('MODIS last 7 days (Terra + Aqua)', FEEDS.modis7d, 'MODIS'),
    pull('VIIRS last 24 h (NOAA-20)', FEEDS.n20_24h, 'VIIRS'),
    pull('VIIRS last 24 h (NOAA-21)', FEEDS.n21_24h, 'VIIRS'),
  ]);
  const [m, a, b] = results;
  if (m.status === 'rejected' && a.status === 'rejected' && b.status === 'rejected') {
    live.error = `NASA FIRMS not reachable: ${m.reason?.message ?? m.reason}`;
    log('error', live.error);
    return;
  }
  if (m.status === 'fulfilled') live.modis = m.value;
  live.viirs = [a, b].flatMap((r) => (r.status === 'fulfilled' ? r.value : []));
  live.updated = new Date().toISOString();
  live.error = results.filter((r) => r.status === 'rejected').map((r) => String(r.reason?.message ?? r.reason)).join('; ') || null;
  live.status = computeStatus();
  for (const s of live.status) {
    log('sense', `${s.name}: ${fmt(s.n)} MODIS detections in the last 7 days; usual for these days ${s.usual === null ? 'unknown' : fmt(s.usual)} (median of ${s.refYears} archive years) → ${s.level ?? 'unknown'}`, { region_id: s.region_id });
  }
}

function computeStatus() {
  const now = new Date();
  const t0 = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
  const days = Array.from({ length: LIVE_DAYS }, (_, i) => new Date(t0 - (LIVE_DAYS - i) * 864e5));
  const dates = days.map((d) => d.toISOString().slice(0, 10));
  const d0 = doyOf(days[0]), d1 = doyOf(days[days.length - 1]);
  return REGIONS.map((r) => {
    const perDay = dates.map((d) => live.modis.filter((p) => p.region === r.region_id && p.date === d).length);
    const n = perDay.reduce((x, y) => x + y, 0);
    const ref = cumulative[r.region_id] ? windowCounts(cumulative[r.region_id].years, d0, d1) : [];
    const usual = ref.length >= 3 ? Math.round(quantile(ref, 0.5)) : null;
    const level = usual === null ? null : levelFromZ(robustZ(n, ref), n, usual);
    const v24 = live.viirs.filter((p) => p.region === r.region_id);
    return {
      region_id: r.region_id, name: r.name_en, dates, perDay, n, usual, refYears: ref.length, level,
      viirs24h: v24.length, viirsStrong24h: v24.filter((p) => p.frp >= STRONG_FRP).length,
    };
  });
}

// ---------- watches + alerts ----------
const watches = new Map();   // region_id → { region_id, name, reason, by, since }
const alerts = [];           // newest first, capped
const alerted = new Map();   // cluster key → time (no repeat alert for the same 10 km cell within 24 h)
const sse = new Set();

function startWatch(region_id, reason, by = 'agent') {
  const r = REGIONS.find((x) => x.region_id === region_id);
  if (!r) return null;
  if (!watches.has(region_id)) {
    watches.set(region_id, { region_id, name: r.name_en, reason, by, since: new Date().toISOString() });
    log('watch', `Watch started on ${r.name_en} by the ${by}: ${reason}. From now on every new NASA detection there is checked.`, { region_id });
  }
  return watches.get(region_id);
}

function clusters(points) {
  const m = new Map();
  for (const p of points) {
    const key = `${p.region}|${Math.floor(p.lat / CLUSTER_DEG)}|${Math.floor(p.lon / CLUSTER_DEG)}`;
    const c = m.get(key) ?? { key, region: p.region, pts: [] };
    c.pts.push(p);
    m.set(key, c);
  }
  return [...m.values()].map((c) => {
    const frp = c.pts.reduce((s, p) => s + p.frp, 0);
    const last = c.pts.reduce((a, p) => (`${p.date}${p.time}` > `${a.date}${a.time}` ? p : a));
    const lat = c.pts.reduce((s, p) => s + p.lat, 0) / c.pts.length;
    const lon = c.pts.reduce((s, p) => s + p.lon, 0) / c.pts.length;
    const confirmed = c.pts.length >= 2 || c.pts.some((p) => p.frp >= STRONG_FRP);
    return { ...c, n: c.pts.length, frp, last, lat, lon, confirmed, sats: [...new Set(c.pts.map((p) => p.sat))] };
  });
}

async function dispatch(alert) {
  alerts.unshift(alert);
  alerts.length = Math.min(alerts.length, 200);
  const msg = `data: ${JSON.stringify(alert)}\n\n`;
  for (const res of sse) res.write(msg);
  log('alert', `ALERT → ${alert.contact ?? 'fire service'}: ${alert.severity} fire in ${alert.area}, ${alert.detections} detections, ${fmt(alert.frp_mw)} MW, at ${alert.lat}, ${alert.lon}, seen ${alert.observed}. Sent to the console.`, { region_id: alert.region_id, alert_id: alert.id });
  if (!WEBHOOK) return;
  try {
    const r = await fetch(WEBHOOK, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(alert) });
    alert.channels.push(r.ok ? 'webhook' : `webhook failed (${r.status})`);
    log('alert', `Webhook delivery for ${alert.area}: ${r.ok ? 'delivered' : `failed (HTTP ${r.status})`}.`, { region_id: alert.region_id });
  } catch (e) { alert.channels.push(`webhook failed (${e.message})`); }
}

async function runWatch() {
  // the agent "senses" risk on its own too: any country whose last 7 days are above usual is watched
  for (const s of live.status) if (s.level && ELEVATED.has(s.level)) startWatch(s.region_id, `Last 7 days: ${s.n} detections vs usual ${s.usual} (${s.level})`, 'agent');
  const dayAgo = Date.now() - 864e5;
  for (const [k, t] of alerted) if (t < dayAgo) alerted.delete(k);
  const stamp = (p) => `${p.date}${p.time}`;
  for (const w of watches.values()) {
    const pts = live.viirs.filter((p) => p.region === w.region_id);
    // first run of a watch: the strongest fires burning now; after that, only detections newer than the last check
    const first = !w.seenUntil;
    const newer = first ? pts : pts.filter((p) => stamp(p) > w.seenUntil);
    const cells = clusters(newer);
    const confirmed = cells.filter((c) => c.confirmed);
    const fresh = confirmed.filter((c) => !alerted.has(c.key)).sort((a, b) => b.frp - a.frp).slice(0, MAX_ALERTS_PER_RUN);
    const hhmm = (s) => `${s.slice(0, 10)} ${s.slice(10, 12)}:${s.slice(12, 14)} UTC`;   // stamp = "YYYY-MM-DD" + "HHMM"
    log('check', `${w.name}: ${fmt(pts.length)} VIIRS detections in the last 24 h${first ? '' : `, ${fmt(newer.length)} newer than the last check (${hhmm(w.seenUntil)})`} → ${fmt(cells.length)} cells of ~10 km → ${fmt(confirmed.length)} confirmed fires (≥ 2 detections or ≥ ${STRONG_FRP} MW) → ${fresh.length ? `sending the ${fresh.length} strongest to the fire service` : 'nothing new to send'}`, { region_id: w.region_id });
    if (pts.length) w.seenUntil = pts.reduce((m, p) => (stamp(p) > m ? stamp(p) : m), w.seenUntil ?? '');
    for (const c of fresh) {
      alerted.set(c.key, Date.now());
      const severity = c.frp >= 100 || c.n >= 10 ? 'Severe' : c.frp >= STRONG_FRP || c.n >= 3 ? 'Moderate' : 'Minor';
      await dispatch({
        id: `${c.key}|${c.last.date}${c.last.time}`,
        sent: new Date().toISOString(),
        // CAP 1.2-style fields, so a real fire-service system could ingest it as is
        msgType: 'Alert', status: 'Actual', category: 'Fire', event: 'Active fire detected by satellite',
        urgency: 'Immediate', certainty: c.n >= 2 ? 'Likely' : 'Possible', severity,
        region_id: w.region_id, area: w.name,
        lat: +c.lat.toFixed(4), lon: +c.lon.toFixed(4),
        detections: c.n, frp_mw: +c.frp.toFixed(1), satellites: c.sats,
        observed: `${c.last.date} ${c.last.time.slice(0, 2)}:${c.last.time.slice(2)} UTC`,
        source: 'NASA FIRMS VIIRS near-real-time (NOAA-20 / NOAA-21, 375 m)',
        contact: EMERGENCY[w.region_id] ?? null,
        map: `https://firms.modaps.eosdis.nasa.gov/map/#d:24hrs;@${c.lon.toFixed(3)},${c.lat.toFixed(3)},11z`,
        watch_reason: w.reason,
        channels: ['console'],
      });
    }
  }
}

let running = null;
/** One read of NASA FIRMS + one watch pass; concurrent callers share the same run. */
function cycle() {
  running ??= (async () => {
    log('cycle', 'Agent cycle: reading the NASA FIRMS near-real-time feeds');
    try { await refreshLive(); } catch (e) { live.error = String(e.message ?? e); log('error', live.error); }
    try { await runWatch(); } catch (e) { console.error('watch', e); }
    log('cycle', `Cycle done: ${watches.size} countr${watches.size === 1 ? 'y' : 'ies'} on watch, ${alerts.length} alerts sent so far. Next read in ${WATCH_MIN} min.`);
    console.log(`[${new Date().toISOString()}] live: ${live.modis.length} MODIS 7d, ${live.viirs.length} VIIRS 24h, ${watches.size} watches, ${alerts.length} alerts${live.error ? ` (${live.error})` : ''}`);
  })().finally(() => { running = null; });
  return running;
}

// ---------- agent ----------
function annualTable(region_id, sensor = 'MODIS') {
  const rows = anomalies.filter((a) => a.region_id === region_id && a.sensor === sensor);
  const years = [...new Set(rows.map((a) => a.year))].sort();
  const totals = years.map((y) => rows.filter((a) => a.year === y).reduce((s, a) => s + a.n, 0));
  return years.map((y, i) => {
    const others = totals.filter((_, j) => j !== i);
    const usual = Math.round(quantile(others, 0.5));
    const z = robustZ(totals[i], others);
    return { year: y, n: totals[i], usual, pct: usual ? Math.round(100 * (totals[i] - usual) / usual) : null, level: levelFromZ(z, totals[i], usual) };
  });
}
function monthlyLines(region_id) {
  return anomalies
    .filter((a) => a.region_id === region_id && a.sensor === 'MODIS')
    .sort((a, b) => a.year - b.year || a.month - b.month)
    .map((a) => {
      const c = context.find((x) => x.region_id === region_id && x.year === a.year && x.month === a.month);
      const w = c ? ` | temp ${c.t2m_anom >= 0 ? '+' : ''}${c.t2m_anom ?? '?'}°C vs usual, rain ${c.precip_anom_pct ?? '?'}% vs usual` : '';
      return `${a.year}-${String(a.month).padStart(2, '0')}: ${a.n} detections (usual ${a.median}) → ${a.level}${w}`;
    });
}
function seasonOf(region_id) {
  const cum = cumulative[region_id];
  if (!cum) return null;
  const share = Array(12).fill(0);
  const rows = anomalies.filter((a) => a.region_id === region_id && a.sensor === 'MODIS');
  const tot = rows.reduce((s, a) => s + a.n, 0) || 1;
  for (const a of rows) share[a.month - 1] += a.n / tot;
  const order = share.map((s, i) => [s, i]).sort((a, b) => b[0] - a[0]);
  let acc = 0; const months = [];
  for (const [s, i] of order) { if (acc >= 0.7) break; acc += s; months.push(i); }
  return { peak: MONTHS[order[0][1]], months: months.sort((a, b) => a - b).map((i) => MONTHS[i]), share: Math.round(acc * 100) };
}

function findRegion(text, fallback) {
  const t = (text || '').toLowerCase();
  const hit = REGIONS.find((r) => [r.name_en, r.name_fr, r.name_ar, r.region_id].some((n) => n && t.includes(String(n).toLowerCase())));
  return hit?.region_id ?? fallback ?? null;
}

const SAFETY = [
  'Do not burn waste, stubble or brush, and do not light fires outdoors.',
  'Report smoke or flames at once to the emergency number.',
  'Know two ways out of your area. Keep a bag ready: water, medicines, documents, phone charger.',
  'Clear dry leaves and brush from around buildings.',
  'If the authorities tell you to leave, leave early.',
];
function fallbackAnswer(focus, question) {
  const r = REGIONS.find((x) => x.region_id === focus);
  if (!r) return `I cover ${REGIONS.map((x) => x.name_en).join(', ')}. Ask about one of them, for example "Is Morocco burning right now?"`;
  const q = question.toLowerCase();
  const st = live.status.find((x) => x.region_id === focus);
  const yearAsked = Number((q.match(/\b(20\d\d)\b/) || [])[1]);
  const out = [];
  if (yearAsked) {
    const y = annualTable(focus).find((a) => a.year === yearAsked);
    out.push(y ? `${r.name_en} ${y.year}: ${y.n} NASA FIRMS MODIS detections, usual ${y.usual} (${y.pct >= 0 ? '+' : ''}${y.pct}%). Level: ${y.level}.` : `I have no ${yearAsked} data for ${r.name_en}.`);
  }
  if (!yearAsked || /now|today|week|live/.test(q)) {
    out.push(st ? `Last 7 days (NASA FIRMS live): ${st.n} detections in ${r.name_en}, usual for these days ${st.usual ?? 'unknown'}. Level: ${st.level ?? 'unknown'}. Last 24 h: ${st.viirs24h} VIIRS detections.` : 'The live NASA feed is not loaded yet.');
  }
  if (watches.has(focus)) out.push(`Watch is on: the alert service checks new NASA detections every ${WATCH_MIN} minutes and notifies the fire service when a fire is confirmed.`);
  if (/do|safe|help|advice/.test(q)) out.push(`What to do (general guidance): ${SAFETY.slice(0, 3).join(' ')} Emergency: ${EMERGENCY[focus]}.`);
  return out.join(' ');
}

// ---------- agent: DeepSeek (any OpenAI-compatible model) talking with people, using tools over the NASA data ----------
const COUNTRIES = REGIONS.map((r) => r.name_en);
function regionByName(name) {
  const t = String(name ?? '').toLowerCase().trim();
  if (!t) return null;
  const names = (r) => [r.name_en, r.name_fr, r.name_ar, r.region_id].filter(Boolean).map((n) => String(n).toLowerCase());
  return REGIONS.find((r) => names(r).includes(t)) ?? REGIONS.find((r) => names(r).some((n) => t.includes(n) || n.includes(t))) ?? null;
}

const TOOLS = [
  {
    name: 'get_live_status',
    description: 'NASA FIRMS near-real-time fire detections right now: the last 7 complete days compared with the usual level for the same calendar days in the 2020-2025 archive, plus the last 24 h of VIIRS detections. Omit country to get all countries.',
    parameters: { type: 'object', properties: { country: { type: 'string', enum: COUNTRIES } } },
  },
  {
    name: 'get_history',
    description: 'NASA FIRMS archive 2020-2025 for one country. Without year: yearly totals vs usual. With year: that year month by month (level + NASA POWER weather). With year and month: that month in detail.',
    parameters: { type: 'object', properties: { country: { type: 'string', enum: COUNTRIES }, year: { type: 'integer' }, month: { type: 'integer', minimum: 1, maximum: 12 } }, required: ['country'] },
  },
  {
    name: 'get_fire_season',
    description: 'When a country usually burns: the months that hold most detections, the peak month, and whether the current month is inside the season.',
    parameters: { type: 'object', properties: { country: { type: 'string', enum: COUNTRIES } }, required: ['country'] },
  },
  {
    name: 'start_watch',
    description: 'Put a country on live watch. The alert service re-reads NASA FIRMS now and every few minutes, confirms new fires (2+ detections, or one of 20 MW or more, in a ~10 km cell) and sends them to the fire-service console. Use it when someone reports smoke or fire, when the risk is above usual and the person agrees, or when asked.',
    parameters: { type: 'object', properties: { country: { type: 'string', enum: COUNTRIES }, reason: { type: 'string', description: 'short reason, in English' } }, required: ['country', 'reason'] },
  },
  {
    name: 'stop_watch',
    description: 'Stop the live watch on a country.',
    parameters: { type: 'object', properties: { country: { type: 'string', enum: COUNTRIES } }, required: ['country'] },
  },
  {
    name: 'get_alerts',
    description: 'Fire alerts already sent to the fire service (newest first) and the current watch list.',
    parameters: { type: 'object', properties: { country: { type: 'string', enum: COUNTRIES }, limit: { type: 'integer' } } },
  },
  {
    name: 'get_safety_advice',
    description: 'General wildfire safety guidance (not NASA data) and the emergency number of a country.',
    parameters: { type: 'object', properties: { country: { type: 'string', enum: COUNTRIES } } },
  },
];

function liveRow(s) {
  return {
    country: s.name, window: `${s.dates[0]} to ${s.dates.at(-1)}`,
    modis_detections_last_7_days: s.n, usual_for_these_7_days: s.usual, archive_years_compared: s.refYears, level: s.level,
    detections_per_day: s.perDay, viirs_detections_last_24h: s.viirs24h, strong_viirs_fires_last_24h: s.viirsStrong24h,
    on_watch: watches.has(s.region_id), emergency_number: EMERGENCY[s.region_id] ?? null,
  };
}
const alertRow = (a) => ({ country: a.area, sent: a.sent, severity: a.severity, detections: a.detections, fire_power_mw: a.frp_mw, lat: a.lat, lon: a.lon, seen: a.observed, call: a.contact });

async function runTool(name, args, actions) {
  const r = args.country ? regionByName(args.country) : null;
  if (args.country && !r) return { error: `Not covered. NIRAN covers ${COUNTRIES.join(', ')}.` };
  const src = 'NASA FIRMS';
  switch (name) {
    case 'get_live_status': {
      if (!live.updated) return { error: `The live NASA feed is not loaded yet${live.error ? `: ${live.error}` : ''}.` };
      const rows = live.status.filter((s) => !r || s.region_id === r.region_id).map(liveRow);
      return { source: `${src} near-real-time (MODIS 7 days, VIIRS 24 h)`, read_at: live.updated, countries: rows };
    }
    case 'get_history': {
      if (!r) return { error: 'country required' };
      const yearly = annualTable(r.region_id);
      if (!args.year) return { source: `${src} archive, MODIS, ${meta.first_year}-${meta.last_year}`, country: r.name_en, yearly, note: 'usual = median of the other years' };
      const rows = anomalies.filter((a) => a.region_id === r.region_id && a.year === args.year && (!args.month || a.month === args.month));
      if (!rows.length) return { error: `No data for ${r.name_en} ${args.year}${args.month ? `-${args.month}` : ''}. Archive covers ${meta.first_year}-${meta.last_year}.` };
      const months = rows.filter((a) => a.sensor === 'MODIS').sort((x, y) => x.month - y.month).map((a) => {
        const c = context.find((x) => x.region_id === r.region_id && x.year === a.year && x.month === a.month);
        const v = rows.find((x) => x.sensor === 'VIIRS' && x.month === a.month);
        return {
          month: `${a.year}-${String(a.month).padStart(2, '0')}`, modis_detections: a.n, usual_same_month: a.median, level: a.level,
          viirs_detections: v?.n, viirs_level: v?.level,
          temperature_vs_usual_c: c?.t2m_anom ?? null, rain_vs_usual_pct: c?.precip_anom_pct ?? null, humidity_pct: c?.rh_mean ?? null, wind_ms: c?.wind_mean ?? null,
          what_burned: c?.landcover ?? null,
        };
      });
      return { source: `${src} archive + NASA POWER weather + MODIS land cover`, country: r.name_en, year_total: yearly.find((y) => y.year === args.year), months };
    }
    case 'get_fire_season': {
      if (!r) return { error: 'country required' };
      const s = seasonOf(r.region_id);
      const now = MONTHS[new Date().getUTCMonth()];
      return { source: `${src} archive`, country: r.name_en, season_months: s.months, share_of_year_pct: s.share, peak_month: s.peak, current_month: now, in_season_now: s.months.includes(now) };
    }
    case 'start_watch': {
      if (!r) return { error: 'country required' };
      const was = watches.has(r.region_id);
      const w = startWatch(r.region_id, args.reason || 'Requested in chat', 'agent');
      if (!was) actions.push({ type: 'watch', region_id: r.region_id, name: w.name, reason: w.reason });
      const before = alerts.length;
      await Promise.race([cycle(), new Promise((ok) => setTimeout(ok, 25000))]);
      const check = [...logs].reverse().find((l) => l.kind === 'check' && l.region_id === r.region_id);
      const sent = alerts.slice(0, Math.max(0, alerts.length - before)).filter((a) => a.region_id === r.region_id).map(alertRow);
      return { watching: true, already_on: was, since: w.since, checks_every_minutes: WATCH_MIN, first_check: check?.text ?? 'running', alerts_sent_now: sent, where_alerts_go: 'fire-service console (+ webhook when set)' };
    }
    case 'stop_watch': {
      if (!r) return { error: 'country required' };
      const was = watches.delete(r.region_id);
      if (was) { log('watch', `Watch stopped on ${r.name_en} (asked in chat).`, { region_id: r.region_id }); actions.push({ type: 'unwatch', region_id: r.region_id, name: r.name_en, reason: 'asked in chat' }); }
      return { stopped: was };
    }
    case 'get_alerts': {
      const list = alerts.filter((a) => !r || a.region_id === r.region_id).slice(0, Math.min(args.limit || 5, 10)).map(alertRow);
      return { alerts: list, total_sent: alerts.length, watch_list: [...watches.values()].map((w) => ({ country: w.name, since: w.since, reason: w.reason })) };
    }
    case 'get_safety_advice':
      return { note: 'General wildfire guidance, not NASA data. Local authorities come first.', advice: SAFETY, emergency_number: r ? EMERGENCY[r.region_id] : EMERGENCY };
    default:
      return { error: `unknown tool ${name}` };
  }
}

const STEP_LABEL = {
  get_live_status: (a) => `Checked NASA live data${a.country ? ` · ${a.country}` : ''}`,
  get_history: (a) => `Read the 2020–2025 archive · ${a.country}${a.year ? ` ${a.year}` : ''}${a.month ? `-${String(a.month).padStart(2, '0')}` : ''}`,
  get_fire_season: (a) => `Looked up the fire season · ${a.country}`,
  start_watch: (a) => `Started live watch · ${a.country}`,
  stop_watch: (a) => `Stopped watch · ${a.country}`,
  get_alerts: (a) => `Checked alerts sent${a.country ? ` · ${a.country}` : ''}`,
  get_safety_advice: (a) => `Safety guidance${a.country ? ` · ${a.country}` : ''}`,
};

const SYSTEM = `You are NIRAN, a wildfire-safety companion built by a NASA Space Apps team. You talk with residents, farmers, journalists and fire officers about wildfires in ${COUNTRIES.join(', ')}, using NASA satellite data through your tools.

How you talk:
- Like a calm, caring person who knows fires well: natural sentences, warm and direct. Not a report, no headings.
- Usually 2 to 5 sentences. Use a short list only for steps someone should follow.
- Answer what was asked first. Then, when it helps, ask ONE follow-up question or offer ONE next step (for example: "Do you want me to keep watch on Morocco and alert the fire service if a new fire is confirmed?").
- Remember the whole conversation. Do not repeat what you already said.
- Greetings and small talk: answer naturally and say in one line what you can do.
- Reply in the language the user writes in (English, French, Arabic, Portuguese...).
- Put numbers in plain words ("about twice the usual for this week") and give the figure once.

Facts:
- Every number comes from a tool call. Never invent numbers, places, dates or fires. If the tools do not have it, say so simply.
- You cover ${COUNTRIES.join(', ')} at country level. You cannot see a street or a town. For other places, say so kindly and point to the local authorities.
- Satellite detections are hot spots seen a few times a day (MODIS ~1 km, VIIRS 375 m). Clouds and smoke hide fires; farm burning and industry also show up. Mention a limit only when it matters to the answer.
- You do not forecast. Say what the data shows, not what will happen.
- Name the source in passing ("NASA's live satellite data", "the 2020–2025 NASA archive").

Safety first:
- If someone sees smoke or flames, or feels in danger: first tell them to call the emergency number now and move away from the fire (get the number with get_safety_advice), then start a watch on that country.
- Safety tips are general guidance, not NASA data: say it once.

Actions:
- You can start or stop a live watch. Offer it when the risk is above usual or someone is worried; start it when they agree or ask, or at once if someone reports a fire. After starting, say what the first check found and that confirmed fires go to the fire-service console.
- A watch covers the whole country, not one village: never promise to watch "your area" or "near you". If someone wants their exact place watched, say that is the next step of the project (local zones) and the emergency number is the fastest way today.`;

async function llm(messages) {
  if (!LLM.key) throw new Error('no LLM key');
  const ctl = new AbortController();
  const t = setTimeout(() => ctl.abort(), 60000);
  try {
    const r = await fetch(`${LLM.base}/chat/completions`, {
      method: 'POST', signal: ctl.signal,
      headers: { 'content-type': 'application/json', authorization: `Bearer ${LLM.key}` },
      body: JSON.stringify({ model: LLM.model, max_tokens: 1500, messages, tools: TOOLS.map((f) => ({ type: 'function', function: f })) }),
    });
    if (!r.ok) throw new Error(`LLM HTTP ${r.status}: ${(await r.text()).slice(0, 300)}`);
    const j = await r.json();
    return j.choices?.[0]?.message ?? {};
  } finally { clearTimeout(t); }
}

async function chat({ messages = [], regionId = null }) {
  const clean = messages.filter((m) => (m.role === 'user' || m.role === 'assistant') && typeof m.content === 'string' && m.content.trim())
    .map((m) => ({ role: m.role, content: m.content.slice(0, 4000) })).slice(-20);
  const question = clean.filter((m) => m.role === 'user').at(-1)?.content ?? '';
  const page = REGIONS.find((r) => r.region_id === regionId);
  const context = `Today is ${new Date().toISOString().slice(0, 10)} (UTC).${page ? ` The user has ${page.name_en} open on the NIRAN globe.` : ''} Watches on: ${[...watches.values()].map((w) => w.name).join(', ') || 'none'}.`;
  const convo = [{ role: 'system', content: `${SYSTEM}\n\n${context}` }, ...clean];
  const actions = [], steps = [];
  let reply = '', engine = LLM.model;
  try {
    for (let turn = 0; turn < 6 && !reply; turn++) {
      const msg = await llm(convo);
      if (msg.tool_calls?.length) {
        convo.push({ role: 'assistant', content: msg.content ?? '', reasoning_content: msg.reasoning_content, tool_calls: msg.tool_calls });
        for (const tc of msg.tool_calls) {
          let args = {};
          try { args = JSON.parse(tc.function?.arguments || '{}'); } catch { /* model sent bad JSON: run with no args */ }
          const name = tc.function?.name;
          const result = await runTool(name, args, actions).catch((e) => ({ error: String(e.message ?? e) }));
          steps.push(STEP_LABEL[name]?.(args) ?? name);
          convo.push({ role: 'tool', tool_call_id: tc.id, content: JSON.stringify(result) });
        }
        continue;
      }
      reply = (msg.content ?? '').trim();
    }
  } catch (e) {
    console.error('agent', e.message);
    engine = `template (${e.message})`;
  }
  if (!reply) {
    reply = fallbackAnswer(findRegion(question, regionId), question);
    if (!engine.startsWith('template')) engine = 'template (no answer)';
  }
  return { reply, regionId: findRegion(question, regionId), actions, steps, engine, live_updated: live.updated };
}

// ---------- http ----------
const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.svg': 'image/svg+xml', '.png': 'image/png', '.geojson': 'application/geo+json', '.ico': 'image/x-icon', '.woff2': 'font/woff2' };
const send = (res, code, obj) => { res.writeHead(code, { 'content-type': 'application/json', 'cache-control': 'no-store' }); res.end(JSON.stringify(obj)); };
async function body(req) {
  let s = '';
  for await (const ch of req) { s += ch; if (s.length > 64e3) throw new Error('body too large'); }
  return s ? JSON.parse(s) : {};
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, 'http://x');
  const p = url.pathname;
  try {
    if (p === '/api/health') return send(res, 200, { ok: true, live_updated: live.updated, llm: LLM.key ? LLM.model : null, webhook: !!WEBHOOK });
    if (p === '/api/live') return send(res, 200, { updated: live.updated, error: live.error, regions: live.status, sources: FEEDS });
    if (p === '/api/chat' && req.method === 'POST') return send(res, 200, await chat(await body(req)));
    if (p === '/api/watches' && req.method === 'GET') return send(res, 200, [...watches.values()]);
    if (p === '/api/watches' && req.method === 'POST') {
      const { region_id } = await body(req);
      const w = startWatch(region_id, 'Started from the console', 'operator');
      if (!w) return send(res, 400, { error: 'unknown region' });
      cycle();   // fresh read of NASA FIRMS, streamed step by step to the activity log
      return send(res, 200, w);
    }
    if (p.startsWith('/api/watches/') && req.method === 'DELETE') {
      const id = decodeURIComponent(p.split('/').pop());
      const w = watches.get(id);
      if (w) { watches.delete(id); log('watch', `Watch stopped on ${w.name}.`, { region_id: id }); }
      return send(res, 200, { ok: true });
    }
    if (p === '/api/log') return send(res, 200, logs);
    if (p === '/api/alerts') return send(res, 200, alerts);
    if (p === '/api/alerts/stream') {
      res.writeHead(200, { 'content-type': 'text/event-stream', 'cache-control': 'no-cache', connection: 'keep-alive' });
      res.write(': ok\n\n');
      sse.add(res);
      const ping = setInterval(() => res.write(': ping\n\n'), 25000);
      req.on('close', () => { clearInterval(ping); sse.delete(res); });
      return;
    }
    if (p.startsWith('/api/')) return send(res, 404, { error: 'not found' });

    // static site
    let file = path.normalize(path.join(DIST, decodeURIComponent(p)));
    if (!file.startsWith(DIST)) return send(res, 403, { error: 'forbidden' });
    if (!fs.existsSync(file) || fs.statSync(file).isDirectory()) file = path.join(DIST, 'index.html');
    if (!fs.existsSync(file)) return send(res, 404, { error: 'site not built: run npm run build in web/' });
    res.writeHead(200, { 'content-type': TYPES[path.extname(file)] ?? 'application/octet-stream', 'cache-control': p.includes('/assets/') ? 'public, max-age=31536000, immutable' : 'no-cache' });
    fs.createReadStream(file).pipe(res);
  } catch (e) {
    console.error(e);
    send(res, 500, { error: String(e.message ?? e) });
  }
});

server.listen(PORT, () => {
  console.log(`NIRAN server on :${PORT} — data ${DATA}, LLM ${LLM.key ? `${LLM.model} @ ${LLM.base}` : 'off (template answers)'}, webhook ${WEBHOOK ? 'on' : 'off'}`);
  cycle();
  setInterval(cycle, WATCH_MIN * 60e3);
});
