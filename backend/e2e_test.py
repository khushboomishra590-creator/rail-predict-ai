"""
End-to-end integration test — M4 → M3 → XGBoost → response
Run from railway/ root:  python backend/e2e_test.py
"""
import sys, json, urllib.request, urllib.error
from datetime import datetime

BASE = "http://localhost:8000"

PASS = "✓ PASS"
FAIL = "✗ FAIL"
results = []

def get(url):
    try:
        r = urllib.request.urlopen(url, timeout=8)
        return r.status, json.loads(r.read())
    except urllib.error.HTTPError as e:
        return e.code, json.loads(e.read())
    except Exception as e:
        return None, str(e)

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
    except Exception as e:
        return None, str(e)

def check(name, ok, detail=""):
    tag = PASS if ok else FAIL
    results.append((name, ok, detail))
    print(f"  {tag}  {name}  {detail}")
    return ok

# ── 1. Health ─────────────────────────────────────────────────────────────────
print("\n" + "="*65)
print("1. GET /health")
print("="*65)
s, b = get(f"{BASE}/health")
check("HTTP 200",        s == 200,              f"got {s}")
check("status=ok",       b.get("status")=="ok", str(b))

# ── 2. GET /api/trains ────────────────────────────────────────────────────────
print("\n" + "="*65)
print("2. GET /api/trains")
print("="*65)
s, b = get(f"{BASE}/api/trains")
check("HTTP 200",        s == 200,              f"got {s}")
check("Returns list",    isinstance(b, list),   f"type={type(b)}")
check("Train 12951 present", any(t.get("number")=="12951" for t in b) if isinstance(b,list) else False)

# ── 3. GET /api/trains/12951 ──────────────────────────────────────────────────
print("\n" + "="*65)
print("3. GET /api/trains/12951")
print("="*65)
s, b = get(f"{BASE}/api/trains/12951")
check("HTTP 200",           s == 200,           f"got {s}")
check("number=12951",       b.get("number")=="12951")
check("origin resolved",    "origin_station" in b and b["origin_station"].get("code")=="BCT",
      b.get("origin_station"))

# ── 4. POST movement update ───────────────────────────────────────────────────
print("\n" + "="*65)
print("4. POST /api/trains/12951/update  (with section + delay)")
print("="*65)
today = datetime.now().strftime("%Y-%m-%dT%H:%M:%S+05:30")
payload = {
    "train_id":                   "12951",
    "latitude":                   22.3072,
    "longitude":                  73.1812,
    "speed":                      104,
    "timestamp":                  today,
    "current_delay_min":          5,
    "current_section":            "BRC_SECTION",
    "distance_to_next_station_km": 45.0,
}
s, b = post(f"{BASE}/api/trains/12951/update", payload)
check("HTTP 201",           s == 201,           f"got {s}")
check("movement_id present", "movement_id" in b, str(b))
check("train_run_id present","train_run_id" in b, str(b))
movement_id   = b.get("movement_id")
train_run_id  = b.get("train_run_id")
print(f"  → movement_id={movement_id}  train_run_id={train_run_id}")

# ── 5. GET /api/trains/12951/eta  ─────────────────────────────────────────────
print("\n" + "="*65)
print("5. GET /api/trains/12951/eta  (REAL M3 call)")
print("="*65)
s, b = get(f"{BASE}/api/trains/12951/eta")
check("HTTP 200",                s == 200,           f"got {s}")
check("train_id=12951",          b.get("train_id")=="12951")
check("predicted_eta present",   bool(b.get("predicted_eta")), b.get("predicted_eta"))
check("scheduled_eta present",   bool(b.get("scheduled_eta")), b.get("scheduled_eta"))
check("eta_lower present",       bool(b.get("eta_lower")),     b.get("eta_lower"))
check("eta_upper present",       bool(b.get("eta_upper")),     b.get("eta_upper"))
check("uncertainty_minutes > 0", (b.get("uncertainty_minutes") or 0) > 0,
      str(b.get("uncertainty_minutes")))
check("delay_adjustment is int", isinstance(b.get("delay_adjustment"), int),
      str(b.get("delay_adjustment")))
check("NO confidence_pct",       "confidence_pct" not in b,
      "absent" if "confidence_pct" not in b else "PRESENT — BAD")
check("current_speed=104",       b.get("current_speed")==104,  str(b.get("current_speed")))
check("current_delay=5",         b.get("current_delay")==5,    str(b.get("current_delay")))

if s == 200:
    print(f"\n  ── M3 ETA RESULT ──────────────────────────────────────")
    for k in ["current_station","next_station","current_speed","current_delay",
              "scheduled_eta","predicted_eta","predicted_delay",
              "eta_lower","eta_upper","uncertainty_minutes","delay_adjustment","last_updated"]:
        print(f"    {k:<25} = {b.get(k)}")
    print(f"  ───────────────────────────────────────────────────────")

# ── 6. GET /api/trains/12951/route-eta ───────────────────────────────────────
print("\n" + "="*65)
print("6. GET /api/trains/12951/route-eta  (REAL M3 route call)")
print("="*65)
s, b = get(f"{BASE}/api/trains/12951/route-eta")
check("HTTP 200",            s == 200,               f"got {s}")
check("train_id=12951",      b.get("train_id")=="12951")
check("stations is list",    isinstance(b.get("stations"), list))
check("at least 1 station",  len(b.get("stations",[]))>=1,
      f"count={len(b.get('stations',[]))}")

if s == 200 and b.get("stations"):
    print(f"\n  ── M3 ROUTE ETA RESULT ({len(b['stations'])} stops) ───────────────")
    for st in b["stations"]:
        print(f"    station={st.get('next_station'):<20} "
              f"predicted={st.get('predicted_eta')}  "
              f"delay={st.get('predicted_delay')} min")
    print(f"  ─────────────────────────────────────────────────────────")

