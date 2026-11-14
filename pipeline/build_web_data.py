"""
NIRAN — FIRMS CSV → JSON du site (contrats 00_BRIEF_COMMUN.md §7).

Entrées : CSV d'archive FIRMS (MODIS), un par pays, ex. ../morocco_2020_2024.csv
Sorties : web/public/data/{regions.geojson, anomalies.json, cumulative.json, meta.json}
          docs/NETTOYAGE.md

Régions : sans --regions, une région = un pays (ISO3).
          Avec --regions fichier.geojson (properties: region_id, name_fr, name_ar, name_en, country),
          chaque détection est rattachée à son polygone (point-dans-polygone).

Méthode anomalies = 02_M2_ANOMALIES.md : par région × mois de l'année, leave-one-out,
z robuste sur log1p(n) (médiane + MAD, plancher MAD), garde-fou « peu de feux ».

Usage : python pipeline/build_web_data.py [--src DIR] [--regions FILE]
"""
from __future__ import annotations

import argparse
import sys
import json
from datetime import date
from pathlib import Path

import numpy as np
import pandas as pd

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "web" / "public" / "data"
DOCS = ROOT / "docs"

COUNTRIES = {
    # fichier → (ISO3, fr, ar, en)
    "morocco": ("MAR", "Maroc", "المغرب", "Morocco"),
    "australie": ("AUS", "Australie", "أستراليا", "Australia"),
    "australia": ("AUS", "Australie", "أستراليا", "Australia"),
    "brazil": ("BRA", "Brésil", "البرازيل", "Brazil"),
    "bresil": ("BRA", "Brésil", "البرازيل", "Brazil"),
}
MODIS_MIN_CONF = 30
PERSISTENT_DAYS = 60       # jours de détection / an au-delà desquels une cellule ~1 km est suspecte
PERSISTENT_YEARS = 2       # … pendant au moins N années → liste noire (site industriel)
STEP_LABELS_FR = {
    "raw": "Lignes brutes",
    "type0": "Type 0 uniquement (retire volcans, sources fixes, mer)",
    "confidence": f"Confiance MODIS ≥ {MODIS_MIN_CONF}",
    "persistent": f"Retrait des sites persistants (> {PERSISTENT_DAYS} j/an sur ≥ {PERSISTENT_YEARS} ans)",
}
MAD_FLOOR = 0.5 / 1.4826   # plancher : 1.4826 × MAD ≥ 0.5
FEW_FIRES = 5


def level_of(z: float, n: int, med: float) -> str:
    if med < FEW_FIRES and n < FEW_FIRES:
        return "normal"
    if z < -1:
        return "low"
    if z < 1:
        return "normal"
    if z < 2:
        return "high"
    if z < 3:
        return "unusual"
    return "extreme"


def load_country(path: Path, iso3: str) -> tuple[pd.DataFrame, list[tuple[str, int]]]:
    cols = ["latitude", "longitude", "acq_date", "instrument", "confidence", "frp", "daynight", "type"]
    df = pd.read_csv(path, usecols=lambda c: c in cols)
    steps = [("raw", len(df))]
    if "type" in df:
        df = df[df["type"] == 0]
        steps.append(("type0", len(df)))
    if "instrument" in df:
        df = df[df["instrument"].str.upper() == "MODIS"]
    df = df[pd.to_numeric(df["confidence"], errors="coerce") >= MODIS_MIN_CONF]
    steps.append(("confidence", len(df)))

    d = pd.to_datetime(df["acq_date"])
    df = df.assign(date=d, year=d.dt.year, month=d.dt.month, doy=d.dt.dayofyear.clip(upper=365), country=iso3)
    # Sources persistantes : cellule 0,01° (~1 km) qui « brûle » > 60 jours/an sur ≥ 2 ans
    cell = (df["latitude"].round(2).astype(str) + "_" + df["longitude"].round(2).astype(str))
    days = df.assign(cell=cell).groupby(["cell", "year"])["date"].nunique()
    bad_years = (days > PERSISTENT_DAYS).groupby(level="cell").sum()
    blacklist = set(bad_years[bad_years >= PERSISTENT_YEARS].index)
    df = df[~cell.isin(blacklist)]
    steps.append(("persistent", len(df)))
    return df, steps


def assign_regions(df: pd.DataFrame, regions_geo: dict | None) -> pd.Series:
    if regions_geo is None:
        return df["country"]
    from matplotlib.path import Path as MplPath

    rid = pd.Series(pd.NA, index=df.index, dtype="object")
    pts = df[["longitude", "latitude"]].to_numpy()
    for f in regions_geo["features"]:
        g, p = f["geometry"], f["properties"]
        if not g:
            continue
        polys = g["coordinates"] if g["type"] == "MultiPolygon" else [g["coordinates"]]
        todo = rid.isna().to_numpy()
        if not todo.any():
            break
        inside = np.zeros(len(df), dtype=bool)
        for poly in polys:
            outer = MplPath(np.asarray(poly[0]))
            hit = outer.contains_points(pts[todo])
            for hole in poly[1:]:
                hit &= ~MplPath(np.asarray(hole)).contains_points(pts[todo])
            inside[np.flatnonzero(todo)[hit]] = True
        rid[inside & todo] = p["region_id"]
    return rid


