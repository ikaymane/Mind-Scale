"""
NIRAN - M1/M2 : nettoyage FIRMS MODIS + nombre de feux par annee,
moyenne 5 ans (2020-2024) et regle d'anomalie (+20 % au-dessus de la moyenne).

Usage :
    python pipeline/clean.py                 # les 3 pays
    python pipeline/clean.py --country MAR   # un seul pays

Sorties (pipeline/out/) :
    hotspots_clean_{ISO3}.parquet   donnees propres (contrat 00_BRIEF section 7)
    hotspots_clean_{ISO3}.csv       idem, lignes confidence_ok uniquement
    feux_par_annee.csv              nb feux / annee + moyenne 5 ans + seuil +20 %
    feux_par_mois.csv               meme regle, mois par mois
    resultats_feux.xlsx             tout dans un classeur
    NETTOYAGE.md                    filtre -> lignes retirees -> %
"""
from __future__ import annotations

import argparse
from pathlib import Path

import numpy as np
import pandas as pd

ROOT = Path(__file__).resolve().parent.parent
OUT = ROOT / "pipeline" / "out"

SOURCES = {
    "MAR": ("Maroc", ROOT / "morocco_2020_2024.csv"),
    "AUS": ("Australie", ROOT / "australie_2020_2024.csv"),
    "BRA": ("Bresil", ROOT / "brazil_2020_2024.csv"),
}
YEARS = list(range(2020, 2025))
SEUIL = 0.20            # +20 % au-dessus de la moyenne
CONF_MIN = 30           # MODIS confidence >= 30
GRID = 0.25             # cellule MODIS du contrat
PERSIST_CELL = 0.01     # ~1 km
PERSIST_DAYS = 60       # > 60 jours de feu par an ...
PERSIST_YEARS = 2       # ... sur au moins 2 annees => site industriel


def load(path: Path) -> pd.DataFrame:
    return pd.read_csv(
        path,
        dtype={"acq_time": str, "satellite": str, "instrument": str, "daynight": str},
        engine="pyarrow",
    )


