# NIRAN — Mind-Scale

NASA Space Apps hackathon project: wildfire anomaly bulletin for Morocco, Australia and Brazil (2020–2024), built only from open NASA data (FIRMS, POWER, GIBS, EONET).

The app includes a 3D globe with fire replay, country bulletins, year comparisons,
a guided tour, and current-fire and seasonal context. MODIS (Terra/Aqua) and
VIIRS (Suomi NPP/NOAA-20) have separate counts and historical comparisons.

## Layout
| Path | What |
|---|---|
| `00_*.md` … `06_*.md` | team briefs, one per module (FR) |
| `docs/NETTOYAGE.md` | FIRMS cleaning report |
| `pipeline/` | Python: FIRMS CSVs + NASA APIs → `web/public/data/*.json` |
| `web/` | React + Vite + three.js static site (see `web/README.md`) |
| `analysis/` | earlier cleaning scripts, summary tables, workbook and reference chart |

## Run
Prebuilt data is committed in `web/public/data/`, so the site runs without the
raw archives or Python:

```bash
cd web
npm ci
npm run dev
# npm run build produces web/dist
```

To rebuild the data, download the MODIS and VIIRS CSV/ZIP archives from
[FIRMS archive](https://firms.modaps.eosdis.nasa.gov/download/) into a folder,
e.g. `data/`. Raw archives, large cleaned exports, caches, dependencies and build
outputs are excluded from Git.

```bash
python -m pip install numpy pandas pillow matplotlib
python pipeline/build_web_data.py --src data     # rebuild web/public/data
# Add --no-nasa to skip NASA weather, land-cover and EONET requests.
```

The `00_*.md`–`06_*.md` team briefs describe the original plan. The current demo
uses country-level regions, 2020–2024 history and an English interface.
