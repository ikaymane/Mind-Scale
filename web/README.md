# NIRAN — web app (`/web`)

React + Vite + TypeScript, three.js (globe), Recharts, Zustand. Static site, no backend. English only.

```bash
# 1. Data: FIRMS CSVs + NASA GIBS / POWER / EONET -> JSON (from the repo root)
python pipeline/build_web_data.py --src data             # MODIS/VIIRS CSV or ZIP archives
python pipeline/build_web_data.py --src data --no-nasa   # offline: skip GIBS / POWER / EONET

# 2. Site
cd web && npm ci && npm run dev                         # http://localhost:5173
npm run build                                           # -> web/dist
```

## NASA sources (all open, no key)
| Source | Used for | When |
|---|---|---|
| NASA FIRMS archive (CSV) | fire detections, levels, season curve, globe fire cells | pipeline |
| NASA POWER monthly API | temperature / rain / humidity / wind at the 4 busiest fire areas, vs 2001-2024 | pipeline |
| NASA GIBS `MODIS_Combined_L3_IGBP_Land_Cover_Type_Annual` | land cover of every detection ("What burned"), forest mask on the globe | pipeline |
| NASA GIBS `BlueMarble_ShadedRelief_Bathymetry`, `Coastlines_15m` | globe imagery (2K, then 8K; 2048 px regional patch on zoom) | browser |
| NASA GIBS MODIS thermal-anomaly vector tiles | last seven complete days of detections, compared with the archive | browser |
| NASA EONET | open wildfires (live, 6 s timeout, then `data/eonet.json` snapshot) | browser + pipeline |

The api.nasa.gov key is not needed by any of these. Keep keys out of the front end: a static site exposes them.

## Files
| File | Role |
|---|---|
| `src/levels.ts` | the one level palette |
| `src/store.ts` | shared state `{ regionId, year, month, sensor, mode, page }`, mirrored in the URL |
| `src/globe/scene.ts` | three.js globe: imagery, fire cells, fuel layer, Terra/Aqua (illustrative orbits, turning with the Earth), replay, EONET |
| `src/globe/Globe.tsx` | labels, satellite readout, replay bar, legend |
| `src/bulletin/*` | the panel: verdict + level scale, season curve, history bars, conditions |
| `src/pages/Compare.tsx` | side-by-side year comparison |
| `src/components/Tour.tsx` | guided walkthrough |
| `src/lib/now.ts`, `src/lib/season.ts` | current detections and seasonal summaries |
| `src/i18n/en.json` | all copy |

## Data files (`public/data/`)
`regions.geojson`, `anomalies.json`, `cumulative.json`, `globe_cells.json` (0.5° cells: count + first day burned per month),
`context.json` (POWER + land cover), `forest_mask.png`, `meta.json`, `eonet.json` (when EONET answered).

VIIRS uses `cumulative_VIIRS.json` and `globe_cells_VIIRS.json`; `anomalies.json`
contains separate rows for both sensors. Weather and land-cover context use
the MODIS reference detections. Current detections and imagery require network
access; the archive bulletin uses the committed local files. An EONET snapshot
is optional and is currently absent from the repository.
