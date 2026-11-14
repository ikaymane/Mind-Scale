# M6 — Chef de projet : coordination, validation, pitch et soumission

**Ta mission :** faire en sorte que l'équipe livre à l'heure, que le projet soit **crédible** (validation sur des faits réels) et que le jury s'en **souvienne**. Un bon projet mal présenté perd ; c'est toi qui transformes le travail des 5 autres en première place.

Lis d'abord `00_BRIEF_COMMUN.md` en entier : tu en es le gardien.

## Livrables

| # | Livrable | Échéance |
|---|---|---|
| 1 | Dépôt GitHub, canal de discussion, tableau des tâches, rôles confirmés | **H1** |
| 2 | Lecture des règles officielles : format et durée de la vidéo/démo, champs de la soumission, **heure limite exacte** | **H3** |
| 3 | Dossier de validation : 4 événements réels documentés | H20 |
| 4 | Scénario du pitch + première version des slides | H30 |
| 5 | Vidéo / démo enregistrée (en anglais ou sous-titrée) | H42 |
| 6 | Soumission complète sur le site Space Apps | **H45 au plus tard** |
| 7 | 3 répétitions du pitch chronométrées | H46–H48 |

## 1. Coordination
- Point debout de 10 minutes toutes les 6 heures : fait / bloqué / prochain. Tu notes, tu débloques.
- **H24 : démo interne de bout en bout.** Tu décides avec l'équipe de ce qu'on coupe. Ordre de sacrifice si retard : mode « maintenant » → occupation du sol → anglais dans l'interface → indicateurs de saison. **On ne sacrifie jamais** : carte historique, niveaux d'anomalie, bulletin, validation.
- **H36 : gel des fonctionnalités.** Après, uniquement des corrections.
- Tiens `docs/SOURCES.md` à jour : toutes les données (NASA FIRMS, NASA POWER, MODIS/ESA, frontières), les bibliothèques, et **tout usage d'outils d'IA** (Space Apps demande de le déclarer).
- Teste le site comme un utilisateur toutes les 6 heures, sur ordinateur et téléphone ; remonte les bugs.

## 2. Validation sur des faits réels (avec M2)
Pour chaque événement : date, lieu, 1–2 sources fiables (presse, rapports officiels, EFFIS/Copernicus), puis ce que NIRAN affiche.

| Événement à vérifier | Ce qu'on cherche |
|---|---|
| Nord du Maroc, juillet 2022 (Larache, Ouezzane, Tétouan) | **Notre cas principal** : niveau, rang historique, météo associée |
| Algérie (Kabylie), août 2021 | Niveau détecté |
| Portugal, juin et octobre 2017 | Niveau détecté |
| Espagne, été 2022 | Niveau détecté |

Vérifie chaque chiffre dans les données avant de le mettre dans une slide : **n'affirme rien que l'outil ne montre pas réellement.** Si un événement n'est pas détecté, comprenez pourquoi (nuages ? découpage régional ?) — c'est une limite à assumer, pas à cacher.

## 3. Le pitch (structure conseillée, à adapter à la durée imposée)

1. **Accroche (20 s)** — « Juillet 2022. Le nord du Maroc brûle. Les satellites de la NASA ont tout vu, pixel par pixel. Mais ce jour-là, personne ne pouvait répondre simplement à une question : *est-ce normal ?* »
2. **Problème (30 s)** — 20 ans de données ouvertes, des millions de points, inutilisables par ceux qui en ont besoin.
3. **Solution (20 s)** — NIRAN : la phrase de la section 2 du brief.
4. **Démo en direct (90 s)** — carte animée 2001→2022 → clic sur la région → verdict « EXCEPTIONNEL » → courbe qui sort du couloir → tuiles météo → bascule en arabe → mode « maintenant ».
5. **Pourquoi nous croire (30 s)** — nettoyage (X % de fausses sources retirées), méthode robuste, « l'outil retrouve seul N événements réels sur N ».
6. **Impact et suite (30 s)** — pour qui (protection civile, Eaux et Forêts, journalistes, enseignants, citoyens) ; extensible à tout pays en une commande ; prochaines étapes (alertes, surfaces brûlées).
7. **Chute (10 s)** — une phrase mémorable, ex. « La NASA voit les feux. NIRAN aide à les comprendre. »

Règles : une idée par slide, gros visuels, quasiment pas de texte. **Prévois une vidéo de secours de la démo** au cas où le réseau lâche.

## 4. Questions probables du jury — prépare les réponses avec M1, M2, M3
- En quoi est-ce différent de la carte FIRMS de la NASA ?
- Comment définissez-vous « inhabituel » ? Pourquoi cette méthode ?
- Pourquoi ne pas mélanger MODIS et VIIRS ?
- Quelles sont les limites ? (nuages, détections ≠ surfaces, petits feux invisibles pour MODIS)
- Qui l'utiliserait vraiment, et comment le déployer à l'échelle mondiale ?
- La météo *cause*-t-elle les feux ? (Réponse : on montre une coïncidence, pas une causalité.)

## 5. Soumission
- Titre, résumé court, description détaillée (problème, solution, données NASA utilisées, méthode, impact), lien du site, lien du dépôt (public, avec README clair et licence), vidéo/slides, déclaration des sources et de l'IA.
- Rédige en **anglais** (évaluation mondiale possible) ; fais relire.
- **Soumets une première version à H40**, puis mets à jour : ne jamais attendre la dernière minute.

## Terminé quand
- [ ] Soumission validée avant l'heure limite, tous les liens fonctionnent en navigation privée
- [ ] Chaque chiffre du pitch est vérifiable dans l'outil
- [ ] Le pitch tient dans le temps imposé, répété 3 fois, deux personnes capables de le faire
- [ ] Vidéo de secours prête

## Pièges
- Découvrir à H40 que la vidéo doit faire 30 secondes ou être en anglais : lis les règles à H3.
- Laisser l'équipe ajouter des fonctionnalités après H36.
