"""KPI feux - donnees nettoyees (Desktop/cleaned).

nb feux par annee, moyenne 5 ans (2020-2024), seuil d'anomalie = moyenne x 1,2.
anomalie = nb_feux > seuil. Variante LOO : moyenne sans l'annee testee.
Toutes les detections type 0 comptees (confiance basse incluse).
"""
from pathlib import Path

import numpy as np
import pandas as pd

DIR = Path(__file__).resolve().parent
FILES = {
    "Maroc": "morocco_2020_2024_clean.csv",
    "Australie": "australie_2020_2024_clean.csv",
    "Bresil": "brazil_2020_2024_clean.csv",
}
YEARS = list(range(2020, 2025))
SEUIL = 0.20

rows = []
for pays, f in FILES.items():
    d = pd.read_csv(DIR / f, usecols=["acq_date"])
    y = pd.to_datetime(d["acq_date"]).dt.year.value_counts().reindex(YEARS, fill_value=0)
    rows += [{"pays": pays, "year": yr, "nb_feux": int(n)} for yr, n in y.items()]

k = pd.DataFrame(rows)
g = k.groupby("pays")["nb_feux"]
k["moyenne_5ans"] = g.transform("mean").round(1)
k["seuil_+20%"] = (k["moyenne_5ans"] * (1 + SEUIL)).round(1)
k["ecart_vs_moyenne_%"] = (100 * (k["nb_feux"] / k["moyenne_5ans"] - 1)).round(1)
k["anomalie"] = k["nb_feux"] > k["seuil_+20%"]
loo = (g.transform("sum") - k["nb_feux"]) / (g.transform("count") - 1)
k["moyenne_autres_annees"] = loo.round(1)
k["anomalie_LOO"] = k["nb_feux"] > loo * (1 + SEUIL)

k.to_csv(DIR / "kpi_feux_par_annee.csv", index=False)
print(k.to_string(index=False))
