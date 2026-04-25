"""
Simulates real-time water quality readings for all WaterQualityStation entities.

For each station, derives mean/stddev from historical TimescaleDB data, then
generates plausible values every INTERVAL seconds using a mean-reverting random
walk and PATCHes them into Orion-LD as WaterQualityObserved entities.

Usage:
    python simulate_realtime.py [--interval N] [--stations ID1,ID2,...]

    --interval   Seconds between updates (default: 5)
    --stations   Comma-separated EA notation IDs to simulate (default: all)
"""

import argparse
import signal
import sys
import time
import random
from datetime import datetime, timezone

import requests
import psycopg2

ORION_URL = "http://localhost:1026"
DB_DSN = "dbname=quantumleap user=quantumleap password=quantumleap host=localhost port=5432"
NGSI_LD_CONTEXT = "https://uri.etsi.org/ngsi-ld/v1/ngsi-ld-core-context.jsonld"

PARAMETERS = {
    "pH":                 "ph",
    "temperature":        "temperature",
    "dissolvedOxygen":    "dissolvedoxygen",
    "oxygenSaturation":   "oxygensaturation",
    "conductivity":       "conductivity",
    "ammoniacalNitrogen": "ammoniacalnitrogen",
    "phosphate":          "phosphate",
    "bod":                "bod",
    "nitrate":            "nitrate",
    "nitrite":            "nitrite",
}

UNIT_CODES = {
    "pH":                 None,
    "temperature":        "CEL",
    "dissolvedOxygen":    "M1",
    "oxygenSaturation":   "P1",
    "conductivity":       "G42",
    "ammoniacalNitrogen": "M1",
    "phosphate":          "M1",
    "bod":                "M1",
    "nitrate":            "M1",
    "nitrite":            "M1",
}

CLAMP = {
    "pH":                 (6.0, 10.0),
    "temperature":        (0.0, 25.0),
    "dissolvedOxygen":    (4.0, 20.0),
    "oxygenSaturation":   (50.0, 130.0),
    "conductivity":       (100.0, 2000.0),
    "ammoniacalNitrogen": (0.001, 2.0),
    "phosphate":          (0.001, 1.0),
    "bod":                (0.5, 10.0),
    "nitrate":            (0.1, 10.0),
    "nitrite":            (0.001, 0.5),
}


# ─── Orion helpers ────────────────────────────────────────────────────────────

def fetch_all_stations(filter_ids=None):
    """Return list of (ea_notation, entity_id) for all WaterQualityStation entities."""
    stations = []
    offset = 0
    limit = 100

    while True:
        r = requests.get(
            f"{ORION_URL}/ngsi-ld/v1/entities",
            params={"type": "WaterQualityStation", "limit": limit, "offset": offset},
            headers={"Accept": "application/ld+json"},
        )
        r.raise_for_status()
        batch = r.json()
        if not batch:
            break

        for entity in batch:
            ea = (
                entity.get("eaNotation", {}).get("value")
                or entity.get("id", "").split(":")[-1]
            )
            if filter_ids and ea not in filter_ids:
                continue
            stations.append({"ea": ea, "entity_id": entity["id"]})

        if len(batch) < limit:
            break
        offset += limit

    return stations


def ensure_entity_exists(station):
    """Create the WaterQualityObserved simulated entity in Orion if missing."""
    sim_id = f"urn:ngsi-ld:WaterQualityObserved:{station['ea']}:simulated"
    url = f"{ORION_URL}/ngsi-ld/v1/entities/{sim_id}"

    # Delete and recreate to ensure all 10 parameters exist as attributes.
    # PATCH /attrs only updates existing attributes — if an attribute wasn't in the
    # original entity, it will be silently skipped on every subsequent PATCH.
    requests.delete(url)

    s = station.get("stats", {})
    entity = {
        "id": sim_id,
        "type": "WaterQualityObserved",
        "@context": NGSI_LD_CONTEXT,
        "refStation": {
            "type": "Relationship",
            "object": station["entity_id"],
        },
    }
    for param, (lo, hi) in CLAMP.items():
        mean = s.get(param, {}).get("mean", (lo + hi) / 2)
        prop = {"type": "Property", "value": round(mean, 3)}
        unit = UNIT_CODES.get(param)
        if unit:
            prop["unitCode"] = unit
        entity[param] = prop

    r = requests.post(
        f"{ORION_URL}/ngsi-ld/v1/entities",
        json=entity,
        headers={"Content-Type": "application/ld+json"},
    )
    if r.status_code not in (201, 409):
        print(f"  Warning [{station['ea']}]: entity create returned {r.status_code}")

    station["sim_id"] = sim_id


def patch_station(station, values):
    """PATCH all parameter values onto the station's simulated entity."""
    import json as _json
    now = datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")
    attrs = {"@context": NGSI_LD_CONTEXT}

    for param, value in values.items():
        prop = {"type": "Property", "value": value, "observedAt": now}
        unit = UNIT_CODES.get(param)
        if unit:
            prop["unitCode"] = unit
        attrs[param] = prop

    r = requests.patch(
        f"{ORION_URL}/ngsi-ld/v1/entities/{station['sim_id']}/attrs",
        data=_json.dumps(attrs),
        headers={"Content-Type": "application/ld+json"},
    )
    return r.status_code


# ─── TimescaleDB helpers ──────────────────────────────────────────────────────

