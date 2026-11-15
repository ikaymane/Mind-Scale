/** NIRAN server API (server/index.mjs). Same origin in production; Vite proxies /api in dev. */
import { useEffect, useState } from 'react';

export interface LiveRegion {
  region_id: string; name: string; dates: string[]; perDay: number[]; n: number;
  usual: number | null; refYears: number; level: string | null; viirs24h: number; viirsStrong24h: number;
}
export interface LiveResponse { updated: string | null; error: string | null; regions: LiveRegion[] }
export interface Watch { region_id: string; name: string; reason: string; by: 'agent' | 'operator'; since: string }
export interface Alert {
  id: string; sent: string; severity: 'Minor' | 'Moderate' | 'Severe'; certainty: string; urgency: string; event: string;
  region_id: string; area: string; lat: number; lon: number; detections: number; frp_mw: number; satellites: string[];
  observed: string; source: string; contact: string | null; map: string; watch_reason: string; channels: string[];
}
export interface ChatMessage { role: 'user' | 'assistant'; content: string }
export interface ChatAction { type: 'watch' | 'unwatch'; region_id: string; name: string; reason: string }
export interface ChatResponse { reply: string; regionId: string | null; actions: ChatAction[]; steps: string[]; engine: string; live_updated: string | null }

async function json<T>(url: string, init?: RequestInit): Promise<T> {
  const r = await fetch(url, init);
  if (!r.ok) throw new Error(`${url}: HTTP ${r.status}`);
  return (await r.json()) as T;
}

export const api = {
  live: () => json<LiveResponse>('/api/live'),
  watches: () => json<Watch[]>('/api/watches'),
  alerts: () => json<Alert[]>('/api/alerts'),
  watch: (region_id: string) => json<Watch>('/api/watches', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ region_id }) }),
  unwatch: (region_id: string) => json<{ ok: true }>(`/api/watches/${encodeURIComponent(region_id)}`, { method: 'DELETE' }),
  chat: (messages: ChatMessage[], regionId: string | null) =>
    json<ChatResponse>('/api/chat', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ messages, regionId }) }),
};

/** Polls a server endpoint; `undefined` while loading, `null` when the server is not reachable. */
export function usePoll<T>(fn: () => Promise<T>, ms: number, deps: unknown[] = []): [T | null | undefined, () => void] {
  const [v, setV] = useState<T | null | undefined>(undefined);
  const [tick, setTick] = useState(0);
  useEffect(() => {
    let alive = true;
    const run = () => fn().then((x) => alive && setV(x)).catch(() => alive && setV(null));
    run();
    const id = setInterval(run, ms);
    return () => { alive = false; clearInterval(id); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tick, ...deps]);
  return [v, () => setTick((t) => t + 1)];
}

export interface LogEntry {
  t: string; kind: 'cycle' | 'fetch' | 'sense' | 'watch' | 'check' | 'alert' | 'error'; text: string; region_id?: string;
  /** structured numbers sent with some events (fetch / sense / check / alert) */
  name?: string; feed?: string; worldwide?: number; kept?: number; level?: string | null; n?: number; usual?: number | null;
  detections?: number; newer?: number; first?: boolean; cells?: number; confirmed?: number; sending?: number; contact?: string | null; severity?: string;
}

/** Alerts + the agent's activity log: initial lists, then Server-Sent Events as they happen. */
export function useStream(): { alerts: Alert[] | null | undefined; logs: LogEntry[] | null | undefined } {
  const [alerts, setAlerts] = useState<Alert[] | null | undefined>(undefined);
  const [logs, setLogs] = useState<LogEntry[] | null | undefined>(undefined);
  useEffect(() => {
    let alive = true;
    api.alerts().then((a) => alive && setAlerts(a)).catch(() => alive && setAlerts(null));
    json<LogEntry[]>('/api/log').then((l) => alive && setLogs(l)).catch(() => alive && setLogs(null));
    const es = new EventSource('/api/alerts/stream');
    es.onmessage = (e) => {
      const a = JSON.parse(e.data) as Alert;
      setAlerts((cur) => [a, ...(cur ?? []).filter((x) => x.id !== a.id)]);
    };
    es.addEventListener('log', (e) => {
      const l = JSON.parse((e as MessageEvent).data) as LogEntry;
      setLogs((cur) => [...(cur ?? []), l].slice(-300));
    });
    return () => { alive = false; es.close(); };
  }, []);
  return { alerts, logs };
}
