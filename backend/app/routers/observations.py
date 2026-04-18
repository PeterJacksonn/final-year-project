from fastapi import APIRouter
from app.services import orion, timescale

router = APIRouter(prefix="/api", tags=["observations"])


@router.get("/waterbody")
async def get_waterbody():
    return await orion.fetch_entities("WaterBody")


@router.get("/stations")
async def get_stations():
    return await orion.fetch_entities("WaterQualityStation", limit=100)


@router.get("/stations/{station_id}/latest")
async def get_latest(station_id: str):
    return await timescale.get_latest_readings(station_id)


@router.get("/stations/{station_id}/history/{param}")
async def get_history(station_id: str, param: str, hours: int = 24):
    return await timescale.get_parameter_history(station_id, param, hours)
