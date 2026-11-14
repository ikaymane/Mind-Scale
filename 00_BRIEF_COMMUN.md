# NIRAN — la mémoire des feux
### NASA Space Apps · Meknès 2026 · Défi 9 « Make wildfire data easier to use »

> **À lire par les 6 membres avant de commencer.** Chaque membre a ensuite sa propre fiche (`01_…` à `06_…`).
> « Niran » (نيران) = « feux » en arabe. Le nom peut changer, l'idée reste.

---

## 1. Le problème

La NASA publie plus de 20 ans de détections de feux (FIRMS : MODIS depuis 2000, VIIRS depuis 2012). Mais ces données sont des **millions de points bruts dans des CSV**. Un journaliste, un élu local, un agent des Eaux et Forêts ou un citoyen ne peut pas répondre à la seule question qui compte :

> **« Ce qui brûle en ce moment chez moi, est-ce normal ou pas ? »**

Les cartes existantes (FIRMS Fire Map) montrent *où* ça brûle, pas si c'est *inhabituel*.

## 2. Notre solution en une phrase

**NIRAN transforme 20+ ans de points de feu en un « bulletin de santé » par région : une carte d'historique par année, un détecteur de saisons anormales, et une explication en langage simple (FR / AR / EN) avec le contexte météo et le type de végétation.**

## 3. Les 4 fonctionnalités (= les 3 pistes du défi + 1 bonus)

| # | Fonctionnalité | Répond à |
|---|---|---|
| F1 | **Carte d'historique** : curseur temporel 2001→aujourd'hui, feux agrégés en grille, par année/mois | « A fire-history map by year » |
| F2 | **Détecteur d'anomalies** : chaque région × mois reçoit un niveau (normal / élevé / inhabituel / extrême) par rapport à son propre historique | « A tool to flag unusual fire seasons » |
| F3 | **Bulletin public** : fiche par région, courbe cumulée de l'année vs. enveloppe normale, phrase d'explication automatique, partageable | « A simple public dashboard » |
| F4 | **Pourquoi ?** : anomalies météo (chaleur, sécheresse, vent) et occupation du sol (forêt / culture / broussailles) à côté de chaque alerte | « Weather and land-cover layers » |
| Bonus | **Mode « maintenant »** : les 7 derniers jours (API FIRMS temps quasi réel) comparés à la normale | Effet démo |

## 4. Ce qui nous fait gagner (différenciation)

1. **On répond à « est-ce normal ? »**, pas seulement à « où ? ». C'est exactement « spot unusual activity ».
2. **Ancrage local** : démo centrée sur le Maroc et la Méditerranée occidentale (Maroc, Algérie, Tunisie, Espagne, Portugal), avec un cas réel connu des juges : **les feux de juillet 2022 dans le nord du Maroc (Larache, Ouezzane, Tétouan)**. Le pipeline est générique : n'importe quel pays en changeant un paramètre.
3. **Rigueur scientifique visible** (critère « Validity ») : nettoyage documenté, capteurs jamais mélangés, méthode robuste, **validation sur des événements réels connus**.
4. **Accessible** : trois langues dont l'arabe, mobile, phrases simples, couleurs lisibles par les daltoniens.
5. **Ça marche en vrai** : site statique déployé, lien public, pas de serveur qui tombe pendant la démo.

Critères officiels Space Apps à garder en tête : **Impact, Créativité, Validité, Pertinence, Présentation**.

## 5. Périmètre (important : ne pas se disperser)

- **Zone de démo** : 5 pays (MAR, DZA, TUN, ESP, PRT), découpés en régions administratives (niveau 1).
- **Période** : MODIS 2001→dernière année complète (tendance longue) ; VIIRS S-NPP 2012→aujourd'hui (détail).
- **Hors périmètre** : prédiction du risque futur, surfaces brûlées, comptes utilisateurs, backend.

## 6. Architecture (simple et robuste)

```
CSV FIRMS ──► [M1 nettoyage] ──► hotspots_clean.parquet ──► [M2 anomalies] ──► anomalies.json ─┐
                    │                      │                                                    ├─► [M4 carte] + [M5 dashboard] ──► site statique
                    └─► grid_AAAA.json     └──► [M3 météo + sol] ──► context.json, regions.geojson ┘
                                                                              [M6 : pitch, validation, QA, soumission]
```

- **Données** : Python (pandas, geopandas, duckdb). Tout est **pré-calculé** en fichiers JSON.
- **Site** : React + Vite, MapLibre GL (carte), Recharts ou Plotly (graphiques). Déploiement Vercel / Netlify / GitHub Pages.
- **Pas de backend.** Le mode « maintenant » est un script lancé avant la démo (ou une GitHub Action).
- **Un seul dépôt GitHub** : `/pipeline` (Python), `/web` (site), `/web/public/data` (JSON produits), `/docs` (pitch).

