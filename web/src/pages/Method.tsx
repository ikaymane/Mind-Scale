import { useEffect, useMemo, useRef, useState } from 'react';
import { useT } from '../i18n';
import { useApp } from '../store';
import { regionName, useSensor, type Dataset } from '../lib/data';
import { availableYears, computeVerdict } from '../lib/stats';
import { seasonOf } from '../lib/season';
import { verdictText } from '../lib/sentence';
import { LEVEL_STYLE } from '../levels';
import { LevelBadge, LevelLegend } from '../components/Level';
import { SensorSwitch } from '../components/Header';

interface Section { title: string; body: string[]; levels?: boolean; cleaning?: boolean; after?: string[] }
interface Source { name: string; detail: string; url: string }
interface Step { name: string; line: string }

const STEP_MS = 2600;
/** Dot grid per sensor: VIIRS pixels are finer than MODIS pixels, so its grid is finer too. */
const GRID = { MODIS: { cols: 20, rows: 7 }, VIIRS: { cols: 32, rows: 11 } } as const;

/** The five stages, as line icons. */
const ICONS = [
  // satellite
  <g key="0" transform="rotate(-45 12 12)"><rect x="9.5" y="8" width="5" height="8" rx="1" /><path d="M9.5 12H7M14.5 12H17" /><rect x="2" y="9.5" width="5" height="5" /><rect x="17" y="9.5" width="5" height="5" /><path d="M12 16v2.5M9.5 21a2.5 2.5 0 0 1 5 0" /></g>,
  // filter
  <path key="1" d="M4 5h16l-6 7.5V19l-4-2v-4.5z" />,
  // same month, other years
  <g key="2"><path d="M5 19v-7M10 19V7M15 19v-9M20 19v-5" /><path d="M3 10h18" strokeDasharray="2 3" /></g>,
  // level
  <g key="3"><path d="M4 17a8 8 0 0 1 16 0" /><path d="m12 17 4-5.5" /><path d="M12 17h.01" strokeWidth="3" /></g>,
  // one sentence
  <g key="4"><path d="M6 3.5h8.5L19 8v12.5H6z" /><path d="M14.5 3.5V8H19M9 13h7M9 16.5h4.5" /></g>,
];

/** Deterministic shuffle, so a country always drops the same dots. */
function order(seed: string, n: number): number[] {
  let h = 2166136261;
  for (const c of seed) h = Math.imul(h ^ c.charCodeAt(0), 16777619);
  const idx = Array.from({ length: n }, (_, i) => i);
  for (let i = n - 1; i > 0; i--) {
    h = Math.imul(h ^ (h >>> 15), 2246822507) + 0x9e3779b9;
    const j = Math.abs(h) % (i + 1);
    [idx[i], idx[j]] = [idx[j], idx[i]];
  }
  return idx;
}

/** Smooth closed area through 12 monthly values. */
function areaPath(values: number[], w: number, h: number): { area: string; line: string } {
  const max = Math.max(...values, 1e-9);
  const pts = values.map((v, i) => [(i + 0.5) * (w / 12), h - 4 - (v / max) * (h - 12)] as const);
  let d = `M${pts[0][0]},${pts[0][1]}`;
  for (let i = 1; i < pts.length; i++) {
    const [x0, y0] = pts[i - 1], [x1, y1] = pts[i];
    const mx = (x0 + x1) / 2;
    d += ` C${mx},${y0} ${mx},${y1} ${x1},${y1}`;
  }
  return { line: d, area: `${d} L${pts[11][0]},${h} L${pts[0][0]},${h} Z` };
}

