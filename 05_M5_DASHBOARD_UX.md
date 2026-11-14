# M5 — Développeur front / designer : bulletin, dashboard et langues

**Ta mission :** rendre NIRAN **compréhensible par n'importe qui**. Tu conçois l'identité visuelle, le « bulletin de santé des feux » par région, et les trois langues. Le défi s'appelle « easier to use » : c'est toi qui portes ce mot.

Lis d'abord `00_BRIEF_COMMUN.md` (section 7). Tu partages `/web` avec M4 : accordez-vous dès H0 sur la structure et l'état partagé `{ regionId, year, month, sensor, mode, lang }`.

## Livrables

| # | Livrable | Échéance |
|---|---|---|
| 1 | Maquette rapide (papier ou Figma) + couleurs, typographie, logo simple | **H4** |
| 2 | Mise en page du site + panneau bulletin branché sur les données factices | H12 |
| 3 | Bulletin complet sur vraies données (4 blocs ci-dessous) | H26 |
| 4 | Phrases automatiques + FR / AR / EN | H34 |
| 5 | Page « Méthode et sources », page d'accueil, finitions mobile | H40 |

## Mise en page
- Bureau : carte (M4) à gauche ~60 %, bulletin à droite ~40 %. Mobile : carte en haut, bulletin en tiroir glissant.
- En-tête : logo, recherche de région, sélecteur de langue, lien « Méthode ».

## Le bulletin d'une région (F3 + F4)

**Bloc 1 — Le verdict (le plus important)**
Une grande pastille de couleur + une phrase :
> **Tanger-Tétouan-Al Hoceïma — juillet 2022 : EXCEPTIONNEL.**
> 310 détections de feu, soit 7 fois plus qu'un mois de juillet habituel. C'est le pire mois de juillet depuis 2001.

**Bloc 2 — La saison en cours face à la normale**
Courbe cumulée de l'année choisie par-dessus la bande p10–p90 (`cumulative.json`). Légende en mots : « zone habituelle ».

**Bloc 3 — L'historique**
Barres par année (2001→), l'année choisie mise en évidence, barres colorées selon `level`. Variante : calendrier thermique année × mois.

**Bloc 4 — Pourquoi ? (contexte de M3)**
Trois petites tuiles : 🌡 « +2,8 °C par rapport à la normale », 🌧 « 64 % de pluie en moins », 🌲 « 38 % des feux en forêt ». Mention : « conditions observées, pas une preuve de cause ».

**Pied de bulletin :** bouton « Partager » (copie l'URL), « Télécharger les données (CSV) », source NASA FIRMS.

## Phrases automatiques
Pas besoin d'IA : des **modèles de phrases** remplis par les données, un par niveau et par langue. Exemple (FR, niveau `unusual`) :
`"{n} détections de feu en {mois} {année}, soit {ratio} fois la normale ({médiane}). Activité inhabituelle pour cette région."`
Gère les cas limites : `n = 0`, médiane = 0 (pas de « ×∞ »), pluriels.

## Langues
- Fichiers `fr.json`, `ar.json`, `en.json` (react-i18next ou simple dictionnaire).
- **Arabe = droite à gauche** : `dir="rtl"` sur la racine, tester que la mise en page se retourne bien (les graphiques restent de gauche à droite).
- Faire relire l'arabe par un membre arabophone. Si le temps manque : FR + AR d'abord, EN ensuite (le jury local sera sensible à l'arabe ; la soumission mondiale demande l'anglais → au minimum la vidéo et la description seront en anglais, voir M6).

## Design
- Sobre : fond neutre, une seule couleur d'accent, la couleur est réservée aux niveaux d'alerte.
- Même palette de niveaux que M4 (définissez-la ensemble dans un fichier `levels.ts` unique).
- Jamais la couleur seule : toujours un mot ou une icône à côté. Contraste suffisant, texte ≥ 16 px.
- Vocabulaire : « détections de feu » (pas « hotspots »), « la normale » (pas « baseline »), aucun « z-score » dans l'interface publique.

## Page « Méthode et sources »
Reprend en clair `NETTOYAGE.md` (M1) et `METHODE.md` (M2) : d'où viennent les données, ce qu'on a filtré, comment on décide qu'un mois est inhabituel, **les limites** (nuages, détections ≠ surface brûlée). Cette page rapporte des points au critère « Validité ».

## Outils
React, Recharts ou Plotly, CSS simple ou Tailwind, Figma (optionnel).

## Terminé quand
- [ ] Une personne extérieure à l'équipe comprend le verdict d'une région en moins de 10 secondes (**fais le test avec quelqu'un**)
- [ ] Les 4 blocs fonctionnent pour toutes les régions, y compris celles avec très peu de feux
- [ ] Les 3 langues fonctionnent, l'arabe s'affiche de droite à gauche
- [ ] Le site est utilisable sur téléphone

## Pièges
- Trop de graphiques tue le message : 4 blocs, pas plus.
- Code d'abord avec les données factices ; ne dépends ni de M2 ni de M3.
