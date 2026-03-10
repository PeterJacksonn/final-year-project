import shutil
import tempfile
from contextlib import asynccontextmanager

import httpx
import asyncpg
from fastapi import FastAPI, UploadFile, File, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

from ingest import parse_csv, upsert_entities

DB_DSN = "postgresql://quantumleap:quantumleap@localhost:5432/quantumleap"
ORION_URL = "http://localhost:1026"

PARAMETERS = [
    "pH", "temperature", "dissolvedOxygen", "oxygenSaturation",
    "conductivity", "ammoniacalNitrogen", "phosphate", "bod",
    "nitrate", "nitrite"
]

DB_COLUMNS = {
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

PARAMETER_META = {
    "pH":                {"label": "pH",                  "unit": "pH units"},
    "temperature":       {"label": "Temperature",         "unit": "°C"},
    "dissolvedOxygen":   {"label": "Dissolved Oxygen",    "unit": "mg/L"},
    "oxygenSaturation":  {"label": "Oxygen Saturation",   "unit": "%"},
    "conductivity":      {"label": "Conductivity",        "unit": "µS/cm"},
    "ammoniacalNitrogen":{"label": "Ammoniacal Nitrogen", "unit": "mg/L"},
    "phosphate":         {"label": "Phosphate",           "unit": "mg/L"},
    "bod":               {"label": "BOD (5-Day ATU)",     "unit": "mg/L"},
    "nitrate":           {"label": "Nitrate",             "unit": "mg/L"},
    "nitrite":           {"label": "Nitrite",             "unit": "mg/L"},
}

db_pool = None

@asynccontextmanager
async def lifespan(app):
    global db_pool
    db_pool = await asyncpg.create_pool(DB_DSN)
    yield
    await db_pool.close()

app = FastAPI(title="Water Quality API", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/health")
def health():
    return {"status": "ok"}


@app.get("/api/waterbody")
async def get_waterbody():
    async with httpx.AsyncClient() as client:
        r = await client.get(
            f"{ORION_URL}/ngsi-ld/v1/entities",
            params={"type": "WaterBody"},
            headers={"Accept": "application/json"},
        )
    if r.status_code != 200:
        raise HTTPException(status_code=502, detail="Failed to fetch water bodies")
    return r.json()


@app.get("/api/stations")
async def get_stations():
    async with httpx.AsyncClient() as client:
        r = await client.get(
            f"{ORION_URL}/ngsi-ld/v1/entities",
            params={"type": "WaterQualityStation", "limit": 100},
            headers={"Accept": "application/json"},
        )
    if r.status_code != 200:
        raise HTTPException(status_code=502, detail="Failed to fetch stations")
    return r.json()


@app.get("/api/stations/{station_id}/latest")
async def get_latest(station_id: str):
    id_prefix = f"urn:ngsi-ld:WaterQualityObserved:{station_id}:%"
    results = {}

    async with db_pool.acquire() as conn:
        for param, col in DB_COLUMNS.items():
            row = await conn.fetchrow(
                f"""
                SELECT {col}, time_index
                FROM etwaterqualityobserved
                WHERE entity_id LIKE $1
                  AND {col} IS NOT NULL
                ORDER BY time_index DESC
                LIMIT 1
                """,
                id_prefix,
            )
            if row and row[col] is not None:
                results[param] = {
                    "value": float(row[col]),
                    "timestamp": row["time_index"].isoformat(),
                    **PARAMETER_META[param],
                }

    return {"stationId": station_id, "readings": results}


@app.get("/api/stations/{station_id}/history/{param}")
async def get_history(station_id: str, param: str, limit: int = 100):
    if param not in PARAMETERS:
        raise HTTPException(status_code=400, detail=f"Unknown parameter: {param}")

    col = DB_COLUMNS[param]
    id_prefix = f"urn:ngsi-ld:WaterQualityObserved:{station_id}:%"

    async with db_pool.acquire() as conn:
        rows = await conn.fetch(
            f"""
            SELECT time_index, {col}
            FROM etwaterqualityobserved
            WHERE entity_id LIKE $1
              AND {col} IS NOT NULL
            ORDER BY time_index ASC
            LIMIT $2
            """,
            id_prefix,
            limit,
        )

    series = [
        {"timestamp": r["time_index"].isoformat(), "value": float(r[col])}
        for r in rows
    ]

    return {
        "stationId": station_id,
        "param": param,
        "meta": PARAMETER_META[param],
        "data": series,
    }


@app.post("/api/ingest/upload")
async def ingest_upload(file: UploadFile = File(...)):
    if not file.filename.endswith(".csv"):
        raise HTTPException(status_code=400, detail="Only CSV files are supported.")

    with tempfile.NamedTemporaryFile(delete=False, suffix=".csv") as tmp:
        shutil.copyfileobj(file.file, tmp)
        tmp_path = tmp.name

    try:
        entities = parse_csv(tmp_path)
    except Exception as e:
        raise HTTPException(status_code=422, detail=f"Failed to parse CSV: {str(e)}")

    if not entities:
        raise HTTPException(status_code=422, detail="No valid observations found in CSV.")

    results = upsert_entities(entities)

    return {
        "filename": file.filename,
        "entities_parsed": results["total"],
        "created": results["created"],
        "updated": results["updated"],
        "failed": results["failed"],
    }


# Serve frontend — must be last
app.mount("/", StaticFiles(directory="static", html=True), name="static")
