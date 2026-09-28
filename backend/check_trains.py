"""
Diagnostic: compare CSV train_ids vs PostgreSQL trains table vs API response.
Run: python backend/check_trains.py
"""
import sys, json, urllib.request
sys.path.insert(0, "C:/Users/Admin/OneDrive/Desktop/railway")

import pandas as pd
from backend.database.session import SessionLocal
from backend.models.models import Train, Station, Zone

# ── 1. CSV ────────────────────────────────────────────────────────────────────
df = pd.read_csv(
    "backend/ETA_dynamicengine/data/SIH26028_demo_railway_eta_dataset.csv"
)
csv_ids = sorted(df["train_id"].unique().tolist())
print("=" * 60)
print("1. CSV")
print("=" * 60)
print(f"  Total rows      : {len(df)}")
print(f"  Unique train IDs: {len(csv_ids)}")
print(f"  IDs             : {csv_ids}")

# ── 2. PostgreSQL ─────────────────────────────────────────────────────────────
db = SessionLocal()
trains = db.query(Train).all()
db_records = []
for t in trains:
    origin = db.query(Station).filter_by(id=t.origin_station_id).first()
    dest   = db.query(Station).filter_by(id=t.destination_station_id).first()
    db_records.append({
        "id": t.id,
        "number": t.number,
        "name": t.name,
        "origin": origin.code if origin else "?",
        "dest": dest.code if dest else "?",
    })
db.close()

db_numbers = sorted([int(r["number"]) for r in db_records])
print()
print("=" * 60)
print("2. PostgreSQL trains table")
print("=" * 60)
print(f"  Total records   : {len(db_records)}")
for r in db_records:
    print(f"  id={r['id']}  number={r['number']}  name={r['name']}  "
          f"origin={r['origin']}  dest={r['dest']}")

csv_set = set(csv_ids)
db_set  = set(db_numbers)
missing = sorted(csv_set - db_set)
extra   = sorted(db_set  - csv_set)
print()
print(f"  Missing from DB (in CSV but not in DB) : {missing}")
print(f"  Extra in DB    (in DB but not in CSV)  : {extra}")

# ── 3. API /api/trains ────────────────────────────────────────────────────────
print()
print("=" * 60)
print("3. GET /api/trains")
print("=" * 60)
try:
    r = urllib.request.urlopen("http://localhost:8000/api/trains", timeout=5)
    api_trains = json.loads(r.read())
    api_numbers = sorted([int(t["number"]) for t in api_trains])
    print(f"  Total returned  : {len(api_trains)}")
    print(f"  Numbers         : {api_numbers}")
    print(f"  Missing from API (in CSV but not in API): {sorted(csv_set - set(api_numbers))}")
except Exception as e:
    print(f"  ERROR: {e}")
    api_numbers = []

# ── 4. demo.ts train IDs ──────────────────────────────────────────────────────
print()
print("=" * 60)
print("4. src/data/demo.ts — train numbers")
print("=" * 60)
import pathlib, re
demo_text = pathlib.Path("src/data/demo.ts").read_text(encoding="utf-8")
# Extract number fields from the trains array
demo_numbers = re.findall(r'number:\s*["\'](\d+)["\']', demo_text)
print(f"  Trains in demo.ts: {len(demo_numbers)}")
print(f"  Numbers          : {sorted(demo_numbers)}")
demo_set = set(int(n) for n in demo_numbers)
print(f"  CSV trains missing from demo.ts: {sorted(csv_set - demo_set)}")

# ── 5. Dashboard — where does train list come from? ───────────────────────────
print()
print("=" * 60)
print("5. Dashboard.tsx — train list source")
print("=" * 60)
dash_text = pathlib.Path("src/components/rail/Dashboard.tsx").read_text(encoding="utf-8")
uses_demo_trains     = "trains as sourceTrains" in dash_text or "from \"@/data/demo\"" in dash_text
uses_api_list_trains = "api.listTrains" in dash_text or "useTrainList" in dash_text
uses_getEta          = "useTrainEta" in dash_text
print(f"  Imports trains from demo.ts  : {uses_demo_trains}")
print(f"  Calls api.listTrains()       : {uses_api_list_trains}")
print(f"  Calls useTrainEta('12951')   : {uses_getEta}")

# ── 6. Summary comparison ─────────────────────────────────────────────────────
print()
print("=" * 60)
print("6. COMPARISON TABLE")
print("=" * 60)
all_ids = sorted(csv_set | db_set | set(api_numbers) | demo_set)
print(f"  {'Train ID':<12} {'In CSV':>8} {'In DB':>8} {'In API':>8} {'In demo.ts':>12}")
print(f"  {'-'*52}")
for tid in all_ids:
    in_csv  = "YES" if tid in csv_set  else "NO"
    in_db   = "YES" if tid in db_set   else "NO"
    in_api  = "YES" if tid in set(api_numbers) else "NO"
    in_demo = "YES" if tid in demo_set else "NO"
    flag = " <-- MISSING from DB+API" if (tid in csv_set and tid not in db_set) else ""
    print(f"  {tid:<12} {in_csv:>8} {in_db:>8} {in_api:>8} {in_demo:>12}{flag}")
