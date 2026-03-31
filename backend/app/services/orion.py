import httpx
from fastapi import HTTPException
from app.config import ORION_URL, NGSI_LD_CONTEXT

# Headers for NGSI-LD requests
_JSON_HEADERS = {
    "Accept": "application/json",
    "Link": f'<{NGSI_LD_CONTEXT}>; rel="http://www.w3.org/ns/json-ld#context"; type="application/ld+json"',
}

_LD_JSON_HEADERS = {
    "Content-Type": "application/ld+json",
    "Accept": "application/ld+json",
}


async def fetch_entities(entity_type: str, limit: int = 100) -> list:
    async with httpx.AsyncClient() as client:
        r = await client.get(
            f"{ORION_URL}/ngsi-ld/v1/entities",
            params={"type": entity_type, "limit": limit},
            headers=_JSON_HEADERS,
        )
    if r.status_code != 200:
        raise HTTPException(
            status_code=502,
            detail=f"Orion returned {r.status_code} fetching {entity_type}: {r.text}",
        )
    return r.json()


async def create_entity(entity: dict) -> None:
    async with httpx.AsyncClient() as client:
        r = await client.post(
            f"{ORION_URL}/ngsi-ld/v1/entities",
            json=entity,
            headers=_LD_JSON_HEADERS,
        )
    if r.status_code == 409:
        raise HTTPException(status_code=409, detail="Entity already exists")
    if r.status_code not in (200, 201):
        raise HTTPException(
            status_code=502,
            detail=f"Orion returned {r.status_code}: {r.text}",
        )


async def delete_entity(entity_id: str) -> None:
    async with httpx.AsyncClient() as client:
        r = await client.delete(
            f"{ORION_URL}/ngsi-ld/v1/entities/{entity_id}",
            headers=_JSON_HEADERS,
        )
    if r.status_code == 404:
        raise HTTPException(status_code=404, detail="Entity not found")
    if r.status_code not in (200, 204):
        raise HTTPException(
            status_code=502,
            detail=f"Orion returned {r.status_code}: {r.text}",
        )


async def patch_entity_attrs(entity_id: str, attrs: dict) -> None:
    """Partial attribute update (NGSI-LD PATCH)."""
    async with httpx.AsyncClient() as client:
        r = await client.patch(
            f"{ORION_URL}/ngsi-ld/v1/entities/{entity_id}/attrs",
            json=attrs,
            headers=_LD_JSON_HEADERS,
        )
    if r.status_code == 404:
        raise HTTPException(status_code=404, detail="Entity not found")
    if r.status_code not in (200, 204):
        raise HTTPException(
            status_code=502,
            detail=f"Orion returned {r.status_code}: {r.text}",
        )
