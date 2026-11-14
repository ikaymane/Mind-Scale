/**
 * Palette UNIQUE des niveaux d'alerte — partagée par la carte (M4) et le bulletin (M5).
 * Ne pas dupliquer ces couleurs ailleurs : importer ce fichier.
 *
 * Divergente, lisible par les daltoniens : bleu (moins) → gris (normal) → ambre → orange-rouge → bordeaux.
 * La luminosité décroît de « high » à « extreme » : l'ordre reste lisible en niveaux de gris.
 * Règle : la couleur n'est JAMAIS seule — toujours avec le mot (t(`level.${l}`)) ou l'icône.
 */
export type Level = 'low' | 'normal' | 'high' | 'unusual' | 'extreme';

export const LEVELS: Level[] = ['low', 'normal', 'high', 'unusual', 'extreme'];

export interface LevelStyle {
  /** remplissage : pastille, polygone de carte, barre */
  fill: string;
  /** texte posé sur `fill` (contraste ≥ 4.5:1) */
  ink: string;
  /** fond pâle pour cartouches et surlignage */
  soft: string;
  /** opacité conseillée pour un polygone de carte */
  mapOpacity: number;
}

export const LEVEL_STYLE: Record<Level, LevelStyle> = {
  low: { fill: '#3A6EA5', ink: '#FFFFFF', soft: '#E6EEF7', mapOpacity: 0.55 },
  normal: { fill: '#C8CCD1', ink: '#1B1D1F', soft: '#F0F1F2', mapOpacity: 0.35 },
  high: { fill: '#F0A33A', ink: '#1F1300', soft: '#FDF1DF', mapOpacity: 0.65 },
  unusual: { fill: '#DD5A2B', ink: '#1A0700', soft: '#FBE6DD', mapOpacity: 0.75 },
  extreme: { fill: '#8C1C2F', ink: '#FFFFFF', soft: '#F5E1E4', mapOpacity: 0.85 },
};

/** Rang 0..4, utile pour trier / comparer */
export const levelRank = (l: Level) => LEVELS.indexOf(l);

/** Expression MapLibre prête à l'emploi : ['match', ['get','level'], 'low', '#3A6EA5', …, '#C8CCD1'] */
export const maplibreLevelColor = (prop = 'level') => [
  'match',
  ['get', prop],
  ...LEVELS.flatMap((l) => [l, LEVEL_STYLE[l].fill]),
  LEVEL_STYLE.normal.fill,
];
