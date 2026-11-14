# Nettoyage des données FIRMS (généré par pipeline/build_web_data.py)

## AUS · MODIS (Aqua, Terra) — `australie_2020_2024.csv`

| Étape | Lignes restantes | Retirées | % retiré |
|---|---:|---:|---:|
| Lignes brutes | 1 109 450 | 0 | 0.0 % |
| Type 0 uniquement (retire volcans, sources fixes, mer) | 1 099 831 | 9 619 | 0.9 % |
| Confiance MODIS ≥ 30 | 1 041 916 | 57 915 | 5.3 % |
| Retrait des sites persistants (> 60 j/an sur ≥ 2 ans) | 1 041 916 | 0 | 0.0 % |

## BRA · MODIS (Aqua, Terra) — `brazil_2020_2024.csv`

| Étape | Lignes restantes | Retirées | % retiré |
|---|---:|---:|---:|
| Lignes brutes | 1 994 720 | 0 | 0.0 % |
| Type 0 uniquement (retire volcans, sources fixes, mer) | 1 968 355 | 26 365 | 1.3 % |
| Confiance MODIS ≥ 30 | 1 863 054 | 105 301 | 5.3 % |
| Retrait des sites persistants (> 60 j/an sur ≥ 2 ans) | 1 863 054 | 0 | 0.0 % |

## MAR · MODIS (Aqua, Terra) — `morocco_2020_2024.csv`

| Étape | Lignes restantes | Retirées | % retiré |
|---|---:|---:|---:|
| Lignes brutes | 2 113 | 0 | 0.0 % |
| Type 0 uniquement (retire volcans, sources fixes, mer) | 2 048 | 65 | 3.1 % |
| Confiance MODIS ≥ 30 | 1 964 | 84 | 4.1 % |
| Retrait des sites persistants (> 60 j/an sur ≥ 2 ans) | 1 964 | 0 | 0.0 % |

## AUS · VIIRS (N20, SNPP) — `DL_FIRE_J1V-C2_848248.zip + DL_FIRE_SV-C2_846115.zip`

| Étape | Lignes restantes | Retirées | % retiré |
|---|---:|---:|---:|
| Lignes brutes | 10 617 264 | 0 | 0.0 % |
| Type 0 uniquement (retire volcans, sources fixes, mer) | 10 478 310 | 138 954 | 1.3 % |
| Confiance VIIRS nominale ou haute (retire « l ») | 9 425 273 | 1 053 037 | 10.0 % |
| Retrait des sites persistants (> 60 j/an sur ≥ 2 ans) | 9 424 491 | 782 | 0.0 % |

## BRA · VIIRS (N20, SNPP) — `DL_FIRE_J1V-C2_848247.zip + DL_FIRE_SV-C2_846114.zip`

| Étape | Lignes restantes | Retirées | % retiré |
|---|---:|---:|---:|
| Lignes brutes | 15 378 395 | 0 | 0.0 % |
| Type 0 uniquement (retire volcans, sources fixes, mer) | 15 200 934 | 177 461 | 1.2 % |
| Confiance VIIRS nominale ou haute (retire « l ») | 13 884 286 | 1 316 648 | 8.7 % |
| Retrait des sites persistants (> 60 j/an sur ≥ 2 ans) | 13 883 912 | 374 | 0.0 % |

## MAR · VIIRS (SNPP, N20) — `DL_FIRE_SV-C2_846113.zip + VIIRS_NOAA20_Morocco_2020-2024.csv`

| Étape | Lignes restantes | Retirées | % retiré |
|---|---:|---:|---:|
| Lignes brutes | 27 584 | 0 | 0.0 % |
| Type 0 uniquement (retire volcans, sources fixes, mer) | 21 059 | 6 525 | 23.7 % |
| Confiance VIIRS nominale ou haute (retire « l ») | 18 903 | 2 156 | 10.2 % |
| Retrait des sites persistants (> 60 j/an sur ≥ 2 ans) | 18 903 | 0 | 0.0 % |
