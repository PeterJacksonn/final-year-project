from datetime import datetime, timezone, timedelta
from app.database import get_pool
from app.config import DB_COLUMNS, PARAMETER_META, PARAMETERS
from fastapi import HTTPException


async def get_latest_readings(station_id: str) -> dict:
    # Match all WaterQualityObserved entities belonging to this station
    # (entity IDs follow the pattern urn:ngsi-ld:WaterQualityObserved:{station_id}:{timestamp})
    id_prefix = f"urn:ngsi-ld:WaterQualityObserved:{station_id}:%"
    results = {}
    pool = get_pool()

    async with pool.acquire() as conn:
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


async def get_parameter_history(station_id: str, param: str, hours: int = 24) -> dict:
    # Queries TimescaleDB time-series table written by QuantumLeap subscription notifications
    if param not in PARAMETERS:
        raise HTTPException(status_code=400, detail=f"Unknown parameter: {param}")

    col = DB_COLUMNS[param]
    id_prefix = f"urn:ngsi-ld:WaterQualityObserved:{station_id}:%"
    pool = get_pool()

    cutoff = datetime.now(timezone.utc) - timedelta(hours=hours)

    async with pool.acquire() as conn:
        rows = await conn.fetch(
            f"""
            SELECT time_index, {col}
            FROM etwaterqualityobserved
            WHERE entity_id LIKE $1
              AND {col} IS NOT NULL
              AND time_index >= $2
            ORDER BY time_index ASC
            LIMIT 2000
            """,
            id_prefix,
            cutoff,
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
