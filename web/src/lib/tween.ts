import { useEffect, useRef, useState } from 'react';

const still = () => matchMedia('(prefers-reduced-motion: reduce)').matches;

/** A number that counts towards its target instead of jumping: figures stay readable while the month changes. */
export function useTween(target: number, ms = 700): number {
  const [value, setValue] = useState(target);
  const from = useRef(target);
  useEffect(() => {
    const start = from.current;
    if (start === target || still()) { from.current = target; setValue(target); return; }
    const t0 = performance.now();
    let raf = 0;
    const tick = (now: number) => {
      const k = Math.min(1, (now - t0) / ms);
      const eased = 1 - (1 - k) ** 3;
      from.current = start + (target - start) * eased;
      setValue(from.current);
      if (k < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [target, ms]);
  return value;
}