def robust_stats(series: np.ndarray, i: int) -> tuple[float, int, int, int, int]:
    """z, médiane, p10, p90, percentile pour l'élément i (leave-one-out)."""
    n = series[i]
    others = np.delete(series, i)
    logs = np.log1p(others)
    med = np.median(logs)
    mad = max(np.median(np.abs(logs - med)), MAD_FLOOR)
    z = (np.log1p(n) - med) / (1.4826 * mad)
    pct = 100 * ((others < n).sum() + (others == n).sum() / 2) / len(others)
    return float(z), int(round(np.median(others))), int(round(np.percentile(others, 10))), int(round(np.percentile(others, 90))), int(round(pct))


def main() -> None:
    sys.stdout.reconfigure(encoding="utf-8")
    ap = argparse.ArgumentParser()
    ap.add_argument("--src", default=str(ROOT.parent), help="dossier contenant les CSV FIRMS")
    ap.add_argument("--regions", default=None, help="GeoJSON des régions (optionnel)")
    ap.add_argument("--no-nasa", action="store_true", help="ne pas appeler GIBS / POWER (hors ligne)")
    args = ap.parse_args()

    regions_geo = json.loads(Path(args.regions).read_text(encoding="utf-8")) if args.regions else None
    frames, cleaning = [], {}
    names = {}
    for csv in sorted(Path(args.src).glob("*.csv")):
        key = next((k for k in COUNTRIES if csv.stem.lower().startswith(k)), None)
        if not key:
            print(f"ignoré (pays inconnu) : {csv.name}")
            continue
        iso3, fr, ar, en = COUNTRIES[key]
        df, steps = load_country(csv, iso3)
        cleaning[iso3] = {"file": csv.name, "steps": steps}
        names[iso3] = (fr, ar, en)
        frames.append(df)
        print(f"{csv.name}: {steps[0][1]} → {steps[-1][1]} détections gardées")
    df = pd.concat(frames, ignore_index=True)
    df["region_id"] = assign_regions(df, regions_geo)
    df = df.dropna(subset=["region_id"])

    years = list(range(int(df["year"].min()), int(df["year"].max()) + 1))
    if regions_geo is None:
        region_props = [
            {"region_id": iso, "name_fr": n[0], "name_ar": n[1], "name_en": n[2], "country": iso}
            for iso, n in names.items()
        ]
        regions_out = {"type": "FeatureCollection", "features": [{"type": "Feature", "properties": p, "geometry": None} for p in region_props]}
    else:
        region_props = [f["properties"] for f in regions_geo["features"]]
        regions_out = regions_geo

    # ---------- emprise de chaque région (centre + boîte) pour le globe ----------
    for p in region_props:
        sub = df[df["region_id"] == p["region_id"]]
        if len(sub):
            lat_lo, lat_hi = sub["latitude"].quantile([0.005, 0.995])
            lon_lo, lon_hi = sub["longitude"].quantile([0.005, 0.995])
            p["bbox"] = [round(lon_lo - 0.5, 2), round(lat_lo - 0.5, 2), round(lon_hi + 0.5, 2), round(lat_hi + 0.5, 2)]
            p["center"] = [round((lat_lo + lat_hi) / 2, 2), round((lon_lo + lon_hi) / 2, 2)]

    # ---------- anomalies.json (grille complète, mois à zéro inclus) ----------
    counts = df.groupby(["region_id", "year", "month"]).size()
    anomalies = []
    for p in region_props:
        rid = p["region_id"]
        grid = np.zeros((len(years), 12), dtype=int)
        if rid in counts.index.get_level_values(0):
            for (y, m), n in counts.loc[rid].items():
                grid[years.index(y), m - 1] = n
        for m in range(12):
            col = grid[:, m]
            for i, y in enumerate(years):
                z, med, p10, p90, pct = robust_stats(col, i)
                anomalies.append({
                    "region_id": rid, "sensor": "MODIS", "year": y, "month": m + 1, "n": int(col[i]),
                    "median": med, "p10": p10, "p90": p90, "z": round(z, 2), "percentile": pct,
                    "level": level_of(z, int(col[i]), med),
                })

    # ---------- cumulative.json ----------
    daily = df.groupby(["region_id", "year", "doy"]).size()
    cumulative = {}
    for p in region_props:
        rid = p["region_id"]
        ys = {}
        for y in years:
            arr = np.zeros(365, dtype=int)
            try:
                s = daily.loc[(rid, y)]
                arr[s.index.to_numpy() - 1] = s.to_numpy()
            except KeyError:
                pass
            ys[str(y)] = np.cumsum(arr).tolist()
        mat = np.array(list(ys.values()))
        env = [
            {"doy": d + 1, "p10": int(round(np.percentile(mat[:, d], 10))), "p50": int(round(np.median(mat[:, d]))), "p90": int(round(np.percentile(mat[:, d], 90)))}
            for d in range(365)
        ]
        cumulative[rid] = {"envelope": env, "years": ys}

    OUT.mkdir(parents=True, exist_ok=True)
    dump = lambda name, obj: (OUT / name).write_text(json.dumps(obj, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")
    dump("regions.geojson", regions_out)
    dump("anomalies.json", anomalies)
    dump("cumulative.json", cumulative)
    dump("meta.json", {
        "generated": date.today().isoformat(),
        "data_until": df["date"].max().date().isoformat(),
        "first_year": years[0], "last_year": years[-1],
        "sensors": ["MODIS"],
        "region_level": "admin1" if regions_geo else "country",
        "cleaning": cleaning,
    })

    # ---------- globe_cells.json : détections agrégées en cellules de 0,5° ----------
    # cells = [lat, lon, indexRégion, k1, n1, d1, k2, n2, d2, …]
    # k = indexAnnée * 12 + (mois - 1), n = détections, d = premier jour du mois où la cellule brûle
    step = 0.5
    g = df.assign(
        clat=((df["latitude"] // step) * step + step / 2).round(3),
        clon=((df["longitude"] // step) * step + step / 2).round(3),
        k=(df["year"] - years[0]) * 12 + df["month"] - 1,
        day=df["date"].dt.day,
    ).groupby(["clat", "clon", "region_id", "k"])["day"].agg(["size", "min"])
    rindex = {p["region_id"]: i for i, p in enumerate(region_props)}
    cells = {}
    for (clat, clon, rid, k), row in g.iterrows():
        cells.setdefault((clat, clon, rindex[rid]), []).extend([int(k), int(row["size"]), int(row["min"])])
    dump("globe_cells.json", {
        "step": step, "years": years, "regions": [p["region_id"] for p in region_props],
        "cells": [[la, lo, r, *v] for (la, lo, r), v in cells.items()],
    })

    # ---------- NASA GIBS (land cover MODIS) + NASA POWER (météo) -> context.json ----------
    if not args.no_nasa:
        import nasa_sources as nasa

        print("NASA GIBS : occupation du sol MODIS (MCD12Q1)…")
        df["cover"] = nasa.cover_groups(df, years)
        nasa.write_forest_mask(OUT / "forest_mask.png")
        cover = df.groupby(["region_id", "year", "month", "cover"]).size().unstack(fill_value=0)
        context = []
        for p in region_props:
            rid = p["region_id"]
            sub = df[df["region_id"] == rid]
            # 4 zones de feu principales (cellules de 1°) = où l'on mesure la météo
            top = (sub.assign(a=sub["latitude"].round(0), o=sub["longitude"].round(0))
                   .groupby(["a", "o"]).size().nlargest(4).index.tolist())
            print(f"NASA POWER : {rid} {top}")
            weather = nasa.weather_context([(float(a), float(o)) for a, o in top], years, years[-1])
            p["weather_points"] = [[float(a), float(o)] for a, o in top]
            for y in years:
                for m in range(1, 13):
                    row = {"region_id": rid, "year": y, "month": m, **weather.get((y, m), {})}
                    if (rid, y, m) in cover.index:
                        c = cover.loc[(rid, y, m)]
                        tot = int(c.sum())
                        if tot:
                            row["landcover"] = {g: round(float(c.get(g, 0)) / tot, 3) for g in ("forest", "shrub", "cropland", "other")}
                            row["fires_classified"] = tot
                    context.append(row)
        dump("context.json", context)
        dump("regions.geojson", regions_out)  # avec weather_points
        try:
            print(f"NASA EONET : {nasa.eonet_snapshot(OUT / 'eonet.json')} feux ouverts")
        except Exception as e:  # le site appelle aussi EONET en direct
            print(f"NASA EONET indisponible : {e}")

    # ---------- docs/NETTOYAGE.md ----------
    DOCS.mkdir(exist_ok=True)
    lines = ["# Nettoyage des données FIRMS (généré par pipeline/build_web_data.py)", ""]
    for iso, c in cleaning.items():
        lines += [f"## {iso} — `{c['file']}`", "", "| Étape | Lignes restantes | Retirées | % retiré |", "|---|---:|---:|---:|"]
        prev = c["steps"][0][1]
        for key, n in c["steps"]:
            label = STEP_LABELS_FR[key]
            fmt = lambda v: f"{v:,}".replace(",", " ")
            lines.append(f"| {label} | {fmt(n)} | {fmt(prev - n)} | {100 * (prev - n) / max(prev, 1):.1f} % |")
            prev = n
        lines.append("")
    (DOCS / "NETTOYAGE.md").write_text("\n".join(lines), encoding="utf-8")

    lv = pd.Series([a["level"] for a in anomalies]).value_counts().to_dict()
    print(f"régions={len(region_props)} années={years[0]}–{years[-1]} lignes anomalies={len(anomalies)} niveaux={lv}")


if __name__ == "__main__":
    main()
