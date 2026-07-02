# Design and Implementation of a Real-Time Water Quality Monitoring System Using FIWARE

**Peter Jackson**\
Final Year Project, Sheffield Hallam University\
Supervisor: Dr. Carlos Eduardo da Silva

---

## Abstract

Environmental monitoring often relies on periodic sampling, producing infrequent and retrospective
data. A further challenge is the semantic incompatibility of proprietary monitoring infrastructure,
limiting data integration and exchange across institutional boundaries. This project investigated the
application of FIWARE and the NGSI-LD standard to address both challenges through the design
and implementation of a real-time water quality monitoring system, contributing to a broader
initiative to establish a federated water data space.

The system was implemented using Orion-LD as the NGSI-LD context broker, QuantumLeap and
TimescaleDB for time-series data persistence, and a React web frontend providing real-time and
historical data visualisation, map-based navigation, and entity management. A WFD-aligned entity
hierarchy was implemented using Smart Data Models, and system viability was demonstrated
through simulation of real-time sensor updates derived from historical Environment Agency data.

All project objectives were successfully achieved, with the results demonstrating that NGSI-LD and
linked data principles provide a practical foundation for semantic interoperability in environmental
monitoring, enabling meaningful data exchange across institutional boundaries without requiring
bespoke integration layers. The system thus represents a viable contribution to the development of a
federated data space, consistent with approaches demonstrated by the AD4GD and WATERVERSE
projects.

---

## System Architecture

![Container Diagram](docs/c4-diagrams/Diagram2.png)

---

## Technology Stack

| Layer | Technology |
|---|---|
| Context Broker | FIWARE Orion-LD |
| Time-Series Persistence | QuantumLeap + TimescaleDB |
| Context Store | MongoDB |
| LD Context Server | Apache httpd |
| Backend API | FastAPI (Python) |
| Frontend | React 19, Vite, Tailwind CSS, Leaflet, Recharts |

---

## Prerequisites

- Docker and Docker Compose
- Python 3.12+
- Node.js 20+ and pnpm
- psql (for database verification)

---

## Running the System

### 1. Start the FIWARE stack

```bash
docker compose up -d
```

This starts Orion-LD, MongoDB, QuantumLeap, TimescaleDB, and the LD Context Server.

### 2. Create the QuantumLeap subscription

> **Important:** This must be re-run every time the stack is brought down and back up, since Orion-LD's subscription state lives in MongoDB but is not recreated automatically.

```bash
curl -X POST http://localhost:1026/ngsi-ld/v1/subscriptions \
  -H "Content-Type: application/ld+json" \
  -d '{
    "type": "Subscription",
    "entities": [{"type": "WaterQualityObserved"}],
    "notification": {
      "format": "normalized",
      "endpoint": {
        "uri": "http://quantumleap:8668/v2/notify",
        "accept": "application/json"
      }
    },
    "@context": "https://uri.etsi.org/ngsi-ld/v1/ngsi-ld-core-context.jsonld"
  }'
```

### 3. Start the backend

```bash
cd backend
pip install -r requirements.txt
fastapi dev app/main.py
```

The API runs on `http://localhost:8000` (the frontend dev server proxies `/api` to this port).

### 4. Start the frontend

```bash
cd frontend
pnpm install
pnpm dev
```

The application will be available at `http://localhost:5173`.

---

## Ingesting Data

Environment Agency water quality CSV files can be uploaded via the Entity Manager page (`/entities`) in the frontend. The `samplingPoint.notation` field in the CSV automatically routes observations to the correct station, and rows are grouped by sampling point and observation time so that each site visit becomes a single `WaterQualityObserved` entity.

Sample data for the River Sheaf catchment (Sheffield) is available from the [EA open data API](https://environment.data.gov.uk/water-quality/).

---

## Running the Real-Time Simulator

```bash
cd backend
python scripts/simulate_realtime.py
```

Optional arguments:
```
--interval N       Seconds between updates (default: 5)
--stations ID1,ID2 Comma-separated EA notation IDs to simulate (default: all)
```

The simulator seeds from historical TimescaleDB statistics for each station and generates plausible values every `interval` seconds using a mean-reverting random walk, which it PATCHes into Orion-LD as `WaterQualityObserved` entities. QuantumLeap picks these up via the subscription created above and writes them to TimescaleDB, which the frontend then polls — observable live on the dashboard.

---

## Project Structure

```
.
├── backend/
│   ├── app/
│   │   ├── main.py                 # FastAPI app, router registration
│   │   ├── config.py               # NGSI-LD/DB constants, parameter metadata
│   │   ├── database.py             # asyncpg pool lifecycle
│   │   ├── routers/
│   │   │   ├── observations.py     # station/history endpoints (reads TimescaleDB + Orion)
│   │   │   ├── ingest.py           # CSV upload endpoint
│   │   │   └── entities.py         # generic entity CRUD (Entity Manager)
│   │   └── services/
│   │       ├── orion.py            # Orion-LD entity fetch/create/delete
│   │       └── timescale.py        # TimescaleDB queries for latest/history readings
│   ├── ingest/
│   │   ├── parser.py               # EA CSV → NGSI-LD WaterQualityObserved entities
│   │   └── orion.py                # upsert logic used by the ingest endpoint
│   ├── scripts/
│   │   └── simulate_realtime.py    # real-time sensor simulation
│   └── sample-data/                # example EA CSV exports
├── frontend/
│   └── src/
│       ├── pages/
│       │   ├── Dashboard.jsx       # real-time + historical charts
│       │   ├── MapView.jsx         # Leaflet map, station/group navigation
│       │   └── EntityManager.jsx   # entity CRUD + CSV upload UI
│       ├── components/             # Chart, Header, Sidebar, ParameterCard
│       ├── api/client.js           # axios instance
│       └── utils/station.js
├── data-models/                    # example NGSI-LD entities (WaterBody, WaterQualityStation, ...)
├── context/
│   └── ngsi-context.jsonld         # served by the LD Context Server (httpd)
├── docker/
│   └── db-init/                    # TimescaleDB extension bootstrap
├── docs/
│   └── c4-diagrams/                # C4 architecture diagrams
└── docker-compose.yml
```

---

## Verifying the Pipeline

To confirm the NGSI-LD subscription pipeline is working:

```bash
# Check current row count
psql postgresql://quantumleap:quantumleap@localhost:5432/quantumleap \
  -c "SELECT COUNT(*) FROM etwaterqualityobserved;"

# POST a test entity
curl -X POST http://localhost:1026/ngsi-ld/v1/entities \
  -H "Content-Type: application/ld+json" \
  -d '{
    "id": "urn:ngsi-ld:WaterQualityObserved:test:001",
    "type": "WaterQualityObserved",
    "@context": "https://uri.etsi.org/ngsi-ld/v1/ngsi-ld-core-context.jsonld",
    "pH": {"type": "Property", "value": 7.4}
  }'

# Confirm row count increased
psql postgresql://quantumleap:quantumleap@localhost:5432/quantumleap \
  -c "SELECT COUNT(*) FROM etwaterqualityobserved;"
```
