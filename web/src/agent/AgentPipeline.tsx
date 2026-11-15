/**
 * The agent's run as a pipeline: Read NASA → Sense → Watch → Confirm → Notify.
 * Built from the live activity log: the step that is working lights up, the link before it carries data,
 * each step shows the numbers of the latest run, and Notify turns red while alerts go out.
 * Click a step to open its details (Notify: the alerts sent, with place, time, evidence and who was called).
 */
import { useEffect, useState } from 'react';
import type { Alert, LogEntry, Watch } from '../lib/api';

type Status = 'waiting' | 'active' | 'done' | 'alert';
const STEP_OF: Partial<Record<LogEntry['kind'], number>> = { fetch: 0, sense: 1, watch: 2, check: 3, alert: 4 };
const fmt = (n: number) => n.toLocaleString('en');
const clock = (iso: string) => new Date(iso).toISOString().slice(11, 16);

const ICONS = [
  // satellite
  <g key="0"><rect x="9" y="9" width="6" height="6" rx="1" /><path d="M3 9h4v6H3zM17 9h4v6h-4zM12 15v3M9.5 21h5" /></g>,
  // gauge
  <g key="1"><path d="M4 16a8 8 0 0 1 16 0" /><path d="m12 16 4-4.5" /></g>,
  // eye
  <g key="2"><path d="M2 12s3.6-6 10-6 10 6 10 6-3.6 6-10 6S2 12 2 12z" /><circle cx="12" cy="12" r="2.6" /></g>,
  // target
  <g key="3"><circle cx="12" cy="12" r="8" /><circle cx="12" cy="12" r="3.5" /><path d="M12 2v3M12 19v3M2 12h3M19 12h3" /></g>,
  // bell
  <g key="4"><path d="M6 16V11a6 6 0 0 1 12 0v5l1.5 2h-15z" /><path d="M10 20.5a2 2 0 0 0 4 0" /></g>,
];