def clean(iso: str) -> tuple[pd.DataFrame, list[dict]]:
    name, path = SOURCES[iso]
    df = load(path)
    log: list[dict] = []

    def step(label: str, mask: pd.Series) -> None:
        nonlocal df
        before = len(df)
        df = df[mask].copy()
        log.append({"filtre": label, "retirees": before - len(df), "restantes": len(df)})

    log.append({"filtre": "Lignes brutes", "retirees": 0, "restantes": len(df)})

    # 1. Valeurs invalides : coordonnees, dates, FRP, annee hors periode
    df["date"] = pd.to_datetime(df["acq_date"], errors="coerce")
    valid = (
        df["latitude"].between(-90, 90)
        & df["longitude"].between(-180, 180)
        & df["date"].notna()
        & df["date"].dt.year.isin(YEARS)
        & (df["frp"].isna() | (df["frp"] >= 0))
        & df["confidence"].between(0, 100)
    )
    step("Coordonnees / dates / FRP / confiance invalides", valid)

    # 2. type == 0 (feu de vegetation presume)
    step("type != 0 (volcan, source statique, offshore)", df["type"] == 0)

    # 3. Doublons : meme capteur, meme date, meme position arrondie a 3 decimales
    df["_k_lat"] = df["latitude"].round(3)
    df["_k_lon"] = df["longitude"].round(3)
    # on garde la detection la plus confiante en cas de doublon
    df = df.sort_values("confidence", ascending=False)
    dup = df.duplicated(subset=["instrument", "acq_date", "_k_lat", "_k_lon"], keep="first")
    step("Doublons (capteur + date + position 3 dec.)", ~dup)

    # 4. Sources persistantes (~1 km, > 60 jours/an sur >= 2 ans)
    df["_pc"] = (
        (df["latitude"] / PERSIST_CELL).round().astype(int).astype(str)
        + "_"
        + (df["longitude"] / PERSIST_CELL).round().astype(int).astype(str)
    )
    days = df.groupby(["_pc", df["date"].dt.year])["acq_date"].nunique()
    hot_years = (days > PERSIST_DAYS).groupby(level=0).sum()
    blacklist = set(hot_years[hot_years >= PERSIST_YEARS].index)
    step(f"Sources persistantes ({len(blacklist)} cellules ~1 km en liste noire)",
         ~df["_pc"].isin(blacklist))

    # 5. Confiance : on garde la ligne mais on marque confidence_ok
    df["confidence_ok"] = df["confidence"] >= CONF_MIN
    n_low = int((~df["confidence_ok"]).sum())
    log.append({"filtre": f"Confiance < {CONF_MIN} (marquees confidence_ok=False, exclues des comptages)",
                "retirees": n_low, "restantes": int(df["confidence_ok"].sum())})

    # Format contrat
    lat_c = (np.floor(df["latitude"] / GRID) * GRID + GRID / 2).round(3)
    lon_c = (np.floor(df["longitude"] / GRID) * GRID + GRID / 2).round(3)
    out = pd.DataFrame({
        "lat": df["latitude"].round(4),
        "lon": df["longitude"].round(4),
        "date": df["date"].dt.strftime("%Y-%m-%d"),
        "year": df["date"].dt.year.astype("int16"),
        "month": df["date"].dt.month.astype("int8"),
        "acq_time": df["acq_time"].str.zfill(4),
        "sensor": "MODIS",
        "satellite": df["satellite"],
        "confidence": df["confidence"].astype("int16"),
        "confidence_ok": df["confidence_ok"],
        "frp": df["frp"],
        "daynight": df["daynight"],
        "country": iso,
        "region_id": pd.NA,   # a remplir avec regions.geojson de M3 (sjoin)
        "cell_id": "c_" + lat_c.astype(str) + "_" + lon_c.astype(str),
    }).sort_values(["date", "acq_time"]).reset_index(drop=True)

    raw = log[0]["restantes"]
    for r in log:
        r["pct_brut"] = round(100 * r["retirees"] / raw, 2) if raw else 0.0
        r["pays"] = name
    return out, log


def anomaly_table(counts: pd.DataFrame, keys: list[str]) -> pd.DataFrame:
    """counts: colonnes keys + year + nb_feux. Moyenne sur les 5 ans par groupe keys."""
    g = counts.groupby(keys)["nb_feux"]
    counts["moyenne_5ans"] = g.transform("mean").round(1)
    counts["seuil_+20%"] = (counts["moyenne_5ans"] * (1 + SEUIL)).round(1)
    counts["ecart_vs_moyenne_%"] = np.where(
        counts["moyenne_5ans"] > 0,
        (100 * (counts["nb_feux"] / counts["moyenne_5ans"] - 1)).round(1),
        np.nan,
    )
    counts["anomalie"] = counts["nb_feux"] > counts["seuil_+20%"]
    # Variante leave-one-out (recommandee par M2) : l'annee testee est exclue de sa moyenne
    n = g.transform("count")
    loo = (g.transform("sum") - counts["nb_feux"]) / (n - 1)
    counts["moyenne_autres_annees"] = loo.round(1)
    counts["anomalie_LOO"] = counts["nb_feux"] > loo * (1 + SEUIL)
    return counts


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--country", choices=list(SOURCES), nargs="*")
    args = ap.parse_args()
    isos = args.country or list(SOURCES)
    OUT.mkdir(parents=True, exist_ok=True)

    logs, yearly, monthly = [], [], []
    for iso in isos:
        name = SOURCES[iso][0]
        print(f"[{iso}] nettoyage ...")
        df, log = clean(iso)
        logs.extend(log)
        df.to_parquet(OUT / f"hotspots_clean_{iso}.parquet", index=False)
        ok = df[df["confidence_ok"]]
        ok.to_csv(OUT / f"hotspots_clean_{iso}.csv", index=False)
        print(f"[{iso}] {len(ok):,} feux retenus")

        # Grille complete (annees / mois a zero inclus)
        y = ok.groupby("year").size().reindex(YEARS, fill_value=0).rename("nb_feux").reset_index()
        y.insert(0, "pays", name)
        yearly.append(y)

        idx = pd.MultiIndex.from_product([range(1, 13), YEARS], names=["month", "year"])
        m = ok.groupby(["month", "year"]).size().reindex(idx, fill_value=0).rename("nb_feux").reset_index()
        m.insert(0, "pays", name)
        monthly.append(m)

    yearly_df = anomaly_table(pd.concat(yearly, ignore_index=True), ["pays"])
    monthly_df = anomaly_table(pd.concat(monthly, ignore_index=True), ["pays", "month"])
    monthly_df = monthly_df.sort_values(["pays", "year", "month"]).reset_index(drop=True)
    log_df = pd.DataFrame(logs)[["pays", "filtre", "retirees", "pct_brut", "restantes"]]

    yearly_df.to_csv(OUT / "feux_par_annee.csv", index=False)
    monthly_df.to_csv(OUT / "feux_par_mois.csv", index=False)
    with pd.ExcelWriter(OUT / "resultats_feux.xlsx") as xw:
        yearly_df.to_excel(xw, sheet_name="Par annee", index=False)
        monthly_df.to_excel(xw, sheet_name="Par mois", index=False)
        log_df.to_excel(xw, sheet_name="Nettoyage", index=False)

    write_report(log_df, yearly_df, monthly_df)
    print(yearly_df.to_string(index=False))


