/**
 * The NIRAN agent as a little character, acting out what the server really does (one scene per log event):
 * idle at its desk → walks to the dish while NASA data comes down → thinks while it counts →
 * if a fire is confirmed: panics, runs to the fire station, the siren goes off → walks back.
 * Only events that arrive while the page is open are played; history stays in the log below.
 */
import { useEffect, useRef, useState } from 'react';
import type { LogEntry } from '../lib/api';

type State = 'idle' | 'wake' | 'fetch' | 'think' | 'panic' | 'run' | 'deliver' | 'return';
interface Scene { state: State; caption: string; ms: number }

/** Where the agent stands (stage units, viewBox 0 0 440 180) and which way it faces. */
const SPOT: Record<State, { x: number; face: 1 | -1 } | null> = {
  idle: { x: 74, face: 1 }, wake: { x: 74, face: 1 }, think: { x: 74, face: 1 },
  fetch: { x: 176, face: 1 }, panic: { x: 214, face: 1 }, run: { x: 318, face: 1 }, deliver: { x: 318, face: 1 }, return: { x: 74, face: -1 },
};
const LABEL: Record<State, string> = {
  idle: 'Waiting', wake: 'Waking up', fetch: 'Reading NASA', think: 'Thinking', panic: 'Fire confirmed!', run: 'Running', deliver: 'Alert delivered', return: 'Back on watch',
};

const short = (t: string, n = 120) => (t.length > n ? `${t.slice(0, n - 1)}…` : t);

function scenesFor(l: LogEntry): Scene[] {
  switch (l.kind) {
    case 'cycle':
      return l.text.startsWith('Cycle done')
        ? [{ state: 'return', caption: 'All checked. Walking back to the desk.', ms: 1700 }, { state: 'idle', caption: short(l.text), ms: 0 }]
        : [{ state: 'wake', caption: 'Time to look at the satellites again…', ms: 1100 }];
    case 'fetch':
      return [{ state: 'fetch', caption: short(l.text), ms: l.text.startsWith('Downloading') ? 1000 : 1500 }];
    case 'sense':
      return [{ state: 'think', caption: short(l.text), ms: 1500 }];
    case 'watch':
    case 'check':
      return [{ state: 'think', caption: short(l.text, 150), ms: 2200 }];
    case 'alert': {
      if (!l.text.startsWith('ALERT')) return [{ state: 'deliver', caption: short(l.text), ms: 1400 }];
      const who = l.text.match(/ALERT → ([^:]+):/)?.[1] ?? 'the fire service';
      const what = l.text.replace(/^ALERT → [^:]+:\s*/, '').replace(/ Sent to the console\.$/, '');
      return [
        { state: 'panic', caption: `Fire confirmed! ${short(what, 110)}`, ms: 1900 },
        { state: 'run', caption: `Running to ${who}…`, ms: 1400 },
        { state: 'deliver', caption: `Delivered to ${who}.`, ms: 1700 },
      ];
    }
    case 'error':
      return [{ state: 'think', caption: short(l.text), ms: 2000 }];
    default:
      return [];
  }
}

