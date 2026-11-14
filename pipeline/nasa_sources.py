"""
NASA sources used next to the FIRMS archive (all open, no key):

- NASA GIBS  : MODIS land cover (MCD12Q1, IGBP classes, yearly) as an image, decoded with its
               official colour map  -> share of fire detections in forest / shrub / cropland,
               and a forest mask for the globe.
- NASA POWER : monthly temperature, rain, humidity, wind at each country's main fire areas
               -> "Why?" block (anomaly vs the same month 2001-2024).

Downloads are cached in pipeline/cache/ (ignored by git).
"""
from __future__ import annotations

import io
import json
import time
import urllib.request
from pathlib import Path

import numpy as np

CACHE = Path(__file__).resolve().parent / "cache"
GIBS_WMS = (
    "https://gibs.earthdata.nasa.gov/wms/epsg4326/best/wms.cgi?SERVICE=WMS&REQUEST=GetMap&VERSION=1.1.1"
    "&SRS=EPSG:4326&STYLES=&BBOX=-180,-90,180,90&FORMAT=image/png&TRANSPARENT=TRUE"
    "&LAYERS=MODIS_Combined_L3_IGBP_Land_Cover_Type_Annual&WIDTH=8192&HEIGHT=4096&TIME={year}-01-01"
)
LC_W, LC_H = 8192, 4096
LC_LAST_YEAR = 2024
POWER = (
    "https://power.larc.nasa.gov/api/temporal/monthly/point?parameters=T2M,PRECTOTCORR,RH2M,WS2M"
    "&community=AG&longitude={lon}&latitude={lat}&start=2001&end={end}&format=JSON"
)

# Official GIBS colour map (colormaps/v1.3/MODIS_IGBP_Land_Cover_Type.xml), index = legend id
IGBP_RGB = [
    (33, 138, 33), (49, 204, 49), (152, 204, 49), (150, 250, 150), (141, 186, 141),  # 0-4 forests
    (186, 141, 141), (245, 222, 179), (218, 235, 157), (255, 213, 0), (240, 185, 103),  # 5-9 shrub, savanna, grass
    (71, 131, 181), (250, 239, 115), (255, 0, 0), (153, 147, 86), (255, 255, 255),  # 10 wetland, 11 crop, 12 urban, 13 mosaic, 14 snow
    (191, 191, 189), (134, 202, 227), (100, 100, 100),  # 15 barren, 16 water, 17 unclassified
]
GROUP = {**{i: "forest" for i in range(5)}, **{i: "shrub" for i in (5, 6, 7, 8, 9)}, 11: "cropland", 13: "cropland"}


def fetch(url: str, path: Path, tries: int = 3) -> bytes:
    if path.exists() and path.stat().st_size > 0:
        return path.read_bytes()
    path.parent.mkdir(parents=True, exist_ok=True)
    for i in range(tries):
        try:
            req = urllib.request.Request(url, headers={"User-Agent": "niran-pipeline"})
            with urllib.request.urlopen(req, timeout=120) as r:
                data = r.read()
            path.write_bytes(data)
            return data
        except Exception:
            if i == tries - 1:
                raise
            time.sleep(2 + 3 * i)
    raise RuntimeError(url)


# ------------------------------------------------------------------ land cover
def land_cover_classes(year: int) -> np.ndarray:
    """IGBP class index per pixel (uint8, 255 = no data) for the global 8192x4096 grid."""
    from PIL import Image

    y = min(max(year, 2001), LC_LAST_YEAR)
    npy = CACHE / f"igbp_{y}.npy"
    if npy.exists():
        return np.load(npy)
    png = fetch(GIBS_WMS.format(year=y), CACHE / f"igbp_{y}.png")
    rgba = np.asarray(Image.open(io.BytesIO(png)).convert("RGBA"))
    key = (rgba[..., 0].astype(np.int32) << 16) | (rgba[..., 1].astype(np.int32) << 8) | rgba[..., 2]
    cls = np.full(key.shape, 255, dtype=np.uint8)
    for i, (r, g, b) in enumerate(IGBP_RGB):
        cls[key == ((r << 16) | (g << 8) | b)] = i
    cls[rgba[..., 3] == 0] = 255
    np.save(npy, cls)
    return cls


def pixel_of(lat: np.ndarray, lon: np.ndarray) -> tuple[np.ndarray, np.ndarray]:
    x = np.clip(((lon + 180) / 360 * LC_W).astype(int), 0, LC_W - 1)
    y = np.clip(((90 - lat) / 180 * LC_H).astype(int), 0, LC_H - 1)
    return y, x


