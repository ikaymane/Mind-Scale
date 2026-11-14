/** Open wildfires from NASA EONET (no key, CORS open); falls back to the pipeline's snapshot. */
import { useEffect, useState } from 'react';
import type { LiveEvent } from '../globe/scene';

/** EONET returns at most this many events: a full page means "at least". */
export const EONET_LIMIT = 300;
const EONET = `https://eonet.gsfc.nasa.gov/api/v3/events?category=wildfires&status=open&limit=${EONET_LIMIT}`;

function parseEonet(j: { events: { title: string; geometry: { coordinates: number[] | number[][][] }[] }[] }): LiveEvent[] {
  return j.events.flatMap((e) => {
    const g = e.geometry[e.geometry.length - 1];
    const c = g?.coordinates;
    if (!c) return [];
    const pt = typeof c[0] === 'number' ? (c as number[]) : (c as number[][][])[0][0];
    return [{ lon: pt[0], lat: pt[1], title: e.title }];
  });
}

async function fetchEonet(): Promise<LiveEvent[]> {
  try {
    const ctl = new AbortController();
    const timer = setTimeout(() => ctl.abort(), 6000);
    const r = await fetch(EONET, { signal: ctl.signal });
    clearTimeout(timer);
    if (r.ok) return parseEonet(await r.json());
  } catch { /* offline or EONET slow */ }
  try {
    const r = await fetch(`${import.meta.env.BASE_URL}data/eonet.json`);
    if (r.ok) return ((await r.json()) as { events: LiveEvent[] }).events;
  } catch { /* no snapshot */ }
  return [];
}

let promise: Promise<LiveEvent[]> | null = null;
/** One request per session, shared by the globe and the KPI band. */
export function loadEonet(): Promise<LiveEvent[]> {
  promise ??= fetchEonet();
  return promise;
}

/** null while loading. */
export function useLiveEvents(): LiveEvent[] | null {
  const [events, setEvents] = useState<LiveEvent[] | null>(null);
  useEffect(() => {
    let alive = true;
    loadEonet().then((ev) => { if (alive) setEvents(ev); });
    return () => { alive = false; };
  }, []);
  return events;
}
