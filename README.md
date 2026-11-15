# NIRAN — Mind-Scale

NASA Space Apps hackathon project: wildfire anomaly bulletin and fire-safety agent for Morocco, Australia and Brazil (2020–2025 archive + NASA near-real-time), built only from open NASA data (FIRMS, POWER, GIBS, EONET).

The app includes a 3D globe with fire replay, country bulletins, year comparisons,
a guided tour, and current-fire and seasonal context. MODIS (Terra/Aqua) and
VIIRS (Suomi NPP/NOAA-20) have separate counts and historical comparisons.

## Layout
| Path | What |
|---|---|
| `00_*.md` … `06_*.md` | team briefs, one per module (FR) |
| `docs/NETTOYAGE.md` | FIRMS cleaning report |
| `pipeline/` | Python: FIRMS CSVs + NASA APIs → `web/public/data/*.json` |
| `web/` | React + Vite + three.js site (see `web/README.md`) |
| `server/` | Node server (no dependencies): serves the site, live NASA FIRMS feed, NIRAN agent chat, watch → alert loop |
| `docs/AGENT.md` | how the agent senses, watches, confirms and notifies the fire service, and how it would run in real life |
| `Dockerfile`, `render.yaml` | one container for Render |
| `analysis/` | earlier cleaning scripts, summary tables, workbook and reference chart |

## Run
Prebuilt data is committed in `web/public/data/`, so the site runs without the
raw archives or Python:

```bash
cp .env.example .env          # optional: LLM_API_KEY (DeepSeek V4 Pro by default, or any OpenAI-compatible API), ALERT_WEBHOOK_URL
node server/index.mjs         # API on :8787 (live FIRMS feed, agent, alerts)
cd web && npm ci && npm run dev   # site on :5173, /api proxied to :8787
# npm run build produces web/dist, which the server also serves
```

Docker / Render: `docker build -t niran . && docker run -p 10000:10000 --env-file .env niran`,
or on Render: New → Blueprint (`render.yaml`), then set `LLM_API_KEY` in the dashboard.
Without an LLM key the agent answers with rule-based templates from the same NASA facts.

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
uses country-level regions, 2020–2025 history and an English interface.
