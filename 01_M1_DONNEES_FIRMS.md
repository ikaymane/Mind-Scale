# M1 — Ingénieur données : acquisition et nettoyage FIRMS

**Ta mission :** transformer les CSV bruts de la NASA en données propres et légères, utilisables par toute l'équipe. Tout le projet repose sur toi : **tu es sur le chemin critique, tu livres en premier.**

Lis d'abord `00_BRIEF_COMMUN.md` (surtout la section 7, contrats de données).

## Livrables

| # | Livrable | Pour qui | Échéance |
|---|---|---|---|
| 1 | Fichiers **factices** au bon format (`grid_MODIS_2022.json`, `anomalies.json`, `live.json` avec 10 lignes inventées) | M4, M5 | **H2** |
| 2 | `hotspots_clean.parquet` pour le Maroc | M2, M3 | H8 |
| 3 | `hotspots_clean.parquet` + `grid_{sensor}_{year}.json` pour les 5 pays | M2, M4 | H16 |
| 4 | Script `live.py` (7 derniers jours via l'API) | M2, M5 | H30 |
| 5 | `docs/NETTOYAGE.md` : chaque filtre et combien de points il retire | M6 (pitch) | H36 |

## Étapes

### 1. Récupérer les données (H0–H4)
- Demander tout de suite une **MAP_KEY** gratuite : https://firms.modaps.eosdis.nasa.gov/api/map_key/
- Archives par pays et par année (le plus rapide) : https://firms.modaps.eosdis.nasa.gov/country/ — CSV annuels MODIS et VIIRS S-NPP par pays. Sinon, demande d'archive : https://firms.modaps.eosdis.nasa.gov/download/ (peut prendre du temps → **lance la demande dès H0**).
- Pays : Maroc, Algérie, Tunisie, Espagne, Portugal. MODIS 2001→dernière année complète, VIIRS S-NPP 2012→.
- Commence par **le Maroc seul** pour débloquer M2 et M3, puis généralise (`python clean.py --country MAR`).

### 2. Nettoyer (H4–H12)
Colonnes FIRMS utiles : `latitude, longitude, acq_date, acq_time, satellite, instrument, confidence, frp, daynight, type`.

Filtres à appliquer, dans cet ordre, en **comptant les lignes retirées à chaque étape** :
1. **`type == 0` uniquement** (feu de végétation présumé). On retire 1 = volcan, 2 = source statique terrestre (usines, torchères), 3 = offshore. La colonne `type` n'existe que dans les archives.
2. **Confiance** : MODIS `confidence >= 30` ; VIIRS on retire `l` (low), on garde `n` et `h`. Résultat dans `confidence_ok`.
3. **Sources persistantes restantes** : une cellule de ~1 km qui « brûle » plus de 60 jours par an sur plusieurs années = site industriel → liste noire.
4. **Doublons** : même capteur, même date, même position arrondie à 3 décimales.
5. Coordonnées et dates invalides, FRP négatif.

Règle d'or : **ne jamais fusionner MODIS (1 km) et VIIRS (375 m) dans un même comptage** — VIIRS détecte beaucoup plus de petits feux. La colonne `sensor` reste toujours présente.

### 3. Rattacher à l'espace (H8–H14)
- `cell_id` : arrondi à la grille (0,25° pour MODIS, 0,1° pour VIIRS), format `c_{lat}_{lon}`.
- `region_id` : jointure spatiale (geopandas `sjoin`) avec le `regions.geojson` fourni par M3.

### 4. Produire les agrégats pour la carte (H12–H16)
- `grid_{sensor}_{year}.json` : par cellule et par mois, `n` (nombre de détections) et `frp` (somme). Vise **moins de 500 Ko par fichier** (arrondis, pas de cellules vides).

### 5. Mode « maintenant » (H24–H30)
- API : `https://firms.modaps.eosdis.nasa.gov/api/area/csv/{MAP_KEY}/VIIRS_SNPP_NRT/{ouest,sud,est,nord}/{jours}` (nombre de jours limité par requête : vérifie la doc et boucle si besoin).
- Les données temps quasi réel n'ont pas de colonne `type` : réutilise la liste noire de l'étape 2.3.
- Le script écrit les points bruts ; M2 fournit la fonction qui calcule le niveau. Sortie : `live.json`.
- **La MAP_KEY ne va jamais dans le dépôt** (fichier `.env`, ignoré par git).

## Outils
Python 3.11+, pandas, geopandas, duckdb (très rapide sur gros CSV), pyarrow.

## Terminé quand
- [ ] Un seul appel `python clean.py --country XXX` produit tout pour un pays
- [ ] Les 5 pays sont traités, les fichiers respectent exactement les contrats
- [ ] `NETTOYAGE.md` contient le tableau « filtre → lignes retirées → % »
- [ ] M2 et M4 confirment qu'ils lisent tes fichiers sans erreur

## Pièges
- Volume : ne charge pas tout en mémoire d'un coup, traite pays par pays.
- Fuseaux : `acq_date` est en UTC, on reste en UTC partout.
- N'attends pas la perfection pour livrer : une version imparfaite à H8 vaut mieux qu'une parfaite à H20.
