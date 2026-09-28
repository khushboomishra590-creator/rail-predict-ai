"""
Verification script — checks all GET endpoints against actual PostgreSQL data.
Run from the railway/ root: python backend/verify_gets.py
"""
import urllib.request
import json
import sys


def get(url):
    try:
        r = urllib.request.urlopen(url, timeout=5)
        return r.status, json.loads(r.read())
    except urllib.error.HTTPError as e:
        return e.code, json.loads(e.read())
    except Exception as e:
        return None, str(e)


BASE = "http://localhost:8000"
PASS = "PASS"
FAIL = "FAIL"
results = []


def check(name, condition, detail=""):
    status = PASS if condition else FAIL
    results.append((name, status, detail))
    symbol = "✓" if condition else "✗"
    print(f"  {symbol} {name}: {status}  {detail}")
    return condition


print("\n" + "=" * 60)
print("GET /api/trains")
print("=" * 60)
status, body = get(f"{BASE}/api/trains")
check("HTTP 200",            status == 200,           f"got {status}")
check("Returns list",        isinstance(body, list),  f"type={type(body)}")
check("1 train in DB",       len(body) == 1,          f"count={len(body)}")
if len(body):
    t = body[0]
    check("train number=12951",         t.get("number") == "12951",      t.get("number"))
    check("train id=1",                 t.get("id") == 1,                str(t.get("id")))
    check("zone_id=1",                  t.get("zone_id") == 1,           str(t.get("zone_id")))
    check("origin_station_id=1",        t.get("origin_station_id") == 1, str(t.get("origin_station_id")))
    check("destination_station_id=2",   t.get("destination_station_id") == 2, str(t.get("destination_station_id")))


print("\n" + "=" * 60)
print("GET /api/trains/12951")
print("=" * 60)
status, body = get(f"{BASE}/api/trains/12951")
check("HTTP 200",                    status == 200,                          f"got {status}")
check("number=12951",                body.get("number") == "12951",          body.get("number"))
check("origin station name",         body.get("origin_station", {}).get("name") == "Mumbai Central",
      body.get("origin_station", {}).get("name"))
check("origin station code=BCT",     body.get("origin_station", {}).get("code") == "BCT",
      body.get("origin_station", {}).get("code"))
check("dest station name",           body.get("destination_station", {}).get("name") == "New Delhi",
      body.get("destination_station", {}).get("name"))
check("dest station code=NDLS",      body.get("destination_station", {}).get("code") == "NDLS",
      body.get("destination_station", {}).get("code"))
check("train_type=Rajdhani",         body.get("train_type") == "Rajdhani",   body.get("train_type"))
check("no confidence_pct",           "confidence_pct" not in body,           "absent" if "confidence_pct" not in body else "PRESENT - BAD")


print("\n" + "=" * 60)
print("GET /api/trains/12951/eta")
print("=" * 60)
status, body = get(f"{BASE}/api/trains/12951/eta")
check("HTTP 200",                   status == 200,                              f"got {status}")
check("train_id=12951",             body.get("train_id") == "12951",            body.get("train_id"))
check("current_station correct",    body.get("current_station") == "Vadodara Junction",
      body.get("current_station"))
check("next_station correct",       body.get("next_station") == "New Delhi",    body.get("next_station"))
check("current_speed=104",          body.get("current_speed") == 104,           str(body.get("current_speed")))
check("current_delay=42",           body.get("current_delay") == 42,            str(body.get("current_delay")))
check("predicted_eta present",      bool(body.get("predicted_eta")),            body.get("predicted_eta"))
check("scheduled_eta present",      bool(body.get("scheduled_eta")),            body.get("scheduled_eta"))
check("eta_lower present",          bool(body.get("eta_lower")),                body.get("eta_lower"))
check("eta_upper present",          bool(body.get("eta_upper")),                body.get("eta_upper"))
check("uncertainty_minutes=5",      body.get("uncertainty_minutes") == 5,       str(body.get("uncertainty_minutes")))
check("delay_adjustment=-8",        body.get("delay_adjustment") == -8,         str(body.get("delay_adjustment")))
check("last_updated present",       bool(body.get("last_updated")),             body.get("last_updated"))
check("NO confidence_pct",          "confidence_pct" not in body,              "absent" if "confidence_pct" not in body else "PRESENT - BAD")
# Verify all 13 contract fields exactly
expected_keys = {
    "train_id", "current_station", "next_station", "current_speed",
    "current_delay", "scheduled_eta", "predicted_eta", "predicted_delay",
    "eta_lower", "eta_upper", "uncertainty_minutes", "delay_adjustment", "last_updated"
}
actual_keys = set(body.keys())
check("Exact contract fields match", actual_keys == expected_keys,
      f"extra={actual_keys-expected_keys} missing={expected_keys-actual_keys}")


