# Nettoyage des données FIRMS (généré par pipeline/build_web_data.py)

## AUS — `australie_2020_2024.csv`

| Étape | Lignes restantes | Retirées | % retiré |
|---|---:|---:|---:|
| Lignes brutes | 1 109 450 | 0 | 0.0 % |
| Type 0 uniquement (retire volcans, sources fixes, mer) | 1 099 831 | 9 619 | 0.9 % |
| Confiance MODIS ≥ 30 | 1 041 916 | 57 915 | 5.3 % |
| Retrait des sites persistants (> 60 j/an sur ≥ 2 ans) | 1 041 916 | 0 | 0.0 % |

## BRA — `brazil_2020_2024.csv`

| Étape | Lignes restantes | Retirées | % retiré |
|---|---:|---:|---:|
| Lignes brutes | 1 994 720 | 0 | 0.0 % |
| Type 0 uniquement (retire volcans, sources fixes, mer) | 1 968 355 | 26 365 | 1.3 % |
| Confiance MODIS ≥ 30 | 1 863 054 | 105 301 | 5.3 % |
| Retrait des sites persistants (> 60 j/an sur ≥ 2 ans) | 1 863 054 | 0 | 0.0 % |

## MAR — `morocco_2020_2024.csv`

| Étape | Lignes restantes | Retirées | % retiré |
|---|---:|---:|---:|
| Lignes brutes | 2 113 | 0 | 0.0 % |
| Type 0 uniquement (retire volcans, sources fixes, mer) | 2 048 | 65 | 3.1 % |
| Confiance MODIS ≥ 30 | 1 964 | 84 | 4.1 % |
| Retrait des sites persistants (> 60 j/an sur ≥ 2 ans) | 1 964 | 0 | 0.0 % |