## 7. Contrats de données (À RESPECTER — c'est ce qui permet de travailler en parallèle)

Dès l'heure 2, M1 pousse des **fichiers factices** au bon format pour que M4 et M5 puissent coder sans attendre.

**`pipeline/out/hotspots_clean.parquet`** (M1 → M2, M3)
`lat, lon, date (AAAA-MM-JJ), year, month, sensor ("MODIS"|"VIIRS"), confidence_ok (bool), frp (MW), daynight ("D"|"N"), country (ISO3), region_id, cell_id`

**`web/public/data/regions.geojson`** (M3 → tous) — polygones simplifiés
`properties: { region_id, name_fr, name_ar, name_en, country }`

**`web/public/data/grid_{sensor}_{year}.json`** (M1 → M4)
`[ { "cell": "c_34.25_-5.75", "lat": 34.25, "lon": -5.75, "month": 7, "n": 42, "frp": 913.5 } ]` — grille 0,25° (MODIS) / 0,1° (VIIRS)

**`web/public/data/anomalies.json`** (M2 → M4, M5)
`[ { "region_id": "MAR-01", "sensor": "MODIS", "year": 2022, "month": 7, "n": 310, "median": 41, "p10": 12, "p90": 95, "z": 3.4, "percentile": 100, "level": "extreme" } ]`
`level ∈ { "low", "normal", "high", "unusual", "extreme" }`

**`web/public/data/cumulative.json`** (M2 → M5)
`{ "MAR-01": { "envelope": [ {"doy":1,"p10":0,"p50":0,"p90":1}, … ], "years": { "2022": [0,0,1,…] } } }`

**`web/public/data/context.json`** (M3 → M5)
`[ { "region_id": "MAR-01", "year": 2022, "month": 7, "t2m_anom": 2.8, "precip_anom_pct": -64, "wind_mean": 4.1, "rh_mean": 31, "landcover": {"forest": 0.38, "cropland": 0.31, "shrub": 0.22, "other": 0.09} } ]`

**`web/public/data/live.json`** (M1+M2 → M5)
`{ "updated": "2026-…", "regions": [ { "region_id": "MAR-01", "n_7d": 18, "normal_7d": 6, "ratio": 3.0, "level": "unusual" } ], "points": [ {"lat":…, "lon":…, "frp":…, "date":…} ] }`

## 8. Qui fait quoi

| Membre | Rôle | Fiche |
|---|---|---|
| M1 | Ingénieur données — acquisition et nettoyage FIRMS | `01_M1_DONNEES_FIRMS.md` |
| M2 | Data scientist — détection d'anomalies | `02_M2_ANOMALIES.md` |
| M3 | Géomaticien — régions, météo, occupation du sol | `03_M3_CONTEXTE_METEO_SOL.md` |
| M4 | Développeur front — carte web | `04_M4_CARTE_WEB.md` |
| M5 | Développeur front / designer — dashboard, bulletin, langues | `05_M5_DASHBOARD_UX.md` |
| M6 | Chef de projet — validation, pitch, vidéo, soumission | `06_M6_PITCH_COORDINATION.md` |

Les rôles sont à attribuer selon les compétences réelles de chacun : échangez librement les numéros.

## 9. Planning (hypothèse : 48 h — à adapter à la durée réelle)

| Phase | Heures | Objectif |
|---|---|---|
| 0. Cadrage | H0–H2 | Dépôt créé, rôles attribués, fichiers factices poussés, clé FIRMS obtenue |
| 1. Fondations | H2–H12 | Données propres (1 pays), carte qui affiche une grille, squelette du dashboard |
| 2. Cœur | H12–H24 | Anomalies calculées, 5 pays, carte + dashboard branchés sur les vraies données |
| **Point d'étape** | **H24** | **Démo interne de bout en bout. Ce qui ne marche pas est coupé.** |
| 3. Valeur ajoutée | H24–H36 | Contexte météo/sol, phrases automatiques, 3 langues, mode « maintenant » |
| 4. Finition | H36–H44 | **Gel des fonctionnalités à H36.** Bugs, mobile, vidéo, slides |
| 5. Soumission | H44–H48 | Soumission, répétitions du pitch (3 fois minimum) |

Points de synchronisation : 10 minutes debout toutes les 6 heures (fait / bloqué / prochain).

## 10. Règles d'équipe

- Une branche par personne, petites fusions fréquentes dans `main`. `main` doit toujours marcher.
- On ne change jamais un contrat de données sans prévenir le groupe.
- Bloqué plus de 30 minutes → on demande de l'aide.
- Toute source de données et tout usage d'IA sont notés dans `docs/SOURCES.md` (exigé par Space Apps).