export function AgentStage({ logs }: { logs: LogEntry[] | null | undefined }) {
  const [scene, setScene] = useState<Scene>({ state: 'idle', caption: 'On watch. Next NASA read on schedule.', ms: 0 });
  const [pos, setPos] = useState(SPOT.idle!);
  const [delivered, setDelivered] = useState(0);
  const queue = useRef<Scene[]>([]);
  const seen = useRef<string | null>(null);
  const playing = useRef(false);
  const timer = useRef<number>();

  // play queued scenes one after the other
  const next = () => {
    const s = queue.current.shift();
    if (!s) { playing.current = false; return; }
    playing.current = true;
    setScene(s);
    const spot = SPOT[s.state];
    if (spot) setPos(spot);
    if (s.state === 'deliver') setDelivered((d) => d + 1);
    // a long backlog plays the routine steps faster; the alarm (panic → run → deliver) always plays in full
    const alarm = s.state === 'panic' || s.state === 'run' || s.state === 'deliver';
    const speed = alarm ? 1 : queue.current.length > 12 ? 0.45 : queue.current.length > 6 ? 0.7 : 1;
    timer.current = window.setTimeout(next, Math.max(s.ms * speed, s.ms ? 350 : 0));
  };

  useEffect(() => {
    if (!logs?.length) return;
    const keyOf = (l: LogEntry) => `${l.t}|${l.text}`;
    const key = keyOf(logs[logs.length - 1]);
    if (seen.current === null) { seen.current = key; return; }   // first load: history is not replayed
    if (key === seen.current) return;
    let idx = -1;
    for (let i = logs.length - 1; i >= 0; i--) if (keyOf(logs[i]) === seen.current) { idx = i; break; }
    const fresh = idx >= 0 ? logs.slice(idx + 1) : logs.slice(-6);
    seen.current = key;
    queue.current.push(...fresh.flatMap(scenesFor));
    if (!playing.current) next();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [logs]);
  useEffect(() => () => window.clearTimeout(timer.current), []);

  const st = scene.state;
  return (
    <div className={`stage s-${st}`} aria-live="polite">
      <svg className="stage-svg" viewBox="0 0 440 180" role="img" aria-label={`NIRAN agent: ${LABEL[st]}. ${scene.caption}`}>
        {/* sky + satellite */}
        <g className="sat">
          <rect x="-14" y="-4" width="10" height="8" className="sat-panel" />
          <rect x="4" y="-4" width="10" height="8" className="sat-panel" />
          <rect x="-4" y="-5" width="8" height="10" rx="2" className="sat-body" />
          <path d="M0 5v4" className="sat-ant" />
        </g>
        <path className="beam" d="M206 40 L190 112" />
        <circle className="packet p1" r="2.6" /><circle className="packet p2" r="2.6" /><circle className="packet p3" r="2.6" />

        {/* ground */}
        <path className="ground" d="M0 160 H440" />
        <path className="hill" d="M232 160 q30 -34 64 0" />
        <g className="far-fire" transform="translate(264 132)">
          <path d="M0 -14 C6 -6 8 -2 5 4 C3 8 -3 8 -5 4 C-8 -2 -4 -6 0 -14z" className="flame" />
          <path d="M0 -6 C3 -2 3 1 1 4 C0 5 -1 5 -2 3 C-3 1 -2 -2 0 -6z" className="flame-core" />
        </g>

        {/* desk + monitor */}
        <g className="desk" transform="translate(28 118)">
          <rect x="0" y="22" width="56" height="4" rx="1" className="desk-top" />
          <path d="M6 26v16M50 26v16" className="desk-leg" />
          <rect x="8" y="0" width="34" height="22" rx="2" className="monitor" />
          <circle cx="25" cy="11" r="7" className="monitor-globe" />
          <path d="M14 6h22M14 10h16M14 14h20M14 18h12" className="monitor-lines" />
        </g>

        {/* dish */}
        <g className="dish" transform="translate(190 160)">
          <path d="M0 0 L0 -26" className="dish-mast" />
          <path d="M-16 -40 Q0 -16 16 -40" className="dish-bowl" />
          <path d="M0 -30 L4 -48" className="dish-feed" />
        </g>

        {/* fire station */}
        <g className="station" transform="translate(352 104)">
          <rect x="0" y="16" width="72" height="40" className="st-wall" />
          <path d="M-4 18 L36 0 L76 18z" className="st-roof" />
          <rect x="10" y="28" width="30" height="28" className="st-door" />
          <path d="M10 35h30M10 42h30M10 49h30" className="st-door-lines" />
          <text x="56" y="38" className="st-label" textAnchor="middle">FIRE</text>
          <rect x="30" y="-8" width="12" height="7" rx="2" className="siren" />
          <path d="M28 -10 l-6 -5 M44 -10 l6 -5 M36 -11 v-6" className="siren-rays" />
          {delivered > 0 && <g className="st-badge" transform="translate(66 14)"><circle r="9" /><text y="3.5" textAnchor="middle">{delivered}</text></g>}
        </g>

        {/* the agent */}
        <g className="bot-pos" style={{ transform: `translate(${pos.x}px, 92px)` }}>
          <g className="bot-flip" style={{ transform: `scaleX(${st === 'return' ? -1 : pos.face})` }}>
            <g className="bot">
              <g className="thought">
                <circle cx="50" cy="8" r="3" /><circle cx="57" cy="-1" r="4.5" />
                <rect x="58" y="-24" width="38" height="20" rx="10" />
                <circle className="dot d1" cx="69" cy="-14" r="2.2" /><circle className="dot d2" cx="77" cy="-14" r="2.2" /><circle className="dot d3" cx="85" cy="-14" r="2.2" />
              </g>
              <text className="bang" x="30" y="-8" textAnchor="middle">!</text>
              <path className="sweat" d="M50 22 q3 5 0 7 q-3 -2 0 -7z" />
              <path className="speed" d="M-6 40h-14M-4 50h-20M-6 60h-12" />
              <path d="M30 14 V5" className="b-ant" />
              <circle cx="30" cy="4" r="3.2" className="b-ant-light" />
              <rect x="14" y="14" width="32" height="22" rx="8" className="b-head" />
              <rect x="18" y="19" width="24" height="11" rx="5" className="b-visor" />
              <circle cx="25" cy="24.5" r="2.4" className="b-eye" /><circle cx="35" cy="24.5" r="2.4" className="b-eye" />
              <ellipse cx="30" cy="33" rx="2.6" ry="1.6" className="b-mouth" />
              <path d="M18 42 L11 53" className="b-arm arm-l" /><path d="M42 42 L49 53" className="b-arm arm-r" />
              <rect x="18" y="38" width="24" height="21" rx="5" className="b-body" />
              <path d="M30 43c2.5 2.6 3.2 4.6 1.8 7-.6 1-2.9 1-3.6 0-1.4-2.4-.7-4.4 1.8-7z" className="b-badge" />
              <path d="M25 59 V71" className="b-leg leg-l" /><path d="M35 59 V71" className="b-leg leg-r" />
              {st === 'deliver' && <g className="letter" transform="translate(46 30)"><rect x="0" y="0" width="14" height="10" rx="1" /><path d="M0 0l7 6 7-6" /></g>}
            </g>
          </g>
        </g>
      </svg>
      <p className="stage-caption"><span className="stage-tag mono">{LABEL[st]}</span>{scene.caption}</p>
    </div>
  );
}
