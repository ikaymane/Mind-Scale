# NETTOYAGE et anomalies - FIRMS MODIS 2020-2024

Genere par `pipeline/clean.py`. Capteur : MODIS seul (Terra + Aqua), jamais melange avec VIIRS.

## 1. Filtres appliques (dans l'ordre)

| pays | filtre | retirees | % du brut | restantes |
|---|---|---|---|---|
| Maroc | Lignes brutes | 0 | 0.0 | 2,113 |
| Maroc | Coordonnees / dates / FRP / confiance invalides | 0 | 0.0 | 2,113 |
| Maroc | type != 0 (volcan, source statique, offshore) | 65 | 3.08 | 2,048 |
| Maroc | Doublons (capteur + date + position 3 dec.) | 3 | 0.14 | 2,045 |
| Maroc | Sources persistantes (0 cellules ~1 km en liste noire) | 0 | 0.0 | 2,045 |
| Maroc | Confiance < 30 (marquees confidence_ok=False, exclues des comptages) | 83 | 3.93 | 1,962 |
| Australie | Lignes brutes | 0 | 0.0 | 1,109,450 |
| Australie | Coordonnees / dates / FRP / confiance invalides | 3 | 0.0 | 1,109,447 |
| Australie | type != 0 (volcan, source statique, offshore) | 9,619 | 0.87 | 1,099,828 |
| Australie | Doublons (capteur + date + position 3 dec.) | 806 | 0.07 | 1,099,022 |
| Australie | Sources persistantes (0 cellules ~1 km en liste noire) | 0 | 0.0 | 1,099,022 |
| Australie | Confiance < 30 (marquees confidence_ok=False, exclues des comptages) | 57,813 | 5.21 | 1,041,209 |
| Bresil | Lignes brutes | 0 | 0.0 | 1,994,720 |
| Bresil | Coordonnees / dates / FRP / confiance invalides | 1 | 0.0 | 1,994,719 |
| Bresil | type != 0 (volcan, source statique, offshore) | 26,365 | 1.32 | 1,968,354 |
| Bresil | Doublons (capteur + date + position 3 dec.) | 2,254 | 0.11 | 1,966,100 |
| Bresil | Sources persistantes (0 cellules ~1 km en liste noire) | 0 | 0.0 | 1,966,100 |
| Bresil | Confiance < 30 (marquees confidence_ok=False, exclues des comptages) | 105,103 | 5.27 | 1,860,997 |

## 2. Nombre de feux par annee, moyenne 5 ans, seuil +20 %

Regle : `anomalie = nb_feux > moyenne_5ans x 1,2`. Variante `anomalie_LOO` : moyenne calculee sans l'annee testee (evite qu'une annee extreme gonfle sa propre reference).

| pays | year | nb_feux | moyenne_5ans | seuil_+20% | ecart_vs_moyenne_% | anomalie | anomalie_LOO |
|---|---|---|---|---|---|---|---|
| Maroc | 2020 | 325 | 392.4 | 470.9 | -17.2 | 0 | 0 |
| Maroc | 2021 | 320 | 392.4 | 470.9 | -18.5 | 0 | 0 |
| Maroc | 2022 | 786 | 392.4 | 470.9 | 100.3 | 1 | 1 |
| Maroc | 2023 | 392 | 392.4 | 470.9 | -0.1 | 0 | 0 |
| Maroc | 2024 | 139 | 392.4 | 470.9 | -64.6 | 0 | 0 |
| Australie | 2020 | 144,556 | 208241.8 | 249890.2 | -30.6 | 0 | 0 |
| Australie | 2021 | 162,232 | 208241.8 | 249890.2 | -22.1 | 0 | 0 |
| Australie | 2022 | 150,872 | 208241.8 | 249890.2 | -27.5 | 0 | 0 |
| Australie | 2023 | 372,975 | 208241.8 | 249890.2 | 79.1 | 1 | 1 |
| Australie | 2024 | 210,574 | 208241.8 | 249890.2 | 1.1 | 0 | 0 |
| Bresil | 2020 | 377,508 | 372199.4 | 446639.3 | 1.4 | 0 | 0 |
| Bresil | 2021 | 318,002 | 372199.4 | 446639.3 | -14.6 | 0 | 0 |
| Bresil | 2022 | 338,885 | 372199.4 | 446639.3 | -9.0 | 0 | 0 |
| Bresil | 2023 | 334,354 | 372199.4 | 446639.3 | -10.2 | 0 | 0 |
| Bresil | 2024 | 492,248 | 372199.4 | 446639.3 | 32.3 | 1 | 1 |

## 3. Mois anormaux (meme regle, chaque mois compare au meme mois des 5 ans)

Mois avec moins de 5 feux en moyenne exclus de cette liste (bruit).

