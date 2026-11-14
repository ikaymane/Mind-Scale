# M4 — Développeur front : la carte web

**Ta mission :** construire la carte interactive, premier écran que voient les juges. Elle doit être **belle, fluide et compréhensible en 5 secondes**.

Lis d'abord `00_BRIEF_COMMUN.md` (section 7, contrats de données). Tu partages le projet `/web` avec M5 : mettez-vous d'accord dès H0 sur la structure et l'état partagé.

## Livrables

| # | Livrable | Échéance |
|---|---|---|
| 1 | Projet React + Vite initialisé, déployé (lien public), carte de fond visible | **H4** |
| 2 | Grille de feux affichée depuis les fichiers factices + curseur d'année | H12 |
| 3 | Vraies données, 2 modes de carte, clic sur région → ouvre le bulletin de M5 | H24 |
| 4 | Animation temporelle, mode « maintenant », légendes | H34 |
| 5 | Version mobile correcte, performances vérifiées | H40 |

## Ce que fait la carte

### Mode 1 — « Historique » (F1)
- Cellules de grille colorées selon le nombre de détections (échelle **logarithmique**, palette séquentielle jaune→rouge sombre).
- **Curseur d'année** (2001→aujourd'hui) + sélecteur de mois (ou « année entière »).
- Bouton **▶ Lecture** : fait défiler les années (animation = moment fort de la vidéo de démo).
- Bascule capteur : MODIS (depuis 2001, 1 km) / VIIRS (depuis 2012, 375 m), avec une infobulle expliquant la différence.

### Mode 2 — « Est-ce normal ? » (F2)
- Les **régions** (polygones de `regions.geojson`) colorées selon `level` dans `anomalies.json` pour l'année/mois choisis.
- Palette **divergente** lisible par les daltoniens : bleu (moins que d'habitude) → gris clair (normal) → orange → rouge foncé (exceptionnel). Toujours une légende avec les mots, pas seulement les couleurs.
- Survol : nom de la région + « 310 détections, la normale est 41 ».
- **Clic sur une région** → sélectionne la région dans l'état partagé → le panneau bulletin de M5 s'ouvre.

### Mode 3 — « Maintenant » (bonus)
- Points des 7 derniers jours (`live.json`) par-dessus les régions colorées selon leur niveau actuel. Afficher la date de mise à jour.

## Technique
- **MapLibre GL JS** (libre, pas de clé). Fond de carte : un style gratuit sans clé (ex. tuiles OpenFreeMap ou Carto, vérifier les conditions d'usage) — sobre et sombre ou clair selon le design de M5.
- Grille : convertis le JSON en GeoJSON de polygones (carrés) côté client, couche `fill`. Si c'est lent, passe à deck.gl (`GridCellLayer` / `ScreenGridLayer`).
- Chargement paresseux : un fichier `grid_{sensor}_{year}.json` par année, mis en cache en mémoire ; précharge l'année suivante pour une animation fluide.
- **État partagé avec M5** (Zustand ou React Context) : `{ regionId, year, month, sensor, mode, lang }`. Reflète-le dans l'URL (`?region=MAR-01&year=2022&month=7`) → chaque vue est **partageable par lien**.
- Vue initiale : centrée sur le Maroc / Méditerranée occidentale, déjà positionnée sur juillet 2022 (l'histoire du pitch).

## Terminé quand
- [ ] Changement d'année en moins de 300 ms, animation sans saccade
- [ ] Les 3 modes fonctionnent avec les vraies données
- [ ] Clic région → bulletin ; l'URL restaure exactement la vue
- [ ] Utilisable sur téléphone (les juges ouvriront le lien sur mobile)
- [ ] Légende, source « NASA FIRMS » et date des données visibles sur la carte

## Pièges
- Ne pas afficher les millions de points bruts : uniquement les agrégats.
- Échelle linéaire = carte toute pâle avec deux taches rouges ; utilise le logarithme.
- Déploie dès H4 et redéploie à chaque fusion : jamais de « ça marche sur ma machine » le jour J.
- Ne dépends pas de M1 : code d'abord avec les fichiers factices.