def load_stats_for_station(conn, ea):
    """Query mean/stddev of each parameter for a given station."""
    stats = {}
    id_prefix = f"urn:ngsi-ld:WaterQualityObserved:{ea}:%"
    cur = conn.cursor()

    for param, col in PARAMETERS.items():
        cur.execute(
            f"""
            SELECT AVG({col}), STDDEV({col}), COUNT({col})
            FROM etwaterqualityobserved
            WHERE entity_id LIKE %s AND {col} IS NOT NULL
            """,
            (id_prefix,),
        )
        row = cur.fetchone()
        mean, stddev, count = row

        if mean is None or count < 2:
            lo, hi = CLAMP[param]
            mean = (lo + hi) / 2
            stddev = (hi - lo) / 10

        stats[param] = {
            "mean": float(mean),
            "stddev": float(stddev) if stddev else float(mean) * 0.05,
        }

    cur.close()
    return stats


# ─── Simulation logic ─────────────────────────────────────────────────────────

def generate_value(param, stats, previous):
    """Mean-reverting random walk, clamped to hard limits.

    Uses an Ornstein-Uhlenbeck-style update:
        new = previous + θ(μ - previous) + σ·ε
    where θ=0.1 (reversion strength), μ=historical mean, σ=0.3·stddev, ε~N(0,1).
    Mean and stddev are derived from real EA data in TimescaleDB.
    """
    s = stats[param]
    mean, stddev = s["mean"], s["stddev"]
    if previous is None:
        previous = mean

    reversion = 0.1 * (mean - previous)   # pull toward historical mean
    noise = random.gauss(0, stddev * 0.3)  # scaled Gaussian noise
    new_val = previous + reversion + noise

    lo, hi = CLAMP[param]
    new_val = max(lo, min(hi, new_val))

    if param in ("pH", "temperature", "oxygenSaturation"):
        return round(new_val, 1)
    elif param == "conductivity":
        return round(new_val, 0)
    else:
        return round(new_val, 3)


def simulate_station(station):
    """Generate next values, PATCH Orion, return (status_or_error, new_values)."""
    new_values = {}
    for param in PARAMETERS:
        new_values[param] = generate_value(param, station["stats"], station["previous"].get(param))
    station["previous"] = new_values
    try:
        status = patch_station(station, new_values)
    except Exception as e:
        return f"ERR:{e}", {}
    return status, new_values


# ─── Main ─────────────────────────────────────────────────────────────────────

def main():
    parser = argparse.ArgumentParser(description="Water quality real-time simulator")
    parser.add_argument("--interval", type=float, default=5.0,
                        help="Seconds between updates (default: 5)")
    parser.add_argument("--stations", type=str, default=None,
                        help="Comma-separated EA notation IDs (default: all)")
    args = parser.parse_args()

    filter_ids = set(args.stations.split(",")) if args.stations else None

    print("Water Quality Simulator")
    print(f"  Interval : {args.interval}s")
    if filter_ids:
        print(f"  Stations : {', '.join(sorted(filter_ids))}")
    else:
        print("  Stations : all")
    print()

    # Fetch stations from Orion
    print("Fetching stations from Orion...")
    stations = fetch_all_stations(filter_ids)
    if not stations:
        print("No stations found. Is Orion running and populated?")
        sys.exit(1)
    print(f"Found {len(stations)} station(s)\n")

    # Load historical stats from TimescaleDB
    print("Loading historical statistics from TimescaleDB...")
    conn = psycopg2.connect(DB_DSN)
    for station in stations:
        station["stats"] = load_stats_for_station(conn, station["ea"])
        station["previous"] = {p: station["stats"][p]["mean"] for p in PARAMETERS}
        print(f"  {station['ea']:20s} stats loaded")
    conn.close()
    print()

    # Ensure simulated entities exist in Orion
    print("Ensuring simulated entities exist...")
    for station in stations:
        ensure_entity_exists(station)
        print(f"  {station['ea']:20s} -> {station['sim_id']}")
    print()

    def handle_exit(sig, frame):
        print("\nStopped.")
        sys.exit(0)

    signal.signal(signal.SIGINT, handle_exit)

    print(f"Simulating {len(stations)} station(s) — Ctrl+C to stop\n")

    tick = 0
    while True:
        tick += 1
        now = datetime.now(timezone.utc).strftime("%H:%M:%S")
        tick_results = {}

        for station in stations:
            tick_results[station["ea"]] = simulate_station(station)

        ok = sum(1 for code, _ in tick_results.values() if isinstance(code, int) and code in (204, 207))
        errors = [(ea, code) for ea, (code, _) in tick_results.items() if not isinstance(code, int) or code not in (204, 207)]

        status_str = f"{ok}/{len(stations)} ok"
        if errors:
            status_str += "  ERRORS: " + ", ".join(f"{ea}={code}" for ea, code in errors)

        sample_ea = stations[0]["ea"]
        sample_vals = tick_results.get(sample_ea, (None, {}))[1]
        print(
            f"[{now}] tick={tick:04d}  {status_str}  |  "
            f"{sample_ea}: "
            f"pH={sample_vals.get('pH', '?')}  "
            f"T={sample_vals.get('temperature', '?')}°C  "
            f"DO={sample_vals.get('dissolvedOxygen', '?')}mg/L"
        )

        time.sleep(args.interval)


if __name__ == "__main__":
    main()
