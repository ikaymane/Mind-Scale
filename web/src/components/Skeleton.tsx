import type { CSSProperties } from 'react';

/** One grey placeholder block, sized by the caller. */
export function Sk({ w, h = 14, className = '', style }: { w?: number | string; h?: number | string; className?: string; style?: CSSProperties }) {
  return <span className={`sk ${className}`} style={{ width: w, height: h, ...style }} aria-hidden="true" />;
}

/** The overview's shape while the NASA files load: title, KPI band, country cards, globe. */
export function PageSkeleton({ label }: { label: string }) {
  return (
    <div className="home sk-page" role="status" aria-label={label}>
      <div className="page-head">
        <div className="sk-col"><Sk w="min(420px, 70vw)" h={34} /><Sk w="min(560px, 86vw)" h={16} /></div>
        <Sk w={236} h={42} />
      </div>
      <div className="kpis kpis-4">
        {[0, 1, 2, 3].map((i) => <div className="kpi" key={i}><div className="sk-col"><Sk w={110} h={10} /><Sk w={140} h={36} /><Sk w={150} h={12} /></div></div>)}
      </div>
      <div className="cc-grid">
        {[0, 1, 2].map((i) => <Sk key={i} w="100%" h={168} />)}
      </div>
      <Sk className="home-globe" w="100%" />
    </div>
  );
}