| pays | year | month | nb_feux | moyenne_5ans | seuil_+20% | ecart_vs_moyenne_% | anomalie_LOO |
|---|---|---|---|---|---|---|---|
| Australie | 2020 | 1 | 34,040 | 10722.4 | 12866.9 | 217.5 | 1 |
| Australie | 2020 | 2 | 6,252 | 3224.6 | 3869.5 | 93.9 | 1 |
| Australie | 2022 | 3 | 8,983 | 6698.0 | 8037.6 | 34.1 | 1 |
| Australie | 2023 | 3 | 12,419 | 6698.0 | 8037.6 | 85.4 | 1 |
| Australie | 2023 | 4 | 18,341 | 14895.2 | 17874.2 | 23.1 | 1 |
| Australie | 2023 | 5 | 32,241 | 22360.8 | 26833.0 | 44.2 | 1 |
| Australie | 2023 | 6 | 15,548 | 12652.0 | 15182.4 | 22.9 | 1 |
| Australie | 2023 | 8 | 18,501 | 14492.4 | 17390.9 | 27.7 | 1 |
| Australie | 2023 | 9 | 44,813 | 19332.4 | 23198.9 | 131.8 | 1 |
| Australie | 2023 | 10 | 118,883 | 42604.4 | 51125.3 | 179.0 | 1 |
| Australie | 2023 | 11 | 52,735 | 30974.6 | 37169.5 | 70.3 | 1 |
| Australie | 2023 | 12 | 40,186 | 15558.0 | 18669.6 | 158.3 | 1 |
| Australie | 2024 | 4 | 18,401 | 14895.2 | 17874.2 | 23.5 | 1 |
| Australie | 2024 | 11 | 41,262 | 30974.6 | 37169.5 | 33.2 | 1 |
| Bresil | 2020 | 3 | 7,762 | 6068.6 | 7282.3 | 27.9 | 1 |
| Bresil | 2020 | 4 | 7,163 | 5142.8 | 6171.4 | 39.3 | 1 |
| Bresil | 2020 | 10 | 76,616 | 60527.4 | 72632.9 | 26.6 | 1 |
| Bresil | 2022 | 5 | 12,749 | 10113.4 | 12136.1 | 26.1 | 1 |
| Bresil | 2023 | 11 | 54,691 | 31351.2 | 37621.4 | 74.4 | 1 |
| Bresil | 2023 | 12 | 19,246 | 13011.2 | 15613.4 | 47.9 | 1 |
| Bresil | 2024 | 1 | 8,043 | 5295.6 | 6354.7 | 51.9 | 1 |
| Bresil | 2024 | 2 | 8,606 | 4772.2 | 5726.6 | 80.3 | 1 |
| Bresil | 2024 | 3 | 10,336 | 6068.6 | 7282.3 | 70.3 | 1 |
| Bresil | 2024 | 6 | 22,887 | 16580.4 | 19896.5 | 38.0 | 1 |
| Bresil | 2024 | 7 | 34,988 | 26964.8 | 32357.8 | 29.8 | 1 |
| Bresil | 2024 | 8 | 118,705 | 81332.8 | 97599.4 | 45.9 | 1 |
| Bresil | 2024 | 9 | 154,895 | 111039.0 | 133246.8 | 39.5 | 1 |
| Bresil | 2024 | 11 | 40,139 | 31351.2 | 37621.4 | 28.0 | 1 |
| Bresil | 2024 | 12 | 18,186 | 13011.2 | 15613.4 | 39.8 | 1 |
| Maroc | 2020 | 2 | 30 | 15.6 | 18.7 | 92.3 | 1 |
| Maroc | 2020 | 3 | 10 | 8.0 | 9.6 | 25.0 | 1 |
| Maroc | 2020 | 9 | 90 | 32.0 | 38.4 | 181.2 | 1 |
| Maroc | 2020 | 10 | 38 | 31.6 | 37.9 | 20.3 | 1 |
| Maroc | 2021 | 10 | 53 | 31.6 | 37.9 | 67.7 | 1 |
| Maroc | 2021 | 11 | 27 | 22.4 | 26.9 | 20.5 | 1 |
| Maroc | 2021 | 12 | 16 | 10.4 | 12.5 | 53.8 | 1 |
| Maroc | 2022 | 1 | 16 | 12.6 | 15.1 | 27.0 | 1 |
| Maroc | 2022 | 5 | 30 | 16.6 | 19.9 | 80.7 | 1 |
| Maroc | 2022 | 6 | 10 | 7.8 | 9.4 | 28.2 | 1 |
| Maroc | 2022 | 7 | 467 | 140.0 | 168.0 | 233.6 | 1 |
| Maroc | 2022 | 8 | 130 | 81.2 | 97.4 | 60.1 | 1 |
| Maroc | 2022 | 10 | 41 | 31.6 | 37.9 | 29.7 | 1 |
| Maroc | 2022 | 11 | 37 | 22.4 | 26.9 | 65.2 | 1 |
| Maroc | 2023 | 1 | 16 | 12.6 | 15.1 | 27.0 | 1 |
| Maroc | 2023 | 4 | 41 | 14.2 | 17.0 | 188.7 | 1 |
| Maroc | 2023 | 6 | 12 | 7.8 | 9.4 | 53.8 | 1 |
| Maroc | 2023 | 8 | 108 | 81.2 | 97.4 | 33.0 | 1 |
| Maroc | 2024 | 3 | 10 | 8.0 | 9.6 | 25.0 | 1 |

## Limites

- Nombre de detections != surface brulee : on parle d'activite des feux.

- Nuages et fumee cachent des feux.

- 5 ans = reference courte ; la moyenne inclut l'annee testee (voir variante LOO).

- Collection MODIS 6.03 pour 2020-2022, 6.1 (61.03) pour 2023-2024 (meme capteur, ecarts mineurs ; a garder en tete pour 2023-2024).

- `region_id` vide : a remplir par jointure spatiale avec `regions.geojson` (M3).
