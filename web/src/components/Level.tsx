import { LEVELS, LEVEL_STYLE, type Level } from '../levels';
import { useT } from '../i18n';

/** Icône par niveau : la couleur n'est jamais seule. */
export function LevelIcon({ level, size = 18 }: { level: Level; size?: number }) {
  const p = { width: size, height: size, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 2.4, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const, 'aria-hidden': true };
  switch (level) {
    case 'low': return <svg {...p}><path d="M12 5v14M6 13l6 6 6-6" /></svg>;
    case 'normal': return <svg {...p}><path d="M6 9.5h12M6 14.5h12" /></svg>;
    case 'high': return <svg {...p}><path d="M12 19V5M6 11l6-6 6 6" /></svg>;
    case 'unusual': return <svg {...p}><path d="M6 12l6-6 6 6M6 18l6-6 6 6" /></svg>;
    case 'extreme': return <svg {...p}><path d="M12 3.5 2.8 19.5h18.4L12 3.5z" /><path d="M12 10v4.2" /><path d="M12 17.2h.01" strokeWidth={3} /></svg>;
  }
}

/** Pastille : icône + mot, sur la couleur du niveau. */
export function LevelBadge({ level, size = 'md' }: { level: Level; size?: 'sm' | 'md' | 'lg' }) {
  const { t } = useT();
  const s = LEVEL_STYLE[level];
  return (
    <span className={`badge badge-${size}`} style={{ background: s.fill, color: s.ink }}>
      <LevelIcon level={level} size={size === 'lg' ? 22 : size === 'sm' ? 14 : 16} />
      <span>{t(`level.${level}`)}</span>
    </span>
  );
}

/** Légende : les 5 niveaux en mots. */
export function LevelLegend({ long = false }: { long?: boolean }) {
  const { t } = useT();
  return (
    <ul className={`legend ${long ? 'legend-long' : ''}`}>
      {LEVELS.map((l) => (
        <li key={l}>
          <LevelBadge level={l} size="sm" />
          {long && <span className="legend-text">{t(`levelLong.${l}`)}</span>}
        </li>
      ))}
    </ul>
  );
}
