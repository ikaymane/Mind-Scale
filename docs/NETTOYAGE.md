# Nettoyage des données FIRMS (généré par pipeline/build_web_data.py)

## AUS · MODIS (Aqua, Terra, Aqua, Terra) — `australie_2020_2024.csv + modis_2025_Australia.csv`

| Étape | Lignes restantes | Retirées | % retiré |
|---|---:|---:|---:|
| Lignes brutes | 1 364 786 | 0 | 0.0 % |
| Type 0 uniquement (retire volcans, sources fixes, mer) | 1 353 862 | 10 924 | 0.8 % |
| Confiance MODIS ≥ 30 | 1 281 886 | 71 976 | 5.3 % |
| Retrait des sites persistants (> 60 j/an sur ≥ 2 ans) | 1 281 886 | 0 | 0.0 % |

## BRA · MODIS (Aqua, Terra, Aqua, Terra) — `brazil_2020_2024.csv + modis_2025_Brazil.csv`

| Étape | Lignes restantes | Retirées | % retiré |
|---|---:|---:|---:|
| Lignes brutes | 2 231 451 | 0 | 0.0 % |
| Type 0 uniquement (retire volcans, sources fixes, mer) | 2 200 317 | 31 134 | 1.4 % |
| Confiance MODIS ≥ 30 | 2 085 240 | 115 077 | 5.2 % |
| Retrait des sites persistants (> 60 j/an sur ≥ 2 ans) | 2 085 240 | 0 | 0.0 % |

## MAR · MODIS (Aqua, Terra, Aqua, Terra) — `modis_2025_Morocco.csv + morocco_2020_2024.csv`

| Étape | Lignes restantes | Retirées | % retiré |
|---|---:|---:|---:|
| Lignes brutes | 2 358 | 0 | 0.0 % |
| Type 0 uniquement (retire volcans, sources fixes, mer) | 2 281 | 77 | 3.3 % |
| Confiance MODIS ≥ 30 | 2 183 | 98 | 4.3 % |
| Retrait des sites persistants (> 60 j/an sur ≥ 2 ans) | 2 183 | 0 | 0.0 % |

## AUS · VIIRS (N20, SNPP, N20, N) — `DL_FIRE_J1V-C2_848248.zip + DL_FIRE_SV-C2_846115.zip + viirs-jpss1_2025_Australia.csv + viirs-snpp_2025_Australia.csv`

| Étape | Lignes restantes | Retirées | % retiré |
|---|---:|---:|---:|
| Lignes brutes | 13 116 553 | 0 | 0.0 % |
| Type 0 uniquement (retire volcans, sources fixes, mer) | 12 954 614 | 161 939 | 1.2 % |
| Confiance VIIRS nominale ou haute (retire « l ») | 11 672 375 | 1 282 239 | 9.9 % |
| Retrait des sites persistants (> 60 j/an sur ≥ 2 ans) | 11 670 801 | 1 574 | 0.0 % |

## BRA · VIIRS (N20, SNPP, N20, N) — `DL_FIRE_J1V-C2_848247.zip + DL_FIRE_SV-C2_846114.zip + viirs-jpss1_2025_Brazil.csv + viirs-snpp_2025_Brazil.csv`

| Étape | Lignes restantes | Retirées | % retiré |
|---|---:|---:|---:|
| Lignes brutes | 17 093 925 | 0 | 0.0 % |
| Type 0 uniquement (retire volcans, sources fixes, mer) | 16 884 483 | 209 442 | 1.2 % |
| Confiance VIIRS nominale ou haute (retire « l ») | 15 395 658 | 1 488 825 | 8.8 % |
| Retrait des sites persistants (> 60 j/an sur ≥ 2 ans) | 15 395 282 | 376 | 0.0 % |

## MAR · VIIRS (SNPP, N20, N, N20) — `DL_FIRE_SV-C2_846113.zip + viirs-jpss1_2025_Morocco.csv + viirs-snpp_2025_Morocco.csv + VIIRS_NOAA20_Morocco_2020-2024.csv`

| Étape | Lignes restantes | Retirées | % retiré |
|---|---:|---:|---:|
| Lignes brutes | 31 729 | 0 | 0.0 % |
| Type 0 uniquement (retire volcans, sources fixes, mer) | 23 960 | 7 769 | 24.5 % |
| Confiance VIIRS nominale ou haute (retire « l ») | 21 507 | 2 453 | 10.2 % |
| Retrait des sites persistants (> 60 j/an sur ≥ 2 ans) | 21 507 | 0 | 0.0 % |