print("\n" + "=" * 60)
print("GET /api/trains/12951/route-eta")
print("=" * 60)
status, body = get(f"{BASE}/api/trains/12951/route-eta")
check("HTTP 200",               status == 200,                      f"got {status}")
check("train_id=12951",         body.get("train_id") == "12951",    body.get("train_id"))
check("updated_at present",     bool(body.get("updated_at")),       body.get("updated_at"))
check("stations is list",       isinstance(body.get("stations"), list), str(type(body.get("stations"))))
check("1 station entry",        len(body.get("stations", [])) == 1, f"count={len(body.get('stations', []))}")
if body.get("stations"):
    s = body["stations"][0]
    check("station train_id=12951",     s.get("train_id") == "12951",           s.get("train_id"))
    check("station predicted_eta set",  bool(s.get("predicted_eta")),            s.get("predicted_eta"))
    check("station eta_lower set",      bool(s.get("eta_lower")),                s.get("eta_lower"))
    check("station eta_upper set",      bool(s.get("eta_upper")),                s.get("eta_upper"))
    check("station NO confidence_pct",  "confidence_pct" not in s,              "absent" if "confidence_pct" not in s else "PRESENT - BAD")
    check("route-eta contract fields",  set(s.keys()) == expected_keys,
          f"extra={set(s.keys())-expected_keys} missing={expected_keys-set(s.keys())}")


print("\n" + "=" * 60)
print("404 error handling")
print("=" * 60)
status, body = get(f"{BASE}/api/trains/INVALID_TRAIN")
check("trains/INVALID => 404",          status == 404,          f"got {status}")
check("error has detail field",         "detail" in body,       body.get("detail"))

status, body = get(f"{BASE}/api/trains/INVALID_TRAIN/eta")
check("trains/INVALID/eta => 404",      status == 404,          f"got {status}")
check("eta error has detail",           "detail" in body,       body.get("detail"))

status, body = get(f"{BASE}/api/trains/INVALID_TRAIN/route-eta")
check("trains/INVALID/route-eta => 404", status == 404,         f"got {status}")
check("route-eta error has detail",      "detail" in body,      body.get("detail"))


print("\n" + "=" * 60)
print("M3 stub verification")
print("=" * 60)
sys.path.insert(0, "C:/Users/Admin/OneDrive/Desktop/railway")
import inspect
from backend.services.eta_service import call_dynamic_eta_engine
src = inspect.getsource(call_dynamic_eta_engine)
check("stub returns None",          call_dynamic_eta_engine(999) is None,    "None")
check("no ML logic in stub",        "return None" in src,                    "confirmed")
check("TODO M3 marker present",     "TODO (M3)" in src,                      "confirmed")


print("\n" + "=" * 60)
print("SUMMARY")
print("=" * 60)
passed = sum(1 for _, s, _ in results if s == PASS)
failed = sum(1 for _, s, _ in results if s == FAIL)
print(f"  Total : {len(results)}")
print(f"  PASS  : {passed}")
print(f"  FAIL  : {failed}")
if failed:
    print("\nFailed checks:")
    for name, s, detail in results:
        if s == FAIL:
            print(f"  ✗ {name}: {detail}")
    sys.exit(1)
else:
    print("\n  All checks passed.")
