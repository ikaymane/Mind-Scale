# NIRAN agent: from satellite to fire brigade

## What runs in the demo

```
NASA FIRMS (every 10 min)          NIRAN server (Docker on Render)                      Fire service
──────────────────────────         ──────────────────────────────────────────          ─────────────────────
MODIS 7 days  ─────────────┐       1. SENSE   last 7 days vs same days 2020–2025
VIIRS 24 h (NOAA-20, -21) ─┤──►    2. WATCH   country above usual → agent puts it on watch
                           │       3. CONFIRM new VIIRS points grouped in ~10 km cells;
                           │                  ≥ 2 detections or 1 ≥ 20 MW = confirmed fire   ──►  console (live)
                           │       4. NOTIFY  CAP-style alert: where, when, evidence, number   ──►  webhook (SMS / e-mail / CAD)
                           └──►    Agent chat: answers from the same facts (LLM or rule-based)
```

- **Sense**: the server reads the public NASA FIRMS near-real-time files (no key). It counts the last 7 complete
  days of MODIS detections per country and compares them with the same calendar days in the archive
  (2020–2025). It uses the same robust z rule as the rest of the site.
- **Watch**: when a country is above its usual level, the agent adds it to the watch list by itself. A person can
  also ask in the chat ("watch Morocco") or press *Start watch* in the console.
- **Confirm**: in a watched country, new VIIRS detections (375 m pixels) are grouped into 0.1° cells (~10 km). A
  cell becomes an alert when it holds at least two detections, or one with fire power of 20 MW or more. This
  cuts single-pixel false alarms (hot roofs, sun glint). Each cell alerts once per 24 h.
- **Notify**: the alert goes to the fire-service console at once (Server-Sent Events). When `ALERT_WEBHOOK_URL` is
  set, the same JSON is POSTed there. Its fields follow CAP 1.2 (`msgType`, `urgency`, `severity`,
  `certainty`, `area`), the standard emergency alerting format.

Everything in the alert is real NASA data: position, time of the satellite pass, number of detections, fire
power, satellites, and a link to that spot on the NASA FIRMS map.

## How it would work in real life

| Step | Demo | Real deployment |
|---|---|---|
| Data | Public FIRMS global files, every 10 min | FIRMS API with a MAP_KEY, per country; add geostationary detections (Meteosat, GOES) for 10–15 min latency |
| Area | Country, from archive cells | Official admin boundaries, plus each brigade's response zone |
| Confirm | 2 detections or ≥ 20 MW | Same rule, plus: drop known industrial sites (the pipeline's persistent-site list), check the next satellite pass, check weather (wind, humidity from NASA POWER) |
| Who receives | Web console | The national dispatch centre: Morocco **Protection Civile (15)**, Brazil **Corpo de Bombeiros (193)**, Australia state fire services (**000**). Alert as CAP feed, SMS to the duty officer, or straight into their dispatch software (CAD) |
| Human in the loop | — | An operator confirms before crews leave. NIRAN speeds up the first look, it does not replace the 15 / 193 / 000 call |
| Public | Chat answers + safety tips | Warnings to residents go only through the authorities' own channels (cell broadcast, official apps) |

### Limits to say out loud
- Satellites pass a few times a day: a fire can start and grow between two passes. Clouds and thick smoke hide fires.
- A detection is a hot pixel, not a confirmed wildfire: farm burning and industry also show up.
- Times shown are the satellite pass (UTC), not when the fire started.
- The 7-day level describes what happened, not a forecast.

## Run it

```bash
cp .env.example .env               # optional: LLM_API_KEY, ALERT_WEBHOOK_URL
node server/index.mjs              # API on :8787 (serves web/dist if built)
cd web && npm run dev              # site on :5173, /api proxied to :8787
docker build -t niran . && docker run -p 10000:10000 --env-file .env niran
```

On Render: New → Blueprint (uses `render.yaml`), or New → Web Service → Docker. Put `LLM_API_KEY` in the
dashboard. The free plan sleeps after 15 min idle: open the site a minute before the demo.
