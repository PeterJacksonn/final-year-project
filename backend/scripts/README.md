# Scripts

## simulate_realtime.py

Simulates live sensor data for all WaterQualityStation entities in Orion-LD.

For each station, it loads historical mean/stddev from TimescaleDB, then generates
plausible values every N seconds using a mean-reverting random walk and PATCHes
them into Orion as `WaterQualityObserved` entities. QuantumLeap picks these up via
subscription and writes them to TimescaleDB, which the frontend then polls.

### Prerequisites

- Docker stack running (`docker compose up -d` from project root)
- QuantumLeap subscription recreated (see project root SETUP.md)
- Backend virtualenv active (`source backend/.venv/bin/activate`)
- `requests` and `psycopg2` installed in the venv

### Usage

```bash
cd backend
python scripts/simulate_realtime.py [--interval N] [--stations ID1,ID2,...]
```

### Arguments

| Argument | Default | Description |
|---|---|---|
| `--interval` | `5` | Seconds between updates |
| `--stations` | all | Comma-separated EA notation IDs to simulate |

### Examples

```bash
# Simulate all stations every 5 seconds
python scripts/simulate_realtime.py

# Simulate all stations every 10 seconds
python scripts/simulate_realtime.py --interval 10

# Simulate two specific stations every 30 seconds
python scripts/simulate_realtime.py --interval 30 --stations NE-49301997,NE-49302001
```

Stop with `Ctrl+C`.
