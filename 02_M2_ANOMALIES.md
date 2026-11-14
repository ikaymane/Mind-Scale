# M2 — Data scientist : détection des saisons de feux anormales

**Ta mission :** construire le cerveau de NIRAN — décider, pour chaque région et chaque mois, si l'activité des feux est normale ou inhabituelle, et le prouver. C'est **la fonctionnalité qui nous différencie** et celle que les juges vont interroger.

Lis d'abord `00_BRIEF_COMMUN.md` (section 7, contrats de données).

## Livrables

| # | Livrable | Pour qui | Échéance |
|---|---|---|---|
| 1 | Notebook d'exploration sur le Maroc + méthode choisie | équipe | H12 |
| 2 | `anomalies.json` (5 pays, MODIS et VIIRS) | M4, M5 | H20 |
| 3 | `cumulative.json` (courbe cumulée + enveloppe p10–p90) | M5 | H24 |
| 4 | Fonction `level_for_live(region_id, n_7d, date)` pour le mode « maintenant » | M1 | H30 |
| 5 | `docs/METHODE.md` (1 page) + tableau de validation avec M6 | M6 | H36 |

## Méthode (simple, robuste, défendable)

Travaille en attendant les vraies données sur un extrait Maroc que tu télécharges toi-même (10 minutes).

### 1. Série de base
Pour chaque `region_id` × `sensor` × `year` × `month` : `n` = nombre de détections (`confidence_ok`), `frp_sum`.
N'oublie pas les **mois à zéro** (créer la grille complète région × année × mois, sinon la médiane est fausse).

### 2. Référence « normale » par région et par mois de l'année
- On compare juillet 2022 aux **autres juillets** de la même région (la saisonnalité est donc gérée d'office).
- **Leave-one-out** : l'année testée est exclue de sa propre référence (sinon un événement extrême masque sa propre anomalie).
- Statistiques robustes sur `log1p(n)` : médiane et MAD (pas moyenne/écart-type, trop sensibles aux extrêmes).
- `z = (log1p(n) − médiane) / (1,4826 × MAD)` ; si MAD = 0, utilise un plancher (ex. 0,5).
- Calcule aussi le **rang percentile** : plus facile à expliquer au public (« pire mois de juillet en 22 ans »).

### 3. Niveaux
| `level` | Condition | Texte public |
|---|---|---|
| `low` | z < −1 | Moins de feux que d'habitude |
| `normal` | −1 ≤ z < 1 | Dans la normale |
| `high` | 1 ≤ z < 2 | Au-dessus de la normale |
| `unusual` | 2 ≤ z < 3 | Inhabituel |
| `extreme` | z ≥ 3 | Exceptionnel |

Garde-fou : si la région a très peu de feux (médiane et `n` < 5), force `normal` — sinon 3 feux au lieu de 1 deviennent « extrêmes ».

### 4. Courbe cumulée de la saison (très visuelle, pour M5)
Pour chaque région : cumul journalier des détections du 1er janvier au 31 décembre, pour chaque année ; enveloppe p10 / p50 / p90 sur toutes les années. L'année en cours tracée par-dessus → on voit en un coup d'œil si elle « sort du couloir ».

### 5. Indicateurs de saison (si le temps le permet)
Par région et par année : date de début de saison (10 % du cumul annuel), pic, durée (10 %→90 %). Question à fort impact : **« la saison des feux commence-t-elle plus tôt qu'avant ? »**

### 6. Règles de validité
- MODIS et VIIRS : **deux analyses séparées**, jamais additionnées. MODIS pour la tendance longue (2001→), VIIRS pour le détail récent (2012→).
- Un nombre de détections n'est pas une surface brûlée : on parle d'« activité des feux », pas d'hectares.
- Les nuages et la fumée cachent des feux : le dire dans `METHODE.md` (les juges apprécient l'honnêteté sur les limites).

## Validation (avec M6) — l'argument massue du pitch
Vérifie que l'outil signale bien, **sans qu'on le lui dise**, des événements connus. Candidats à vérifier dans les données (M6 documente les sources de presse) :
- Nord du Maroc, juillet 2022 (Larache, Ouezzane, Tétouan)
- Algérie (Kabylie), août 2021
- Portugal, juin et octobre 2017
- Espagne, été 2022

Tableau attendu : événement → niveau détecté → rang historique. Compte aussi les **faux positifs** (mois « extreme » sans événement connu) et regarde ce qu'ils sont.

## Outils
Python, pandas / duckdb, numpy, matplotlib pour tes vérifications.

## Terminé quand
- [ ] `anomalies.json` et `cumulative.json` respectent les contrats et sont lus par M4/M5
- [ ] Au moins 3 événements réels sont retrouvés par l'outil
- [ ] `METHODE.md` tient en une page et un non-spécialiste la comprend
- [ ] Tu peux répondre en 30 secondes à : « Pourquoi z robuste ? Pourquoi pas mélanger les capteurs ? Quelles limites ? »

## Pièges
- Pas de machine learning compliqué : une méthode statistique claire et validée bat un modèle opaque devant un jury.
- Fixe la méthode à H12, ne la réinvente pas à H30.
