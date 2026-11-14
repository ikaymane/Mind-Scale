"""
NIRAN — FIRMS CSV → JSON du site (contrats 00_BRIEF_COMMUN.md §7).

Entrées : archives FIRMS dans ../../Data (CSV ou ZIP FIRMS « DL_FIRE_* »), MODIS et VIIRS.
          Capteur lu dans le fichier (colonnes satellite / instrument), pays lu dans le nom
          du fichier, sinon déduit de la position médiane des détections.
          MODIS = Terra + Aqua ; VIIRS = Suomi NPP + NOAA-20 (J1), chacun nettoyé puis fusionné.
Sorties : web/public/data/{regions.geojson, anomalies.json, cumulative[_VIIRS].json,
          globe_cells[_VIIRS].json, meta.json}, docs/NETTOYAGE.md

Régions : sans --regions, une région = un pays (ISO3).
          Avec --regions fichier.geojson (properties: region_id, name_fr, name_ar, name_en, country),
          chaque détection est rattachée à son polygone (point-dans-polygone).

Méthode anomalies = 02_M2_ANOMALIES.md : par région × mois de l'année, leave-one-out,
z robuste sur log1p(n) (médiane + MAD, plancher MAD), garde-fou « peu de feux ».

Usage : python pipeline/build_web_data.py [--src DIR] [--regions FILE]
"""
from __future__ import annotations

import argparse
import io
import sys
import json
import zipfile
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
# centre approximatif (lat, lon) pour reconnaître le pays d'un fichier sans nom de pays (DL_FIRE_*)
CENTERS = {"MAR": (31.5, -7.0), "AUS": (-25.0, 134.0), "BRA": (-10.0, -52.0)}
SENSORS = ("MODIS", "VIIRS")          # ordre d'affichage ; MODIS reste la référence (live, contexte)
SATELLITES = {"Terra": "MODIS", "Aqua": "MODIS", "T": "MODIS", "A": "MODIS",
              "N": "VIIRS", "SNPP": "VIIRS", "N20": "VIIRS", "J1": "VIIRS", "N21": "VIIRS", "J2": "VIIRS", "1": "VIIRS"}
