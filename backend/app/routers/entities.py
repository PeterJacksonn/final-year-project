from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import Any
from app.services import orion
from app.config import MANAGEABLE_ENTITY_TYPES, NGSI_LD_CONTEXT

router = APIRouter(prefix="/api/entities", tags=["entities"])


class EntityPayload(BaseModel):
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
    # :path converter needed because entity URNs contain colons
    await orion.delete_entity(entity_id)
    return {"status": "deleted", "id": entity_id}