def cover_groups(df, years: list[int]) -> np.ndarray:
    """Land cover group of each detection, using the land cover map of its own year."""
    out = np.empty(len(df), dtype=object)
    for y in years:
        m = (df["year"] == y).to_numpy()
        if not m.any():
            continue
        cls = land_cover_classes(y)
        py, px = pixel_of(df.loc[m, "latitude"].to_numpy(), df.loc[m, "longitude"].to_numpy())
        out[m] = [GROUP.get(int(c), "other") for c in cls[py, px]]
    return out


def write_forest_mask(path: Path, year: int = LC_LAST_YEAR) -> None:
    """Transparent PNG: forest (deep green) and shrub/savanna (olive) — fuel the globe shows on zoom."""
    from PIL import Image

    cls = land_cover_classes(year)
    rgba = np.zeros((*cls.shape, 4), dtype=np.uint8)
    forest = cls <= 4
    shrub = np.isin(cls, [5, 7])  # closed shrublands + woody savannas: most fire-prone after forest
    rgba[forest] = (46, 196, 120, 255)
    rgba[shrub] = (186, 196, 90, 160)
    Image.fromarray(rgba, "RGBA").save(path, optimize=True)


# ------------------------------------------------------------------ weather
def power_monthly(lat: float, lon: float, end: int) -> dict[str, dict[str, float]]:
    url = POWER.format(lat=round(lat, 2), lon=round(lon, 2), end=end)
    data = json.loads(fetch(url, CACHE / f"power_{lat:.2f}_{lon:.2f}_{end}.json"))
    return data["properties"]["parameter"]


def weather_context(points: list[tuple[float, float]], years: list[int], end: int) -> dict[tuple[int, int], dict]:
    """Mean over the fire-area points of each month, and its anomaly vs the same month 2001-end."""
    series = [power_monthly(la, lo, end) for la, lo in points]
    out = {}
    for y in years:
        for m in range(1, 13):
            k = f"{y}{m:02d}"
            vals = {}
            for p in ("T2M", "PRECTOTCORR", "RH2M", "WS2M"):
                cur, clim = [], []
                for s in series:
                    v = s[p].get(k)
                    if v is None or v <= -999:
                        continue
                    ref = [s[p][f"{yy}{m:02d}"] for yy in range(2001, end + 1) if s[p].get(f"{yy}{m:02d}", -999) > -999]
                    cur.append(v)
                    clim.append(np.mean(ref))
                if cur:
                    vals[p] = (float(np.mean(cur)), float(np.mean(clim)))
            if "T2M" in vals:
                t, tc = vals["T2M"]
                row = {"t2m": round(t, 1), "t2m_anom": round(t - tc, 1)}
                if "PRECTOTCORR" in vals:
                    p, pc = vals["PRECTOTCORR"]
                    row["precip_mm_day"] = round(p, 2)
                    row["precip_anom_pct"] = round(100 * (p - pc) / pc) if pc >= 0.5 else None
                if "RH2M" in vals:
                    row["rh_mean"] = round(vals["RH2M"][0])
                if "WS2M" in vals:
                    row["wind_mean"] = round(vals["WS2M"][0], 1)
                out[(y, m)] = row
    return out


# ------------------------------------------------------------------ open wildfires
EONET = "https://eonet.gsfc.nasa.gov/api/v3/events?category=wildfires&status=open&limit=300"


def eonet_snapshot(path: Path) -> int:
    """Open wildfires from NASA EONET, saved for the site to use when the live call fails."""
    from datetime import datetime, timezone

    req = urllib.request.Request(EONET, headers={"User-Agent": "niran-pipeline"})
    with urllib.request.urlopen(req, timeout=60) as r:
        data = json.loads(r.read())
    events = []
    for e in data.get("events", []):
        g = e["geometry"][-1] if e.get("geometry") else None
        if not g:
            continue
        c = g["coordinates"]
        lon, lat = (c if isinstance(c[0], (int, float)) else c[0][0])[:2]
        events.append({"lat": lat, "lon": lon, "title": e["title"], "date": g.get("date", "")[:10]})
    path.write_text(json.dumps({"fetched": datetime.now(timezone.utc).isoformat()[:16] + "Z", "events": events}, ensure_ascii=False), encoding="utf-8")
    return len(events)
