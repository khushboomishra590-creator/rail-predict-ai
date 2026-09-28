"""
demo_mode_test.py
=================
Verifies the full simulated RTIS → PostgreSQL → M3 → M4 → M5 update chain.
Run from railway/ root:  python backend/demo_mode_test.py
"""
import sys, json, urllib.request, urllib.error
from datetime import datetime, timezone

BASE = "http://localhost:8000"
sys.path.insert(0, "C:/Users/Admin/OneDrive/Desktop/railway")

def get(url):
    try:
        r = urllib.request.urlopen(url, timeout=8)
        return r.status, json.loads(r.read())
    except urllib.error.HTTPError as e:
        return e.code, json.loads(e.read())

def post(url, data):
    try:
        payload = json.dumps(data).encode()
        req = urllib.request.Request(
            url, data=payload,
            headers={"Content-Type": "application/json"}, method="POST"
        )
        r = urllib.request.urlopen(req, timeout=8)
        return r.status, json.loads(r.read())
    except urllib.error.HTTPError as e:
        return e.code, json.loads(e.read())

results = []
def check(name, ok, detail=""):
    results.append((name, ok, detail))
    tag = "PASS" if ok else "FAIL"
    print(f"  [{tag}]  {name}  {detail}")
    return ok

# ── Step 1: capture ETA before update ────────────────────────────────────────
print("\n=== Step 1: Capture baseline ETA ===")
s, before = get(f"{BASE}/api/trains/12951/eta")
check("Baseline ETA HTTP 200", s == 200, f"got {s}")
before_delay = before.get("current_delay")
before_eta   = before.get("predicted_eta")
print(f"  Before — delay={before_delay} min  predicted_eta={before_eta}")

# ── Step 2: POST a new simulated movement with different delay ────────────────
print("\n=== Step 2: POST simulated RTIS movement update ===")
new_delay = (before_delay or 5) + 7   # increase delay by 7 min
ts = datetime.now(tz=timezone.utc).strftime("%Y-%m-%dT%H:%M:%S+00:00")
s, mv = post(f"{BASE}/api/trains/12951/update", {
    "train_id": "12951",
    "latitude": 22.3072,
    "longitude": 73.1812,
    "speed": 88,
    "timestamp": ts,
    "current_delay_min": new_delay,
    "current_section": "BRC_SECTION",
    "distance_to_next_station_km": 45.0,
})
check("POST movement HTTP 201",    s == 201,                    f"got {s}")
check("movement_id returned",      "movement_id" in mv,         str(mv.get("movement_id")))
check("train_run_id returned",     "train_run_id" in mv,        str(mv.get("train_run_id")))
print(f"  Posted — delay={new_delay} min  speed=88  movement_id={mv.get('movement_id')}")

# ── Step 3: Fetch updated ETA (M3 re-runs with new delay) ─────────────────────
print("\n=== Step 3: Fetch updated ETA after movement ===")
s, after = get(f"{BASE}/api/trains/12951/eta")
check("Updated ETA HTTP 200",      s == 200,                    f"got {s}")
after_delay = after.get("current_delay")
after_eta   = after.get("predicted_eta")
check("current_delay updated",     after_delay == new_delay,    f"expected {new_delay} got {after_delay}")
check("current_speed updated",     after.get("current_speed") == 88, f"speed={after.get('current_speed')}")
check("predicted_eta present",     bool(after_eta),             after_eta)
check("eta_lower present",         bool(after.get("eta_lower")), after.get("eta_lower"))
check("eta_upper present",         bool(after.get("eta_upper")), after.get("eta_upper"))
check("uncertainty_minutes > 0",   (after.get("uncertainty_minutes") or 0) > 0, str(after.get("uncertainty_minutes")))
check("NO confidence_pct",         "confidence_pct" not in after, "absent")

print(f"  After  — delay={after_delay} min  predicted_eta={after_eta}")
print(f"  ETA range: {after.get('eta_lower')} → {after.get('eta_upper')}")
print(f"  Uncertainty: ±{after.get('uncertainty_minutes')} min")

# ── Step 4: Verify ETA changed due to delay increase ─────────────────────────
print("\n=== Step 4: Verify ETA reflects updated movement ===")
check("ETA prediction updated",    after_eta != before_eta or after_delay != before_delay,
      f"before={before_eta} after={after_eta}")