def md_table(df: pd.DataFrame) -> str:
    cols = list(df.columns)
    lines = ["| " + " | ".join(cols) + " |", "|" + "---|" * len(cols)]
    for _, r in df.iterrows():
        lines.append("| " + " | ".join(
            str(v) if c in ("year", "month") else f"{v:,}" if isinstance(v, (int, np.integer)) else str(v)
            for c, v in zip(cols, r)) + " |")
    return "\n".join(lines)


def write_report(log_df: pd.DataFrame, yearly: pd.DataFrame, monthly: pd.DataFrame) -> None:
    parts = [
        "# NETTOYAGE et anomalies - FIRMS MODIS 2020-2024\n",
        "Genere par `pipeline/clean.py`. Capteur : MODIS seul (Terra + Aqua), jamais melange avec VIIRS.\n",
        "## 1. Filtres appliques (dans l'ordre)\n",
        md_table(log_df.rename(columns={"pct_brut": "% du brut"})),
        "\n## 2. Nombre de feux par annee, moyenne 5 ans, seuil +20 %\n",
        "Regle : `anomalie = nb_feux > moyenne_5ans x 1,2`. "
        "Variante `anomalie_LOO` : moyenne calculee sans l'annee testee (evite qu'une annee extreme "
        "gonfle sa propre reference).\n",
        md_table(yearly[["pays", "year", "nb_feux", "moyenne_5ans", "seuil_+20%",
                         "ecart_vs_moyenne_%", "anomalie", "anomalie_LOO"]]),
        "\n## 3. Mois anormaux (meme regle, chaque mois compare au meme mois des 5 ans)\n",
        "Mois avec moins de 5 feux en moyenne exclus de cette liste (bruit).\n",
        md_table(monthly[(monthly["anomalie"]) & (monthly["moyenne_5ans"] >= 5)][
            ["pays", "year", "month", "nb_feux", "moyenne_5ans", "seuil_+20%", "ecart_vs_moyenne_%", "anomalie_LOO"]]),
        "\n## Limites\n",
        "- Nombre de detections != surface brulee : on parle d'activite des feux.\n",
        "- Nuages et fumee cachent des feux.\n",
        "- 5 ans = reference courte ; la moyenne inclut l'annee testee (voir variante LOO).\n",
        "- Collection MODIS 6.03 pour 2020-2022, 6.1 (61.03) pour 2023-2024 (meme capteur, ecarts mineurs ; a garder en tete pour 2023-2024).\n",
        "- `region_id` vide : a remplir par jointure spatiale avec `regions.geojson` (M3).\n",
    ]
    (OUT / "NETTOYAGE.md").write_text("\n".join(parts), encoding="utf-8")


if __name__ == "__main__":
    main()
