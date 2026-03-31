from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import Any
from app.services import orion
from app.config import MANAGEABLE_ENTITY_TYPES, NGSI_LD_CONTEXT

router = APIRouter(prefix="/api/entities", tags=["entities"])


class EntityPayload(BaseModel):
    """
    Accepts any valid NGSI-LD entity dict from the frontend.
    The frontend constructs the full NGSI-LD shape; we just
    proxy it to Orion with the correct @context injected.
    """
    model_config = {"extra": "allow"}


@router.get("/{entity_type}")
async def list_entities(entity_type: str, limit: int = 100):
    if entity_type not in MANAGEABLE_ENTITY_TYPES:
        raise HTTPException(
            status_code=400,
            detail=f"Unknown entity type '{entity_type}'. "
                f"Valid types: {MANAGEABLE_ENTITY_TYPES}",
        )
    return await orion.fetch_entities(entity_type, limit=limit)


@router.post("")
async def create_entity(payload: dict[str, Any]):
    """
    Accepts the NGSI-LD entity body from the frontend.
    Injects @context if not already present, then forwards to Orion.
    """
    entity_type = payload.get("type")
    if entity_type not in MANAGEABLE_ENTITY_TYPES:
        raise HTTPException(
            status_code=400,
            detail=f"Cannot create entity of type '{entity_type}'",
        )

    # Ensure @context is set
    if "@context" not in payload:
        payload["@context"] = NGSI_LD_CONTEXT

    await orion.create_entity(payload)
    return {"status": "created", "id": payload.get("id")}


@router.delete("/{entity_id:path}")
async def delete_entity(entity_id: str):
    """
    entity_id is the full URN e.g. urn:ngsi-ld:WaterBody:GB112071065780
    The :path converter handles the colons in the URN.
    """
    await orion.delete_entity(entity_id)
    return {"status": "deleted", "id": entity_id}