export function AgentPipeline({ logs, watches, alerts }: { logs: LogEntry[] | null | undefined; watches: Watch[] | null | undefined; alerts: Alert[] | null | undefined }) {
  const [, tick] = useState(0);
  const [open, setOpen] = useState<number | null>(null);
  useEffect(() => { const id = setInterval(() => tick((x) => x + 1), 1000); return () => clearInterval(id); }, []);

  const all = logs ?? [];
  let start = -1;
  for (let i = all.length - 1; i >= 0; i--) if (all[i].kind === 'cycle' && !all[i].text.startsWith('Cycle done')) { start = i; break; }
  const run = start >= 0 ? all.slice(start) : [];
  const last = run.at(-1);
  const busy = !!last && !(last.kind === 'cycle' && last.text.startsWith('Cycle done'));
  const activeIdx = busy ? Math.max(0, ...run.map((l) => STEP_OF[l.kind] ?? -1)) : -1;
  const recentAlert = run.some((l) => l.kind === 'alert' && l.text.startsWith('ALERT') && Date.now() - Date.parse(l.t) < 6000);

  // numbers of the latest run
  const feeds = run.filter((l) => l.kind === 'fetch' && l.kept !== undefined);
  const senses = run.filter((l) => l.kind === 'sense' && l.name);
  const checks = run.filter((l) => l.kind === 'check' && l.confirmed !== undefined);
  const sent = run.filter((l) => l.kind === 'alert' && l.text.startsWith('ALERT'));
  const watchList = watches ?? [];
  const runStart = run.length ? Date.parse(run[0].t) : Infinity;
  const runAlerts = (alerts ?? []).filter((a) => Date.parse(a.sent) >= runStart - 1000);
  const shownAlerts = runAlerts.length ? runAlerts : (alerts ?? []).slice(0, 3);
  const when = (iso: string) => new Date(iso).toISOString().slice(11, 19) + ' UTC';

  const more: React.ReactNode[] = [
    feeds.length ? feeds.map((l) => <p key={l.feed}><b>{l.feed}</b>: {fmt(l.worldwide ?? 0)} worldwide → {fmt(l.kept ?? 0)} in our countries</p>) : <p>No read yet.</p>,
    senses.length ? senses.map((l) => <p key={l.name}><b>{l.name}</b>: {fmt(l.n ?? 0)} detections in the last 7 days, usual {l.usual === null || l.usual === undefined ? '–' : fmt(l.usual)} → {l.level ?? '–'}</p>) : <p>No reading yet.</p>,
    watchList.length ? watchList.map((w) => <p key={w.region_id}><b>{w.name}</b> · by the {w.by} · since {when(w.since)}<br />{w.reason}</p>) : <p>The agent adds a country when its last 7 days go above usual, or when someone asks.</p>,
    checks.length ? checks.map((l) => <p key={l.name}>{l.text}</p>) : <p>Runs only for countries on watch.</p>,
    shownAlerts.length ? (
      <>
        {!runAlerts.length && <p className="pl-note">Nothing new this run. Latest alerts:</p>}
        {shownAlerts.map((a) => (
          <div key={a.id} className="pl-alert">
            <p><span className={`sev sev-${a.severity === 'Severe' ? 'extreme' : a.severity === 'Moderate' ? 'unusual' : 'high'}`}>{a.severity}</span> <b>{a.area}</b> · sent {when(a.sent)}</p>
            <p>{fmt(a.detections)} detection{a.detections > 1 ? 's' : ''}, {fmt(a.frp_mw)} MW · seen {a.observed}</p>
            <p>{a.lat.toFixed(3)}, {a.lon.toFixed(3)} · <a href={a.map} target="_blank" rel="noreferrer">open in NASA FIRMS</a></p>
            <p>Called: <b>{a.contact ?? '–'}</b> · via {a.channels.join(', ')}</p>
          </div>
        ))}
      </>
    ) : <p>No alert sent yet.</p>,
  ];

  const steps: { title: string; detail: React.ReactNode }[] = [
    {
      title: 'Read NASA FIRMS',
      detail: feeds.length
        ? <><b>{fmt(feeds.reduce((s, l) => s + (l.worldwide ?? 0), 0))}</b> detections worldwide · <b>{fmt(feeds.reduce((s, l) => s + (l.kept ?? 0), 0))}</b> in our countries <span className="pl-sub">{feeds.length} near-real-time feeds (MODIS 7 d, VIIRS 24 h)</span></>
        : 'MODIS 7 days + VIIRS 24 h, near-real-time',
    },
    {
      title: 'Sense: last 7 days vs usual',
      detail: senses.length
        ? <span className="pl-chips">{senses.map((l) => <span key={l.name} className={`pl-chip lv-${l.level ?? 'none'}`}>{l.name} <b>{l.level ?? '–'}</b></span>)}</span>
        : 'Compared with the same days, 2020–2025',
    },
    {
      title: 'Watch list',
      detail: watchList.length
        ? <span className="pl-chips">{watchList.map((w) => <span key={w.region_id} className="pl-chip is-watch">{w.name}</span>)}</span>
        : 'No country on watch',
    },
    {
      title: 'Confirm fires',
      detail: checks.length
        ? <>{checks.map((l) => (
            <span key={l.name} className="pl-line">
              <b>{l.name}</b>:{' '}
              {!l.first && !l.newer
                ? 'no new detection since the last check'
                : <>{fmt(l.first ? l.detections ?? 0 : l.newer ?? 0)} {l.first ? 'detections (24 h)' : 'new detections'} → {fmt(l.cells ?? 0)} cells → <b>{fmt(l.confirmed ?? 0)}</b> confirmed</>}
            </span>
          ))}</>
        : '2+ detections, or one ≥ 20 MW, in a ~10 km cell',
    },
    {
      title: 'Notify the fire service',
      detail: sent.length
        ? <>{sent.length} alert{sent.length > 1 ? 's' : ''} sent this run · {[...new Set(sent.map((l) => l.contact).filter(Boolean))].join(' · ')}</>
        : checks.length ? 'Nothing new to send this run' : 'Console + webhook',
    },
  ];

  const status = (i: number): Status => {
    if (i === 4 && (recentAlert || (busy && activeIdx === 4))) return 'alert';
    if (!busy) return run.length ? 'done' : 'waiting';
    if (i < activeIdx) return 'done';
    if (i === activeIdx) return 'active';
    return 'waiting';
  };

  return (
    <div className={`pipeline ${busy ? 'is-busy' : ''}`}>
      <p className="pl-head mono">
        {busy ? 'Run in progress' : run.length ? `Last run ${clock(run[0].t)} UTC` : 'Waiting for the first run'}
        {sent.length > 0 && <span className="pl-count">{sent.length} sent</span>}
      </p>
      <ol>
        {steps.map((s, i) => {
          const st = status(i);
          return (
            <li key={s.title} className={`pl-step st-${st}`}>
              <span className="pl-node" aria-hidden="true">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">{ICONS[i]}</svg>
              </span>
              <div className="pl-body">
                <button className="pl-toggle" aria-expanded={open === i} onClick={() => setOpen(open === i ? null : i)}>
                  <span className="pl-title">
                    {s.title}
                    <span className="pl-state">
                      {st === 'active' ? 'working' : st === 'alert' ? 'alerting' : st === 'done' ? '✓' : ''}
                      <svg className="pl-chev" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="m6 9 6 6 6-6" /></svg>
                    </span>
                  </span>
                  <span className="pl-detail">{s.detail}</span>
                </button>
                {open === i && <div className="pl-more">{more[i]}</div>}
              </div>
            </li>
          );
        })}
      </ol>
    </div>
  );
}
