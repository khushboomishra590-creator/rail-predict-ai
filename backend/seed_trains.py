"""
seed_trains.py
==============
Idempotent seed — inserts the 8 trains from the M2 CSV into PostgreSQL.

Run from the railway/ root:
    python backend/seed_trains.py

Safe to run multiple times:
  - Skips any record that already exists (matched by unique key).
  - Never deletes or modifies existing records.
  - No schema changes.

Train IDs sourced from:
    backend/ETA_dynamicengine/data/SIH26028_demo_railway_eta_dataset.csv

Dynamic ETA support:
  12951  → FULL  (M4 PostgreSQL + M3 XGBoost, route seeded)
  others → LIST-ONLY  (appear in train list; /eta returns 404 — no TrainRun)
"""

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from backend.database.session import SessionLocal
from backend.models.models import Station, Train, Zone

# ── Station master — all stations appearing in the CSV ────────────────────────
# code, name, zone_code, lat, lon
STATION_DEFS = [
    # Already seeded — kept for idempotency checks
    ("BCT",  "Mumbai Central",  "WR",  18.9691, 72.8193),
    ("NDLS", "New Delhi",       "NR",  28.6431, 77.2197),
    ("BRC",  "Vadodara Junction","WR", 22.3072, 73.1812),
    # New
    ("ST",   "Surat",           "WR",  21.2096, 72.8375),
    ("BH",   "Bharuch Junction","WR",  21.7051, 72.9959),
    ("ADI",  "Ahmedabad Junction","WR",23.0258, 72.6016),
    ("SBI",  "Sabarmati",       "WR",  23.0748, 72.6019),
    ("JP",   "Jaipur Junction", "NWR", 26.9215, 75.7873),
    ("AII",  "Ajmer Junction",  "NWR", 26.4499, 74.6399),
    ("ANND", "Anand Junction",  "WR",  22.5575, 72.9864),
    ("DLI",  "Delhi Junction",  "NR",  28.6584, 77.2275),
]

# ── Zone master ───────────────────────────────────────────────────────────────
ZONE_DEFS = [
    ("WR",  "Western",          "Mumbai"),
    ("NR",  "Northern",         "New Delhi"),
    ("NWR", "North Western",    "Jaipur"),
]

# ── Train definitions — sourced entirely from CSV train_ids ──────────────────
# number, name, short_name, train_type, origin_code, dest_code, zone_code
TRAIN_DEFS = [
    # Already seeded
    ("12951", "Mumbai Central - New Delhi Rajdhani Express",
     "Mumbai Rajdhani",   "Rajdhani",   "BCT",  "NDLS", "WR"),
    # New — 7 missing trains from CSV
    ("12952", "New Delhi - Mumbai Central Rajdhani Express",
     "Delhi Rajdhani",    "Rajdhani",   "NDLS", "BCT",  "WR"),
    ("12931", "Mumbai Central - Delhi Hazrat Nizamuddin Double Decker Express",
     "DD Express",        "Superfast",  "BCT",  "NDLS", "WR"),
    ("12932", "Ahmedabad - Mumbai Central Double Decker Express",
     "Double Decker",     "Superfast",  "ADI",  "BCT",  "WR"),
    ("12009", "Mumbai Central - Ahmedabad Shatabdi Express",
     "Shatabdi Exp",      "Shatabdi",   "BCT",  "ADI",  "WR"),
    ("12010", "Ahmedabad - Mumbai Central Shatabdi Express",
     "Shatabdi Exp",      "Shatabdi",   "ADI",  "BCT",  "WR"),
    ("22953", "Mumbai Central - Gandhinagar Capital SF Express",
     "GC SF Express",     "Superfast",  "BCT",  "ADI",  "WR"),
    ("22954", "Gandhinagar Capital - Mumbai Central SF Express",
     "GC SF Express",     "Superfast",  "ADI",  "BCT",  "WR"),
]

SEP = "=" * 60


def seed():
    db = SessionLocal()
    try:
        print(f"\n{SEP}")
        print("  SEED: railway trains from M2 CSV")
        print(SEP)

        # ── 1. Zones ──────────────────────────────────────────────────────────
        print("\n[1] Zones")
        zone_map: dict[str, int] = {}
        for code, name, hq in ZONE_DEFS:
            existing = db.query(Zone).filter_by(code=code).first()
            if existing:
                zone_map[code] = existing.id
                print(f"  SKIP  zone {code} (id={existing.id})")
            else:
                z = Zone(code=code, name=name, headquarters=hq)
                db.add(z)
                db.flush()
                zone_map[code] = z.id
                print(f"  ADD   zone {code}  id={z.id}")
        db.commit()

        # ── 2. Stations ───────────────────────────────────────────────────────
        print("\n[2] Stations")
        station_map: dict[str, int] = {}
        for code, name, zone_code, lat, lon in STATION_DEFS:
            existing = db.query(Station).filter_by(code=code).first()
            if existing:
                station_map[code] = existing.id
                print(f"  SKIP  station {code} — {name} (id={existing.id})")
            else:
                s = Station(
                    code=code,
                    name=name,
                    zone_id=zone_map.get(zone_code),
                    latitude=lat,
                    longitude=lon,
                    is_major=True,
                )
                db.add(s)
                db.flush()
                station_map[code] = s.id
                print(f"  ADD   station {code} — {name}  id={s.id}")
        db.commit()

        # ── 3. Trains ─────────────────────────────────────────────────────────
        print("\n[3] Trains")
        inserted = 0
        skipped  = 0
        for number, name, short_name, train_type, origin_code, dest_code, zone_code in TRAIN_DEFS:
            existing = db.query(Train).filter_by(number=number).first()
            if existing:
                print(f"  SKIP  {number} — {short_name} (id={existing.id})")
                skipped += 1
                continue

            origin_id = station_map.get(origin_code)
            dest_id   = station_map.get(dest_code)
            if origin_id is None or dest_id is None:
                print(f"  WARN  {number} — station code not found "
                      f"(origin={origin_code}, dest={dest_code}) — skipping")
                continue

            t = Train(
                number=number,
                name=name,
                short_name=short_name,
                train_type=train_type,
                origin_station_id=origin_id,
                destination_station_id=dest_id,
                zone_id=zone_map.get(zone_code),
            )
            db.add(t)
            db.flush()
            print(f"  ADD   {number} — {short_name}  id={t.id}")
            inserted += 1

        db.commit()

        # ── 4. Summary ────────────────────────────────────────────────────────
        total = db.query(Train).count()
        print(f"\n{SEP}")
        print(f"  Trains inserted : {inserted}")
        print(f"  Trains skipped  : {skipped}")
        print(f"  Total in DB now : {total}")
        print(SEP)

        print("\n  DYNAMIC ETA SUPPORT:")
        print("  12951 → FULL  (M4 PostgreSQL + M3 XGBoost + route seeded)")
        for number, _, short_name, *_ in TRAIN_DEFS:
            if number != "12951":
                print(f"  {number} → LIST-ONLY  (in train list; no TrainRun/route seeded)")

        print(f"""
  NOTE: The CSV contains exactly 8 unique train IDs.
  All 8 are now in PostgreSQL and returned by GET /api/trains.
  Target was 10–12; dataset only provides 8 valid IDs.
  No IDs were invented beyond what the CSV contains.
{SEP}
""")

    finally:
        db.close()


if __name__ == "__main__":
    seed()