MODIS_MIN_CONF = 30
VIIRS_DROP_CONF = {"l", "low"}         # VIIRS : confiance qualitative l / n / h → on garde n et h
PERSISTENT_DAYS = 60       # jours de détection / an au-delà desquels une cellule ~1 km est suspecte
PERSISTENT_YEARS = 2       # … pendant au moins N années → liste noire (site industriel)
STEP_LABELS_FR = {
    "raw": "Lignes brutes",
    "type0": "Type 0 uniquement (retire volcans, sources fixes, mer)",
    "confidence": f"Confiance MODIS ≥ {MODIS_MIN_CONF}",
    "confidenceViirs": "Confiance VIIRS nominale ou haute (retire « l »)",
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


def open_csv(path: Path):
    """Flux texte du CSV : fichier .csv, ou le .csv contenu dans un ZIP FIRMS (qui contient aussi Readme.txt)."""
    if path.suffix.lower() == ".zip":
        z = zipfile.ZipFile(path)
        name = next(n for n in z.namelist() if n.lower().endswith(".csv"))
        return io.TextIOWrapper(z.open(name), encoding="utf-8"), name
    return open(path, encoding="utf-8"), path.name


def read_file(path: Path) -> tuple[pd.DataFrame, str, str]:
    cols = ["latitude", "longitude", "acq_date", "satellite", "instrument", "confidence", "type"]
    f, inner = open_csv(path)
    with f:
        df = pd.read_csv(f, usecols=lambda c: c in cols,
                         dtype={"satellite": "category", "instrument": "category", "confidence": "str"})
    return df, inner, path.name


def sensor_of(df: pd.DataFrame) -> str:
    inst = df["instrument"].astype(str).str.upper() if "instrument" in df else pd.Series(dtype=str)
    if len(inst) and (inst == "MODIS").mean() > 0.5:
        return "MODIS"
    sats = df["satellite"].astype(str).value_counts() if "satellite" in df else pd.Series(dtype=int)
    if len(sats) and sats.index[0] in SATELLITES:
        return SATELLITES[sats.index[0]]
    if len(inst) and inst.isin(["VIIRS", "SNPP"]).mean() > 0.5:
        return "VIIRS"
    raise ValueError("capteur inconnu")


def country_of(path: Path, df: pd.DataFrame) -> str:
    stem = path.stem.lower()
    key = next((k for k in COUNTRIES if k in stem), None)
    if key:
        return COUNTRIES[key][0]
    lat, lon = float(df["latitude"].median()), float(df["longitude"].median())
    iso, dist = min(((iso, (lat - a) ** 2 + (lon - o) ** 2) for iso, (a, o) in CENTERS.items()), key=lambda t: t[1])
    if dist > 20 ** 2:
        raise ValueError(f"pays introuvable (médiane {lat:.1f}, {lon:.1f})")
    return iso


def clean_file(df: pd.DataFrame, sensor: str) -> tuple[pd.DataFrame, list[tuple[str, int]]]:
    """Étapes propres à chaque fichier : type 0 puis confiance (règle du capteur)."""
    steps = [("raw", len(df))]
    if "type" in df:
        df = df[df["type"] == 0]
        steps.append(("type0", len(df)))
    if sensor == "MODIS":
        if "instrument" in df:
            df = df[df["instrument"].astype(str).str.upper() == "MODIS"]
        df = df[pd.to_numeric(df["confidence"], errors="coerce") >= MODIS_MIN_CONF]
        steps.append(("confidence", len(df)))
    else:
        df = df[~df["confidence"].str.lower().isin(VIIRS_DROP_CONF)]
        steps.append(("confidenceViirs", len(df)))
    return df[["latitude", "longitude", "acq_date"]], steps


def finish(df: pd.DataFrame, iso3: str, sensor: str) -> tuple[pd.DataFrame, int]:
    """Dates + retrait des sites persistants, sur tous les satellites du capteur réunis."""
    d = pd.to_datetime(df["acq_date"], format="%Y-%m-%d")
    df = pd.DataFrame({
        "latitude": df["latitude"].to_numpy(), "longitude": df["longitude"].to_numpy(),
        "date": d.to_numpy(), "year": d.dt.year.to_numpy(), "month": d.dt.month.to_numpy(),
        "doy": d.dt.dayofyear.clip(upper=365).to_numpy(),
    })
    df["country"], df["sensor"] = iso3, sensor
    # Sources persistantes : cellule 0,01° (~1 km) qui « brûle » > 60 jours/an sur ≥ 2 ans
    cell = (np.round(df["latitude"].to_numpy() * 100).astype(np.int64) + 9000) * 100000 \
        + (np.round(df["longitude"].to_numpy() * 100).astype(np.int64) + 18000)
    days = pd.DataFrame({"cell": cell, "year": df["year"], "date": df["date"]}).drop_duplicates() \
        .groupby(["cell", "year"]).size()
    bad_years = (days > PERSISTENT_DAYS).groupby(level="cell").sum()
    blacklist = bad_years[bad_years >= PERSISTENT_YEARS].index.to_numpy()
    df = df[~np.isin(cell, blacklist)].reset_index(drop=True)
    return df, len(df)


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
    data_dir = ROOT.parent / "Data"
    ap.add_argument("--src", default=str(data_dir if data_dir.is_dir() else ROOT.parent),
                    help="dossier contenant les archives FIRMS (CSV ou ZIP)")
    ap.add_argument("--regions", default=None, help="GeoJSON des régions (optionnel)")
    ap.add_argument("--no-nasa", action="store_true", help="ne pas appeler GIBS / POWER (hors ligne)")
    args = ap.parse_args()

    regions_geo = json.loads(Path(args.regions).read_text(encoding="utf-8")) if args.regions else None
    names = {iso: (fr, ar, en) for iso, fr, ar, en in COUNTRIES.values()}
    parts: dict[tuple[str, str], list] = {}   # (pays, capteur) → [(fichier, df nettoyé, étapes)]
    src = Path(args.src)
    for path in sorted([*src.glob("*.csv"), *src.glob("*.zip")]):
        try:
            raw, inner, label = read_file(path)
            sensor, iso3 = sensor_of(raw), country_of(path, raw)
        except (ValueError, KeyError, StopIteration, zipfile.BadZipFile) as e:
            print(f"ignoré : {path.name} ({e})")
            continue
        sats = ", ".join(sorted(raw["satellite"].astype(str).unique())) if "satellite" in raw else "?"
        df, steps = clean_file(raw, sensor)
        del raw
        parts.setdefault((iso3, sensor), []).append((label, sats, df, steps))
        print(f"{path.name}: {iso3} {sensor} [{sats}] {steps[0][1]:,} → {steps[-1][1]:,}")

    frames, cleaning = [], {}
    for (iso3, sensor), items in sorted(parts.items()):
        df, kept = finish(pd.concat([it[2] for it in items], ignore_index=True), iso3, sensor)
        keys = list(dict.fromkeys(k for it in items for k, _ in it[3]))
        steps = [(k, sum(dict(it[3]).get(k, 0) for it in items)) for k in keys] + [("persistent", kept)]
        cleaning.setdefault(sensor, {})[iso3] = {
            "file": " + ".join(it[0] for it in items),
            "satellites": ", ".join(it[1] for it in items),
            "steps": steps,
        }
        frames.append(df)
        print(f"{iso3} {sensor}: {kept:,} détections gardées")
    df = pd.concat(frames, ignore_index=True)
    del frames, parts
    df["region_id"] = assign_regions(df, regions_geo)
    df = df.dropna(subset=["region_id"])
    sensors = [s for s in SENSORS if s in cleaning]
    names = {iso: names[iso] for iso in dict.fromkeys(c for s in sensors for c in cleaning[s])}
    # MODIS sert de référence pour l'emprise, la météo et la végétation (caches stables, comparables au live)
    ref = df[df["sensor"] == ("MODIS" if "MODIS" in sensors else sensors[0])]

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
        sub = ref[ref["region_id"] == p["region_id"]]
        if not len(sub):
            sub = df[df["region_id"] == p["region_id"]]
        if len(sub):
            lat_lo, lat_hi = sub["latitude"].quantile([0.005, 0.995])
            lon_lo, lon_hi = sub["longitude"].quantile([0.005, 0.995])
            p["bbox"] = [round(lon_lo - 0.5, 2), round(lat_lo - 0.5, 2), round(lon_hi + 0.5, 2), round(lat_hi + 0.5, 2)]
            p["center"] = [round((lat_lo + lat_hi) / 2, 2), round((lon_lo + lon_hi) / 2, 2)]

    # ---------- anomalies.json (grille complète, mois à zéro inclus) ----------
    counts = df.groupby(["sensor", "region_id", "year", "month"]).size()
    anomalies = []
    for sensor in sensors:
        for p in region_props:
            rid = p["region_id"]
            grid = np.zeros((len(years), 12), dtype=int)
            if (sensor, rid) in counts.index.droplevel([2, 3]):
                for (y, m), n in counts.loc[(sensor, rid)].items():
                    grid[years.index(y), m - 1] = n
            elif p.get("country") not in cleaning[sensor]:
                continue  # pas de fichier pour ce pays avec ce capteur
            for m in range(12):
                col = grid[:, m]
                for i, y in enumerate(years):
                    z, med, p10, p90, pct = robust_stats(col, i)
                    anomalies.append({
                        "region_id": rid, "sensor": sensor, "year": y, "month": m + 1, "n": int(col[i]),
                        "median": med, "p10": p10, "p90": p90, "z": round(z, 2), "percentile": pct,
                        "level": level_of(z, int(col[i]), med),
                    })

    OUT.mkdir(parents=True, exist_ok=True)
    dump = lambda name, obj: (OUT / name).write_text(json.dumps(obj, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")
    suffix = lambda s: "" if s == "MODIS" else f"_{s}"   # MODIS garde les noms de fichiers historiques
    dump("regions.geojson", regions_out)
    dump("anomalies.json", anomalies)
    rindex = {p["region_id"]: i for i, p in enumerate(region_props)}

    for sensor in sensors:
        sdf = df[df["sensor"] == sensor]
        # ---------- cumulative[_CAPTEUR].json ----------
        daily = sdf.groupby(["region_id", "year", "doy"]).size()
        cumulative = {}
        for p in region_props:
            rid = p["region_id"]
            if p.get("country") not in cleaning[sensor]:
                continue
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
        dump(f"cumulative{suffix(sensor)}.json", cumulative)

        # ---------- globe_cells[_CAPTEUR].json : détections agrégées en cellules de 0,5° ----------
        # cells = [lat, lon, indexRégion, k1, n1, d1, k2, n2, d2, …]
        # k = indexAnnée * 12 + (mois - 1), n = détections, d = premier jour du mois où la cellule brûle
        step = 0.5
        g = pd.DataFrame({
            "clat": ((sdf["latitude"] // step) * step + step / 2).round(3),
            "clon": ((sdf["longitude"] // step) * step + step / 2).round(3),
            "r": sdf["region_id"].map(rindex),
            "k": (sdf["year"] - years[0]) * 12 + sdf["month"] - 1,
            "day": sdf["date"].dt.day,
        }).groupby(["clat", "clon", "r", "k"])["day"].agg(["size", "min"]).reset_index()
        cells = {}
        for clat, clon, r, k, n, d in g.itertuples(index=False):
            cells.setdefault((clat, clon, int(r)), []).extend([int(k), int(n), int(d)])
        dump(f"globe_cells{suffix(sensor)}.json", {
            "step": step, "years": years, "regions": [p["region_id"] for p in region_props],
            "cells": [[la, lo, r, *v] for (la, lo, r), v in cells.items()],
        })
        print(f"{sensor}: {len(sdf):,} détections, {len(cells):,} cellules globe")

    dump("meta.json", {
        "generated": date.today().isoformat(),
        "data_until": df["date"].max().date().isoformat(),
        "first_year": years[0], "last_year": years[-1],
        "sensors": sensors,
        "region_level": "admin1" if regions_geo else "country",
        "cleaning": cleaning,
    })
    df = ref  # la suite (végétation, météo) reste sur le capteur de référence

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
    for sensor, iso, c in [(s, i, c) for s in sensors for i, c in cleaning[s].items()]:
        lines += [f"## {iso} · {sensor} ({c['satellites']}) — `{c['file']}`", "", "| Étape | Lignes restantes | Retirées | % retiré |", "|---|---:|---:|---:|"]
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
