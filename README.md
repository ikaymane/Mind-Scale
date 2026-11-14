# NIRAN — Mind-Scale

NASA Space Apps hackathon project: wildfire anomaly bulletin for Morocco, Australia and Brazil (2020–2024), built only from open NASA data (FIRMS, POWER, GIBS, EONET).

## Layout
| Path | What |
|---|---|
| `00_*.md` … `06_*.md` | team briefs, one per module (FR) |
| `docs/NETTOYAGE.md` | FIRMS cleaning report |
| `pipeline/` | Python: FIRMS CSVs + NASA APIs → `web/public/data/*.json` |
| `web/` | React + Vite + three.js static site (see `web/README.md`) |

## Run
FIRMS archive CSVs (`morocco_2020_2024.csv`, `australie_2020_2024.csv`, `brazil_2020_2024.csv`) are not in the repo (too large). Download them from [FIRMS archive](https://firms.modaps.eosdis.nasa.gov/download/) into a folder, e.g. `data/`.

```bash
python pipeline/build_web_data.py --src data     # rebuild web/public/data
cd web && npm install && npm run dev             # http://localhost:5173
```

Prebuilt data is already committed in `web/public/data/`, so the site runs without the CSVs.