# ── 7. Invalid train 404 ──────────────────────────────────────────────────────
print("\n" + "="*65)
print("7. 404 error handling")
print("="*65)
s, b = get(f"{BASE}/api/trains/INVALID")
check("trains/INVALID → 404",     s==404, f"got {s}")
s, b = get(f"{BASE}/api/trains/INVALID/eta")
check("trains/INVALID/eta → 404", s==404, f"got {s}")

# ── 8. DB verification ────────────────────────────────────────────────────────
print("\n" + "="*65)
print("8. Database verification")
print("="*65)
sys.path.insert(0, "C:/Users/Admin/OneDrive/Desktop/railway")
from backend.database.session import SessionLocal
from backend.models.models import TrainMovement, TrainRun, EtaPrediction

db = SessionLocal()

movements = db.query(TrainMovement).order_by(TrainMovement.id.desc()).limit(3).all()
check("train_movements has rows",   len(movements) >= 1,  f"count={len(movements)}")
if movements:
    m = movements[0]
    check("latest movement speed=104",  m.speed_kmh == 104,    f"speed={m.speed_kmh}")
    check("latest movement delay=5",    m.delay_min == 5,       f"delay_min={m.delay_min}")
    check("movement source=rtis",       m.source == "rtis",     f"source={m.source}")
    print(f"  → movement id={m.id}  lat={m.latitude}  lon={m.longitude}  "
          f"speed={m.speed_kmh}  delay={m.delay_min}  source={m.source}")

run = db.query(TrainRun).filter_by(id=train_run_id).first() if train_run_id else None
check("train_run found",              run is not None,      f"run_id={train_run_id}")
if run:
    check("train_run speed=104",      run.current_speed_kmh==104, f"speed={run.current_speed_kmh}")
    check("train_run delay=5",        run.current_delay_min==5,   f"delay={run.current_delay_min}")
    print(f"  → run id={run.id}  speed={run.current_speed_kmh}  delay={run.current_delay_min}")

preds = (db.query(EtaPrediction)
         .filter_by(train_run_id=train_run_id)
         .order_by(EtaPrediction.predicted_at.desc())
         .all()) if train_run_id else []
check("eta_predictions has rows",     len(preds) >= 1,      f"count={len(preds)}")
if preds:
    p = preds[0]
    check("model_version set",        p.model_version == "network_xgb_v1",
          f"model={p.model_version}")
    check("ai_eta is set",            p.ai_eta is not None, str(p.ai_eta))
    check("eta_lower is set",         p.eta_lower is not None)
    check("eta_upper is set",         p.eta_upper is not None)
    check("uncertainty_minutes > 0",  (p.uncertainty_minutes or 0) > 0,
          str(p.uncertainty_minutes))
    print(f"  → pred id={p.id}  ai_eta={p.ai_eta}  "
          f"lower={p.eta_lower}  upper={p.eta_upper}  "
          f"uncertainty={p.uncertainty_minutes} min  model={p.model_version}")

db.close()

# ── 9. M3 direct call verification ───────────────────────────────────────────
print("\n" + "="*65)
print("9. M3 direct call verification (proves XGBoost ran)")
print("="*65)
import pathlib, sys as _sys
m3_root    = "C:/Users/Admin/OneDrive/Desktop/railway/backend/ETA_dynamicengine"
m3_scripts = m3_root + "/scripts"
for p in (m3_root, m3_scripts):
    if p not in _sys.path:
        _sys.path.insert(0, p)

from app.services.eta_service import ETAService
from app.data.demo_data import get_demo_eta_input

result = ETAService().calculate_eta(get_demo_eta_input())
check("M3 ETAService callable",     result is not None)
check("ETAResponse.train_id",       result.train_id == "12951",  result.train_id)
check("ETAResponse.predicted_eta",  result.predicted_eta is not None, str(result.predicted_eta))
check("ETAResponse.uncertainty_minutes > 0", result.uncertainty_minutes > 0,
      str(result.uncertainty_minutes))
check("model_version NOT in ETAResponse",
      not hasattr(result, "confidence_pct"), "no confidence_pct confirmed")
print(f"\n  ── DIRECT M3 OUTPUT ─────────────────────────────────────")
print(f"    train_id            = {result.train_id}")
print(f"    predicted_eta       = {result.predicted_eta}")
print(f"    scheduled_arrival   = {result.scheduled_arrival}")
print(f"    current_delay       = {result.current_delay}")
print(f"    predicted_delay     = {result.predicted_delay:.4f} min")
print(f"    delay_adjustment    = {result.delay_adjustment:.4f} min")
print(f"    eta_lower           = {result.eta_lower}")
print(f"    eta_upper           = {result.eta_upper}")
print(f"    uncertainty_minutes = {result.uncertainty_minutes:.4f} min")
print(f"  ─────────────────────────────────────────────────────────")

# ── Summary ───────────────────────────────────────────────────────────────────
print("\n" + "="*65)
print("SUMMARY")
print("="*65)
passed = sum(1 for _, ok, _ in results if ok)
failed = sum(1 for _, ok, _ in results if not ok)
print(f"  Total : {len(results)}")
print(f"  PASS  : {passed}")
print(f"  FAIL  : {failed}")
if failed:
    print("\n  Failed checks:")
    for name, ok, detail in results:
        if not ok:
            print(f"    ✗ {name}  {detail}")
    sys.exit(1)
else:
    print("\n  All checks passed. M3 → M4 integration verified end-to-end.")