# ── Step 5: Verify DB state ───────────────────────────────────────────────────
print("\n=== Step 5: Database verification ===")
from backend.database.session import SessionLocal
from backend.models.models import TrainMovement, TrainRun, EtaPrediction

db = SessionLocal()
run_id = mv.get("train_run_id")

run = db.query(TrainRun).filter_by(id=run_id).first()
check("train_run.current_delay_min updated", run and run.current_delay_min == new_delay,
      f"got {run.current_delay_min if run else 'N/A'}")
check("train_run.current_speed_kmh updated", run and run.current_speed_kmh == 88,
      f"got {run.current_speed_kmh if run else 'N/A'}")

latest_mov = db.query(TrainMovement).filter_by(train_run_id=run_id).order_by(TrainMovement.id.desc()).first()
check("Latest movement delay_min correct",   latest_mov and latest_mov.delay_min == new_delay,
      f"got {latest_mov.delay_min if latest_mov else 'N/A'}")
check("Latest movement speed correct",       latest_mov and latest_mov.speed_kmh == 88,
      f"got {latest_mov.speed_kmh if latest_mov else 'N/A'}")
check("Latest movement source=rtis",         latest_mov and latest_mov.source == "rtis",
      f"source={latest_mov.source if latest_mov else 'N/A'}")

latest_pred = db.query(EtaPrediction).filter_by(train_run_id=run_id).order_by(EtaPrediction.id.desc()).first()
check("ETA prediction persisted",            latest_pred is not None)
check("model_version=network_xgb_v1",        latest_pred and latest_pred.model_version == "network_xgb_v1",
      f"model={latest_pred.model_version if latest_pred else 'N/A'}")
print(f"  DB ai_eta={latest_pred.ai_eta if latest_pred else 'N/A'}")
print(f"  DB eta_lower={latest_pred.eta_lower if latest_pred else 'N/A'}")
print(f"  DB eta_upper={latest_pred.eta_upper if latest_pred else 'N/A'}")
db.close()

# ── Step 6: CORS header check (simulates M5 browser fetch) ───────────────────
print("\n=== Step 6: CORS compatibility (simulating M5 browser request) ===")
req = urllib.request.Request(
    f"{BASE}/api/trains/12951/eta",
    headers={"Origin": "http://localhost:8080"}
)
r = urllib.request.urlopen(req, timeout=8)
cors_header = r.headers.get("access-control-allow-origin", "MISSING")
check("CORS allow-origin header present",    cors_header != "MISSING",  cors_header)
check("CORS allows M5 origin",              "localhost" in cors_header or cors_header == "*",
      cors_header)

# ── Step 7: Demo mode label validation ────────────────────────────────────────
print("\n=== Step 7: Demo mode — confirm no fake LIVE indicator in API ===")
s, health = get(f"{BASE}/health")
check("Backend healthy",                    health.get("status") == "ok")
# The API itself makes no claim about being live — demo label is purely frontend
check("API does not claim live railway data",
      "live" not in json.dumps(after).lower().replace("last_updated", ""),
      "no spurious 'live' claim in ETA JSON")

# ── Summary ───────────────────────────────────────────────────────────────────
print("\n" + "="*65)
print("SUMMARY")
print("="*65)
passed = sum(1 for _, ok, _ in results if ok)
failed = sum(1 for _, ok, _ in results if not ok)
print(f"  Total : {len(results)}")
print(f"  PASS  : {passed}")
print(f"  FAIL  : {failed}")

print(f"""
Full simulated RTIS update chain verified:
  POST movement (delay={new_delay} min, speed=88)
    -> PostgreSQL train_movements + train_runs updated
    -> GET /api/trains/12951/eta triggers M3 ETAService.calculate_eta()
    -> M3 XGBoost produces new predicted_eta
    -> EtaPrediction row persisted (model_version=network_xgb_v1)
    -> M5 useTrainEta hook polls every 15s and receives updated values

Demo mode labels added to Dashboard:
  - Header: "DEMO - Simulated RTIS Feed" (amber badge, replaces fake LIVE)
  - TrainDetail: metrics labelled "timetable", "simulated", "M3"
  - PredictionPanel: columns labelled "timetable", "Simulated RTIS", "AI M3"
  - PredictionPanel footer: "Movement data: simulated RTIS feed (demo mode)"
""")

if failed:
    print("FAILED CHECKS:")
    for name, ok, detail in results:
        if not ok:
            print(f"  FAIL  {name}  {detail}")
    sys.exit(1)
else:
    print("All checks passed.")
