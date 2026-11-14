# NIRAN — New-device handoff

This guide opens the current Binôme B website work on another computer. The project is a static React + Vite site; the website data files are already committed, so rebuilding the Python data pipeline is not required to run it.

## Open this branch on a new computer

You need Git, Node.js with npm, and access to the repository.

```powershell
git clone https://github.com/ikaymane/Mind-Scale.git
cd Mind-Scale
git fetch origin
git switch --track origin/feature/mouadhamdouchi
cd web
npm ci
npm run dev
```

Open the local URL printed by Vite, usually `http://localhost:5173`.

To create a production build instead, run this from `web/`:

```powershell
npm run build
```

If the repository is already cloned on the new computer, run `git fetch origin` from its root, then switch to `origin/feature/mouadhamdouchi` as above. Keep working on this feature branch to see these changes; they are not merged into `main`.

## What is in the project

- `web/` — React, TypeScript, Vite and the NIRAN interface.
- `web/public/data/` — committed data used by the historical dashboard.
- `pipeline/` — scripts for regenerating the prepared data, if needed.
- `00_BRIEF_COMMUN.md` and `05_M5_DASHBOARD_UX.md` — project and Binôme B context.

The current packaged FIRMS archive covers 2020–2024 and was generated on 14 November 2026. Live NASA layers need an internet connection. The site has no backend. Its interface is currently in English.

## Website changes in this branch

- Simplified the home dashboard by removing repeated summary blocks and folding long or secondary details into expandable sections. The period and country comparisons stay prominent; the 3D globe is loaded when opened.
- Restored the first-visit tour offer: centered, themed to NIRAN, shown after a short delay, and keyboard accessible. The tour remains available from the header and closes the offer when the visitor navigates away from Overview.
- Made the mobile header fit all four main destinations across two rows.
- Folded detailed method, source, monthly comparison and data-cleaning tables so readers can open them when needed.
- Made CSV export follow the selected region, sensor and period. Sharing now creates a short, sourced briefing with the current URL.
- Added a plain-language comparison summary and caveats so satellite detections are not mistaken for burned area, fire severity or a forecast.
- Added a regional readiness checklist using the existing seasonal history and safety guidance. Progress is saved locally in that browser for the selected region and year; it does not sync to another device.
- Kept the live signal, typical-season context and readiness actions together, while placing the practical checklist before the longer weather-history context.
- Split heavy page and visualization code into separate bundles so the home view does less work at startup.

## Safety and data limits

NIRAN summarizes satellite fire detections. A detection is not a confirmed fire perimeter or burned area. The historical comparison describes past activity and does not predict future fires. The readiness checklist is general preparation guidance, not an official alert; follow local civil-protection instructions.

Historical files are available without network access. Recent satellite detections, imagery and other live NASA sources need a network connection and may be delayed or unavailable.

## Useful next improvements

- Add Arabic and French interface translations with right-to-left layout review.
- Add links to verified local civil-protection alert channels for each covered area.
- Add an exportable or printable household readiness plan, keeping personal checklist progress on the user's device unless they choose to share it.

Treat those as future work: the current branch does not provide official alert subscriptions or fire-risk forecasts.
