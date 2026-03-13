"""
Simulates real-time water quality readings for NE-49301997.
Derives mean/stddev from historical EA data, then generates plausible
values every INTERVAL seconds and PATCHes them into Orion-LD.
"""

import time
import random
import signal
import sys
from datetime import datetime, timezone

import requests
import psycopg2

ORION_URL = "http://localhost:1026"
DB_DSN = "dbname=quantumleap user=quantumleap password=quantumleap host=localhost port=5432"
STATION_ID = "NE-49301997"
ENTITY_ID = f"urn:ngsi-ld:WaterQualityObserved:{STATION_ID}:simulated"
INTERVAL = 5  # seconds

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

# Reasonable hard limits to keep values realistic
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


def get_historical_stats():
    """Query TimescaleDB for mean and stddev of each parameter."""
    print("📊 Loading historical statistics from TimescaleDB...")
    stats = {}
    id_prefix = f"urn:ngsi-ld:WaterQualityObserved:{STATION_ID}:%"

    conn = psycopg2.connect(DB_DSN)
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
            # Fall back to sensible defaults if not enough data
            lo, hi = CLAMP[param]
            mean = (lo + hi) / 2
            stddev = (hi - lo) / 10

        stats[param] = {
            "mean": float(mean),
            "stddev": float(stddev) if stddev else float(mean) * 0.05,
        }
        print(f"  {param:22s} mean={stats[param]['mean']:.4f}  stddev={stats[param]['stddev']:.4f}  (n={count})")

    cur.close()
    conn.close()
    return stats


def generate_value(param, stats, previous):
    """
    Generate next value using a random walk bounded by historical stddev.
    Reverts toward the mean over time (mean-reverting random walk).
    """
    s = stats[param]
    mean, stddev = s["mean"], s["stddev"]

    if previous is None:
        previous = mean

    # Mean-reverting step: nudge toward mean + small random perturbation
    reversion = 0.1 * (mean - previous)
    noise = random.gauss(0, stddev * 0.3)
    new_val = previous + reversion + noise

    # Clamp to hard limits
    lo, hi = CLAMP[param]
    new_val = max(lo, min(hi, new_val))

    # Round sensibly
    if param in ("pH", "temperature", "oxygenSaturation"):
        return round(new_val, 1)
    elif param == "conductivity":
        return round(new_val, 0)
    else:
        return round(new_val, 3)


def ensure_entity_exists():
    """Create the simulated entity in Orion if it doesn't exist yet."""
    url = f"{ORION_URL}/ngsi-ld/v1/entities/{ENTITY_ID}"
    r = requests.get(url)
    if r.status_code == 200:
        return  # Already exists

    print(f"Creating simulated entity {ENTITY_ID}...")
    entity = {
        "id": ENTITY_ID,
        "type": "WaterQualityObserved",
        "@context": "https://uri.etsi.org/ngsi-ld/v1/ngsi-ld-core-context.jsonld",
        "refStation": {
            "type": "Relationship",
            "object": f"urn:ngsi-ld:WaterQualityStation:{STATION_ID}",
        },
        "location": {
            "type": "GeoProperty",
            "value": {"type": "Point", "coordinates": [-1.4631, 53.374]},
        },
        "pH": {"type": "Property", "value": 7.5},
    }
    r = requests.post(
        f"{ORION_URL}/ngsi-ld/v1/entities",
        json=entity,
        headers={"Content-Type": "application/ld+json"},
    )
    if r.status_code not in (201, 409):
        print(f"  Warning: unexpected status {r.status_code}: {r.text}")


def patch_entity(values):
    """PATCH all parameter values onto the simulated entity."""
    now = datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")

    attrs = {"@context": "https://uri.etsi.org/ngsi-ld/v1/ngsi-ld-core-context.jsonld"}
    for param, value in values.items():
        prop = {"type": "Property", "value": value, "observedAt": now}
        unit = UNIT_CODES.get(param)
        if unit:
            prop["unitCode"] = unit
        attrs[param] = prop

    r = requests.patch(
        f"{ORION_URL}/ngsi-ld/v1/entities/{ENTITY_ID}/attrs",
        json=attrs,
        headers={"Content-Type": "application/ld+json"},
    )
    return r.status_code


def main():
    print("🌊 Water Quality Simulator")
    print(f"   Station : {STATION_ID}")
    print(f"   Entity  : {ENTITY_ID}")
    print(f"   Interval: {INTERVAL}s")
    print()

    stats = get_historical_stats()
    ensure_entity_exists()

    previous = {p: stats[p]["mean"] for p in PARAMETERS}

    def handle_exit(sig, frame):
        print("\n\nStopped.")
        sys.exit(0)

    signal.signal(signal.SIGINT, handle_exit)

    print("\n▶  Simulating — Ctrl+C to stop\n")

    tick = 0
    while True:
        tick += 1
        now = datetime.now(timezone.utc).strftime("%H:%M:%S")
        values = {}

        for param in PARAMETERS:
            values[param] = generate_value(param, stats, previous[param])
            previous[param] = values[param]

        status = patch_entity(values)
        indicator = "✓" if status == 204 else f"✗ {status}"

        print(
            f"[{now}] tick={tick:04d} {indicator}  "
            f"pH={values['pH']}  "
            f"T={values['temperature']}°C  "
            f"DO={values['dissolvedOxygen']}mg/L  "
            f"cond={values['conductivity']}"
        )

        time.sleep(INTERVAL)


if __name__ == "__main__":
    main()