export function Method({ data }: { data: Dataset }) {
  const tt = useT();
  const set = useApp((s) => s.set);
  const SENSOR = useSensor(data);
  const steps = tt.tv<Step[]>('method.steps');
  const sections = tt.tv<Section[]>('method.sections');
  const cleaningCols = tt.tv<string[]>('method.cleaningCols');
  const still = useMemo(() => matchMedia('(prefers-reduced-motion: reduce)').matches, []);

  const [ci, setCi] = useState(0);
  const [step, setStep] = useState(still ? 4 : 0);
  const [playing, setPlaying] = useState(!still);
  const region = data.regions[ci % Math.max(1, data.regions.length)];
  const { cols: COLS, rows } = GRID[SENSOR];
  const DOTS = COLS * rows;

  // a new sensor restarts the film from the satellite
  const firstSensor = useRef(SENSOR);
  useEffect(() => {
    if (firstSensor.current === SENSOR) return;
    firstSensor.current = SENSOR;
    setStep(still ? 4 : 0);
    setPlaying(!still);
  }, [SENSOR, still]);

  // the film: five beats per country, then the next country
  useEffect(() => {
    if (!playing) return;
    const t = setTimeout(() => {
      if (step < 4) setStep(step + 1);
      else { setStep(0); setCi((c) => (c + 1) % data.regions.length); }
    }, step === 4 ? STEP_MS * 1.6 : STEP_MS);
    return () => clearTimeout(t);
  }, [playing, step, ci, data.regions.length]);

  const years = useMemo(() => availableYears(data, SENSOR), [data, SENSOR]);
  const view = useMemo(() => {
    if (!region) return null;
    const id = region.region_id;
    const clean = data.meta.cleaning?.[SENSOR]?.[region.country];
    // dots dropped at each cleaning step, in proportion to the real file
    const raw = clean?.steps[0]?.[1] ?? 0;
    const drops = clean && raw > 0
      ? clean.steps.slice(1).map(([key, n], i) => { const gone = clean.steps[i][1] - n; return { key, dots: gone > 0 ? Math.max(1, Math.round((DOTS * gone) / raw)) : 0 }; })
      : [];
    const shuffled = order(id + SENSOR, DOTS);
    const dropOf = new Map<number, number>();
    let k = 0;
    drops.forEach((d, si) => { for (let j = 0; j < d.dots && k < DOTS; j++) dropOf.set(shuffled[k++], si); });
    const season = seasonOf(data, id, SENSOR);
    const rows = data.bySeries.get(`${id}|${SENSOR}`) ?? [];
    const top = rows.reduce<typeof rows[number] | null>((a, b) => (!a || b.z > a.z ? b : a), null);
    const verdict = top ? computeVerdict(data, id, SENSOR, top.year, top.month) : null;
    return { id, drops, dropOf, season, top, verdict };
  }, [data, region, SENSOR, DOTS]);

  if (!region || !view) return <main className="method" id="main"><p className="state">{tt.t('bulletin.noData')}</p></main>;
  const curve = view.season ? areaPath(view.season.share, 240, 96) : null;
  const pick = (i: number) => { setPlaying(false); setStep(i); };
  const cleaning = data.meta.cleaning ?? {};

  return (
    <main className={`method ${playing ? 'is-playing' : ''}`} id="main">
      <section className="m-stage" aria-labelledby="m-title">
        <p className="eyebrow">{tt.t('nav.method')}</p>
        <h1 id="m-title">{tt.t('method.title')}</h1>

        <ol className="pipe" key={SENSOR}>
          {steps.map((s, i) => (
            <li key={s.name} className={`pipe-node ${i === step ? 'is-on' : i < step ? 'is-done' : ''}`}>
              <button onClick={() => pick(i)} aria-current={i === step ? 'step' : undefined}>
                <span className="pipe-icon">
                  <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{ICONS[i]}</svg>
                </span>
                <span className="pipe-name">{s.name}</span>
              </button>
            </li>
          ))}
        </ol>
        <p className="m-caption" key={`${SENSOR}${step}`} aria-live="polite">{steps[step]?.line}</p>
      </section>

      <section className="m-country" aria-label={regionName(region)}>
        <header className="m-bar">
          <div className="m-tabs" role="tablist">
            {data.regions.map((r, i) => (
              <button key={r.region_id} role="tab" aria-selected={i === ci} className={i === ci ? 'is-on' : ''} onClick={() => { setCi(i); setStep(still ? 4 : 0); }}>
                {regionName(r)}
              </button>
            ))}
          </div>
          <span className="m-sensor mono" key={SENSOR}>{tt.t(`method.sensor.${SENSOR}`)}</span>
          <SensorSwitch sensors={data.meta.sensors ?? ['MODIS']} />
          <button className="tool-btn" onClick={() => setPlaying((p) => !p)} aria-label={tt.t(playing ? 'globe.pause' : 'method.play')} title={tt.t(playing ? 'globe.pause' : 'method.play')}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">{playing ? <path d="M6 4h4v16H6zM14 4h4v16h-4z" /> : <path d="M7 4.5v15l13-7.5z" />}</svg>
          </button>
        </header>

        <div className="m-frames" key={`${view.id}${SENSOR}`}>
          {/* 1–2 · every dot is a share of the raw file; hollow ones were removed */}
          <figure className={`m-frame ${step <= 1 ? 'is-on' : ''}`}>
            <figcaption><span className="mono">01–02</span>{tt.t('method.frameSift')}<small className="mono">{SENSOR}</small></figcaption>
            <div className={`m-dots is-${SENSOR} ${step >= 1 ? 'is-clean' : ''}`} style={{ gridTemplateColumns: `repeat(${COLS}, 1fr)` }} aria-hidden="true">
              {Array.from({ length: DOTS }, (_, i) => <i key={i} className={view.dropOf.has(i) ? `is-out out-${view.dropOf.get(i)}` : ''} style={{ animationDelay: `${(i % COLS) * 18 + Math.floor(i / COLS) * 30}ms` }} />)}
            </div>
            <ul className="m-key">
              <li><i className="k-kept" />{tt.t('method.kept')}</li>
              {view.drops.filter((d) => d.dots > 0).map((d) => <li key={d.key}><i className="k-out" />{tt.t(`cleaning.${d.key}`)}</li>)}
            </ul>
          </figure>

          {/* 3 · the typical year: when this country burns */}
          <figure className={`m-frame ${step === 2 ? 'is-on' : ''}`}>
            <figcaption><span className="mono">03</span>{tt.t('method.frameRhythm')}</figcaption>
            {curve && view.season && (
              <svg className="m-curve" viewBox="0 0 240 112" role="img" aria-label={tt.t('safety.seasonAxis')}>
                {view.season.months.map((m) => <rect key={m} x={(m - 1) * 20} y="0" width="20" height="96" className="m-band" />)}
                <path d={curve.area} className="m-area" />
                <path d={curve.line} className="m-line" pathLength={1} />
                {Array.from({ length: 12 }, (_, i) => <text key={i} x={i * 20 + 10} y="109" textAnchor="middle">{tt.monthShort(i + 1).slice(0, 1)}</text>)}
              </svg>
            )}
            <ul className="m-key"><li><i className="k-band" />{tt.t('method.season')}</li></ul>
          </figure>

          {/* 4 · every month of the record, coloured by its level */}
          <figure className={`m-frame ${step === 3 ? 'is-on' : ''}`}>
            <figcaption><span className="mono">04</span>{tt.t('method.frameLevels')}</figcaption>
            <div className="m-grid" role="img" aria-label={tt.t('method.frameLevels')}>
              {years.map((y, yi) => (
                <div key={y} className="m-row">
                  <span className="mono">{y}</span>
                  {Array.from({ length: 12 }, (_, m) => {
                    const a = data.anomalyIndex.get(`${view.id}|${SENSOR}|${y}|${m + 1}`);
                    return <i key={m} title={a ? `${tt.period(y, m + 1)} · ${tt.t(`level.${a.level}`)}` : undefined} style={{ background: a ? LEVEL_STYLE[a.level].fill : undefined, animationDelay: `${(yi * 12 + m) * 14}ms` }} />;
                  })}
                </div>
              ))}
            </div>
            <LevelLegend />
          </figure>

          {/* 5 · what the reader gets */}
          <figure className={`m-frame m-out ${step === 4 ? 'is-on' : ''}`}>
            <figcaption><span className="mono">05</span>{tt.t('method.frameSentence')}</figcaption>
            {view.top && view.verdict ? (
              <>
                <p className="m-where">{regionName(region)} · {tt.period(view.top.year, view.top.month)}</p>
                <LevelBadge level={view.verdict.level} size="lg" />
                <p className="m-sentence">{verdictText(tt, view.verdict, view.top.year, view.top.month).main}</p>
                <button className="text-btn" onClick={() => set({ page: 'app', regionId: view.id, year: view.top!.year, month: view.top!.month })}>
                  {tt.t('home.cta')} <span aria-hidden="true">→</span>
                </button>
              </>
            ) : <p className="muted">{tt.t('bulletin.noData')}</p>}
          </figure>
        </div>
      </section>

      <details className="m-details">
        <summary>{tt.t('method.more')}</summary>
        <div className="prose-page">
          {sections.map((s) => (
            <section key={s.title}>
              <h2>{s.title}</h2>
              {s.body.map((p, i) => <p key={i}>{p}</p>)}
              {s.levels && <LevelLegend long />}
              {s.cleaning && Object.keys(cleaning).length > 0 && (
                <div className="table-wrap">
                  <table className="data">
                    <caption>{tt.t('method.cleaningTitle')}</caption>
                    <thead><tr><th scope="col">{cleaningCols[0]}</th><th scope="col" className="num">{tt.t('cleaning.raw')}</th><th scope="col" className="num">{cleaningCols[1]}</th><th scope="col" className="num">{cleaningCols[2]}</th></tr></thead>
                    <tbody>
                      {Object.entries(cleaning).flatMap(([sensor, byIso]) => Object.entries(byIso ?? {}).map(([iso, c]) => {
                        const country = data.regions.find((r) => r.country === iso);
                        const raw = c.steps[0]?.[1] ?? 0, kept = c.steps[c.steps.length - 1]?.[1] ?? 0;
                        return (
                          <tr key={`${sensor}|${iso}`}>
                            <th scope="row">{country ? regionName(country) : iso} · {sensor}</th>
                            <td className="num">{tt.num(raw)}</td>
                            <td className="num">{tt.num(kept)}</td>
                            <td className="num">{raw > 0 ? `${tt.num(Math.round((1000 * (raw - kept)) / raw) / 10)} %` : '—'}</td>
                          </tr>
                        );
                      }))}
                    </tbody>
                  </table>
                </div>
              )}
              {s.after?.map((p, i) => <p key={`a${i}`}>{p}</p>)}
            </section>
          ))}
        </div>
      </details>

      <footer className="m-sources">
        {tt.tv<Source[]>('method.sources').map((s) => (
          <a key={s.name} href={s.url} target="_blank" rel="noreferrer" title={s.detail}>{s.name}</a>
        ))}
        <span>{tt.t('method.thanks')}</span>
      </footer>
    </main>
  );
}
