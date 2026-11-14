# M3 — Géomaticien : régions, météo et occupation du sol

**Ta mission :** donner le **« pourquoi »**. Quand NIRAN dit « inhabituel », tu fournis le contexte : il faisait +3 °C, il n'avait pas plu, et c'est de la forêt qui brûle (pas des chaumes agricoles). Tu fournis aussi le découpage en régions dont tout le monde dépend.

Lis d'abord `00_BRIEF_COMMUN.md` (section 7, contrats de données).

## Livrables

| # | Livrable | Pour qui | Échéance |
|---|---|---|---|
| 1 | `regions.geojson` (5 pays, niveau administratif 1, simplifié) | **M1, M4 — urgent** | **H4** |
| 2 | `context.json` — partie météo, Maroc | M5 | H16 |
| 3 | `context.json` — météo + occupation du sol, 5 pays | M5 | H28 |
| 4 | Couche carte « occupation du sol » simplifiée (optionnel) | M4 | H32 |
| 5 | 3 exemples chiffrés « anomalie de feu ↔ anomalie météo » | M6 (pitch) | H36 |

## Étapes

### 1. Régions (H0–H4) — priorité absolue
- Source : **geoBoundaries** (https://www.geoboundaries.org, licence ouverte) ou Natural Earth admin-1. Vérifie la licence et note-la dans `docs/SOURCES.md`.
- `region_id` : `{ISO3}-{numéro}` (ex. `MAR-01`). Propriétés : `name_fr`, `name_ar`, `name_en`, `country`.
- **Simplifie les géométries** (mapshaper.org, ~5 %) : le fichier doit faire moins de 1 Mo.
- Frontières : utilise le jeu de données tel que fourni par la source et cite-la ; pas de modification manuelle.

### 2. Météo (H4–H20)
- Source : **NASA POWER** (gratuit, sans clé, données NASA → bon pour le critère « pertinence »).
  `https://power.larc.nasa.gov/api/temporal/monthly/point?parameters=T2M,PRECTOTCORR,WS2M,RH2M&community=AG&longitude={lon}&latitude={lat}&start=2001&end=2025&format=JSON`
- Un point par région : le centroïde (ou mieux, 3–5 points moyennés pour les grandes régions).
- Variables : température à 2 m, précipitations, vent, humidité relative.
- Pour chaque région × mois, calcule l'**anomalie** par rapport à la moyenne 2001–2020 du même mois :
  - `t2m_anom` en °C (ex. +2,8)
  - `precip_anom_pct` en % (ex. −64) ; bonus : cumul de pluie des 3 mois précédents (la sécheresse se construit avant le feu)
- Mets les réponses de l'API en cache sur disque : ne la rappelle pas à chaque exécution.

### 3. Occupation du sol (H16–H28)
- Source : **MODIS Land Cover MCD12Q1** (NASA, 500 m) ou **ESA WorldCover** (10 m, plus lourd). Le plus simple en hackathon : passer par Google Earth Engine si quelqu'un a un compte, sinon télécharger les tuiles de la zone.
- Regroupe en 4 classes : `forest`, `cropland`, `shrub` (broussailles/prairies), `other`.
- Deux sorties :
  1. par région : part de chaque classe **parmi les détections de feu** (échantillonne la classe sous chaque point de `hotspots_clean.parquet`) ;
  2. si possible, par année : cette part change-t-elle ? (« en 2022, 70 % des feux étaient en forêt contre 35 % d'habitude » = phrase en or pour le pitch).
- Intérêt : distinguer les **brûlages agricoles saisonniers** (normaux) des **feux de forêt** (graves).

### 4. Lien feux ↔ météo (H28–H36)
Avec M2 : pour les mois classés `unusual` / `extreme`, quelle part avait aussi une anomalie chaude ou sèche ? Un chiffre simple suffit (« 8 mois extrêmes sur 10 étaient aussi anormalement chauds »). **Ne parle pas de causalité**, seulement de coïncidence observée.

## Outils
Python (geopandas, rasterio, requests), QGIS pour vérifier visuellement, mapshaper pour simplifier.

## Terminé quand
- [ ] `regions.geojson` < 1 Mo, s'affiche correctement, noms dans les 3 langues
- [ ] `context.json` respecte le contrat, aucune région manquante
- [ ] Sources et licences notées dans `docs/SOURCES.md`
- [ ] 3 exemples chiffrés remis à M6

## Pièges
- Les rasters d'occupation du sol sont lourds : découpe à la zone d'étude dès le téléchargement.
- Si l'occupation du sol bloque à H28, livre la météo seule : c'est déjà une vraie valeur ajoutée.
- Noms en arabe : vérifie-les avec un membre arabophone, pas de traduction automatique non relue.
