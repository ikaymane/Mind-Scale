"""Clean NASA FIRMS MODIS fire archives (2020-2024) for Australia, Brazil, Morocco.

Rules:
  1. Drop exact duplicates and duplicate detections (same lat/lon/date/time/satellite).
  2. Drop physically invalid rows: frp < 0, confidence outside 0-100, lat/lon out of range.
  3. Keep only type 0 (presumed vegetation fire). Drop type 1 (volcano),
     2 (static land source: gas flares, industry), 3 (offshore).
  4. Normalize: acq_time -> HHMM string, add acq_datetime (UTC ISO 8601),
     version kept as string, add confidence_level (low <30, nominal 30-79, high >=80),
     add country column.
  5. Sort by acq_datetime.
"""
import json
import sys
from pathlib import Path

import pandas as pd

SRC = Path(r"C:\Users\Dell\Desktop")
OUT = Path(__file__).resolve().parent
FILES = {
    "Australia": "australie_2020_2024.csv",
    "Brazil": "brazil_2020_2024.csv",
    "Morocco": "morocco_2020_2024.csv",
}
KEY = ["latitude", "longitude", "acq_date", "acq_time", "satellite"]


def clean(country: str, fname: str) -> dict:
    df = pd.read_csv(SRC / fname, dtype={"acq_time": str, "version": str})
    log = {"rows_in": len(df)}

    n = len(df)
    df = df.drop_duplicates().drop_duplicates(subset=KEY)
    log["dropped_duplicates"] = n - len(df)

    n = len(df)
    valid = (
        df["frp"].ge(0)
        & df["confidence"].between(0, 100)
        & df["latitude"].between(-90, 90)
        & df["longitude"].between(-180, 180)
        & df["brightness"].gt(0)
        & df["bright_t31"].gt(0)
    )
    df = df[valid]
    log["dropped_invalid"] = n - len(df)

    n = len(df)
    log["type_counts_in"] = {int(k): int(v) for k, v in df["type"].value_counts().items()}
    df = df[df["type"] == 0]
    log["dropped_non_vegetation"] = n - len(df)

    df = df.copy()
    df["acq_time"] = df["acq_time"].str.zfill(4)
    df["acq_datetime"] = pd.to_datetime(
        df["acq_date"] + df["acq_time"], format="%Y-%m-%d%H%M", utc=True
    )
    df["confidence_level"] = pd.cut(
        df["confidence"], bins=[-1, 29, 79, 100], labels=["low", "nominal", "high"]
    )
    df.insert(0, "country", country)
    df = df.sort_values(["acq_datetime", "latitude", "longitude"]).reset_index(drop=True)
    df["acq_datetime"] = df["acq_datetime"].dt.strftime("%Y-%m-%dT%H:%M:%SZ")

    out = OUT / f"{fname.removesuffix('.csv')}_clean.csv"
    df.to_csv(out, index=False)
    log["rows_out"] = len(df)
    log["output"] = str(out)
    return log


def main() -> int:
    report = {c: clean(c, f) for c, f in FILES.items()}
    (OUT / "cleaning_report.json").write_text(json.dumps(report, indent=2))
    print(json.dumps(report, indent=2))
    return 0


if __name__ == "__main__":
    sys.exit(main())
