/**
 * Fire-service console: what the fire brigade sees. Live status per country (NASA FIRMS, last 7 days vs usual),
 * the agent's watch list, and the alerts it sent, streamed from the server as they happen.
 */
import { useEffect, useRef } from 'react';
import { LevelBadge } from '../components/Level';
import { LEVELS, type Level } from '../levels';
import { api, usePoll, useStream, type Alert, type LogEntry } from '../lib/api';
import { AgentStage } from '../agent/AgentStage';

const STEPS = [
  { name: 'Sense', line: 'Every 10 minutes the server reads NASA FIRMS near-real-time detections and compares the last 7 days with the same days in the 2020–2025 archive.' },
  { name: 'Watch', line: 'When a country goes above its usual level, or someone asks, the agent puts it on watch.' },
  { name: 'Confirm', line: 'In a watched country, new VIIRS detections are grouped into ~10 km cells. Two detections, or one strong one (≥ 20 MW), confirm a fire.' },
  { name: 'Notify', line: 'The confirmed fire is sent to the fire service: this console, plus a webhook (SMS, e-mail, dispatch system) when one is set.' },
];

const fmtTime = (iso: string) => new Date(iso).toLocaleString('en-GB', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit', timeZone: 'UTC' }) + ' UTC';
const asLevel = (l: string | null): Level | null => (l && (LEVELS as string[]).includes(l) ? (l as Level) : null);

function SeverityTag({ s }: { s: Alert['severity'] }) {
  const style = s === 'Severe' ? 'extreme' : s === 'Moderate' ? 'unusual' : 'high';
  return <span className={`sev sev-${style}`}>{s}</span>;
}

const KIND_LABEL: Record<LogEntry['kind'], string> = { cycle: 'agent', fetch: 'NASA', sense: 'sense', watch: 'watch', check: 'confirm', alert: 'notify', error: 'error' };
const clock = (iso: string) => new Date(iso).toISOString().slice(11, 19);

/** The agent's work, line by line: downloads, counts, checks, alerts. Newest at the bottom, like a terminal. */
function Activity({ logs }: { logs: LogEntry[] | null | undefined }) {
  const box = useRef<HTMLOListElement>(null);
  useEffect(() => { const b = box.current; if (b) b.scrollTop = b.scrollHeight; }, [logs?.length]);
  const lastCycle = [...(logs ?? [])].reverse().find((l) => l.kind === 'cycle');
  const busy = !!lastCycle && !lastCycle.text.startsWith('Cycle done');
  return (
    <aside className="activity" aria-label="Agent activity">
      <header>
        <strong>Agent activity</strong>
        <span className={`activity-state ${busy ? 'is-busy' : ''}`}>{busy ? 'reading NASA FIRMS…' : 'idle · next read on schedule'}</span>
      </header>
      <AgentStage logs={logs} />
      {logs === null ? <p className="footnote">Server not reachable.</p> : (
        <ol ref={box} aria-live="polite">
          {(logs ?? []).map((l, i) => (
            <li key={`${l.t}-${i}`} className={`log-${l.kind}`}>
              <span className="log-time">{clock(l.t)}</span>
              <span className="log-kind">{KIND_LABEL[l.kind]}</span>
              <span className="log-text">{l.text}</span>
            </li>
          ))}
        </ol>
      )}
    </aside>
  );
}

export function Dispatch() {
  const [live] = usePoll(api.live, 60000);
  const [watches, reloadWatches] = usePoll(api.watches, 15000);
  const { alerts, logs } = useStream();
  const watched = new Set((watches ?? []).map((w) => w.region_id));

  const toggle = async (id: string) => {
    if (watched.has(id)) await api.unwatch(id); else await api.watch(id);
    reloadWatches();
  };

  if (live === null) {
    return <main id="main" className="prose-page dispatch"><h1>Fire-service console</h1><p className="state state-error">The NIRAN server is not reachable. Start it with <code>node server/index.mjs</code>.</p></main>;
  }

  return (
    <main id="main" className="prose-page dispatch">
      <p className="eyebrow mono">Demo channel · fire service</p>
      <h1>Fire-service console</h1>
      <p className="lead">What a fire brigade would see. The NIRAN agent watches NASA satellite detections and sends an alert when a fire is confirmed in a watched country.</p>

      <ol className="dispatch-steps">
        {STEPS.map((s, i) => (
          <li key={s.name}><span className="mono">{String(i + 1).padStart(2, '0')}</span><strong>{s.name}</strong><p>{s.line}</p></li>
        ))}
      </ol>

      <div className="dispatch-grid">
      <div className="dispatch-main">
      <section>
        <h2>Right now, by country</h2>
        {live === undefined ? <p className="footnote">Loading NASA FIRMS near-real-time…</p> : (
          <div className="table-wrap">
            <table className="data-table">
              <thead><tr><th>Country</th><th className="num">Last 7 days</th><th className="num">Usual</th><th>Level</th><th className="num">Last 24 h (VIIRS)</th><th>Watch</th></tr></thead>
              <tbody>
                {live.regions.map((r) => {
                  const lv = asLevel(r.level);
                  return (
                    <tr key={r.region_id}>
                      <td>{r.name}</td>
                      <td className="num mono">{r.n.toLocaleString('en')}</td>
                      <td className="num mono">{r.usual?.toLocaleString('en') ?? '–'}</td>
                      <td>{lv ? <LevelBadge level={lv} size="sm" /> : '–'}</td>
                      <td className="num mono">{r.viirs24h.toLocaleString('en')}</td>
                      <td><button className={`watch-btn ${watched.has(r.region_id) ? 'is-on' : ''}`} onClick={() => toggle(r.region_id)}>{watched.has(r.region_id) ? 'Watching · stop' : 'Start watch'}</button></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
        <p className="footnote">NASA FIRMS near-real-time: MODIS last 7 complete days (Terra + Aqua, confidence ≥ 30) vs the same days in the archive; VIIRS last 24 h (NOAA-20 + NOAA-21). {live?.updated && `Read ${fmtTime(live.updated)}.`}</p>
      </section>

      <section>
        <h2>Watch list</h2>
        {!watches?.length ? <p className="footnote">No country on watch. The agent adds one when its last 7 days go above usual.</p> : (
          <ul className="watch-list">
            {watches.map((w) => (
              <li key={w.region_id}><span className="live-dot" aria-hidden="true" /><strong>{w.name}</strong><span>{w.reason}</span><span className="footnote mono">since {fmtTime(w.since)} · by {w.by}</span></li>
            ))}
          </ul>
        )}
      </section>

      <section>
        <h2>Alerts sent {alerts?.length ? <span className="count mono">{alerts.length}</span> : null}</h2>
        {alerts === undefined ? <p className="footnote">Loading…</p> : !alerts?.length ? <p className="footnote">No alert yet. Alerts appear here the moment the server sends them.</p> : (
          <div className="alert-list">
            {alerts.map((a) => (
              <article key={a.id} className="alert-card">
                <header><SeverityTag s={a.severity} /><strong>{a.event} · {a.area}</strong><span className="mono footnote">sent {fmtTime(a.sent)}</span></header>
                <dl>
                  <div><dt>Where</dt><dd className="mono">{a.lat.toFixed(3)}, {a.lon.toFixed(3)} · <a href={a.map} target="_blank" rel="noreferrer">open in NASA FIRMS</a></dd></div>
                  <div><dt>Seen</dt><dd className="mono">{a.observed}</dd></div>
                  <div><dt>Evidence</dt><dd>{a.detections} detection{a.detections > 1 ? 's' : ''}, {a.frp_mw.toLocaleString('en')} MW fire power · {a.satellites.join(', ')}</dd></div>
                  <div><dt>Certainty</dt><dd>{a.certainty} · urgency {a.urgency}</dd></div>
                  <div><dt>Call</dt><dd>{a.contact ?? '–'}</dd></div>
                  <div><dt>Sent to</dt><dd>{a.channels.join(', ')}</dd></div>
                </dl>
                <p className="footnote">Why watched: {a.watch_reason}. Source: {a.source}.</p>
              </article>
            ))}
          </div>
        )}
      </section>
      </div>
      <Activity logs={logs} />
      </div>
    </main>
  );
}
