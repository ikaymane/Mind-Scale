# Earlier analysis work

This folder preserves the earlier cleaning and analysis work alongside the
current app pipeline at `../pipeline/build_web_data.py`.

- `pipeline/clean.py`: MODIS cleaning and annual/monthly anomaly tables based
  on a mean-plus-20-percent rule, including a leave-one-out variant.
- `pipeline/out/`: cleaning report, small summary CSVs and `resultats_feux.xlsx`.
- `Data/cleaned/`: initial cleaning and KPI scripts, their cleaning report and
  annual summary CSV.
- `chart.svg`: the original Meteomatics reference chart from the workspace.

These are historical snapshots. Their scripts retain the original input paths;
adjust those paths to a local copy of the archives before rerunning them.
Their filters and anomaly rules differ from the current website pipeline, so
their totals should not be substituted for the website's data.

Raw CSV/ZIP downloads and large cleaned CSV/Parquet exports remain local and
are excluded from this repository. The current site includes its own compact,
precomputed JSON data and does not require these historical outputs to run.
