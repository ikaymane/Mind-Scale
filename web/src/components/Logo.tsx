/** Logo : une flamme dont le cœur est un petit histogramme (« la mémoire des feux »). */
export function LogoMark({ size = 32 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" aria-hidden="true">
      <rect width="32" height="32" rx="8" fill="var(--ink)" />
      <path d="M16 5c1 4 6 6.5 6 12.5A6 6 0 0 1 10 17.5c0-2.6 1.4-4.1 2.6-5.3.3 1.8 1.2 2.8 2.2 3.3C14.4 11.4 15 8 16 5z" fill="var(--bg)" />
      <rect x="12.6" y="20" width="1.8" height="3.5" rx=".9" fill="var(--ink)" />
      <rect x="15.1" y="18" width="1.8" height="5.5" rx=".9" fill="var(--ink)" />
      <rect x="17.6" y="19" width="1.8" height="4.5" rx=".9" fill="var(--ink)" />
    </svg>
  );
}

export function Logo({ tagline }: { tagline?: string }) {
  return (
    <span className="logo">
      <LogoMark />
      <span className="logo-text">
        <span className="logo-word">NIRAN</span>
        {tagline && <span className="logo-tag">{tagline}</span>}
      </span>
    </span>
  );
}
