from fastapi import APIRouter
from app.services import orion, timescale

router = APIRouter(prefix="/api", tags=["observations"])


@router.get("/waterbody")
async def get_waterbody():
    # Fetches all WaterBody entities from Orion-LD context broker
    return await orion.fetch_entities("WaterBody")


@router.get("/stations")
async def get_stations():
    # Fetches all WaterQualityStation entities from Orion-LD (current state only)
    return await orion.fetch_entities("WaterQualityStation", limit=100)


@router.get("/stations/{station_id}/latest")
async def get_latest(station_id: str):
    # Queries TimescaleDB directly for the most recent reading per parameter;
    # bypasses QuantumLeap's REST API due to reliability issues found during development
    return await timescale.get_latest_readings(station_id)


@router.get("/stations/{station_id}/history/{param}")
async def get_history(station_id: str, param: str, hours: int = 24):
    # Returns time-series data for a single parameter from TimescaleDB,
    # written there by QuantumLeap via NGSI-LD subscription notifications
    return await timescale.get_parameter_history(station_id, param, hours)
