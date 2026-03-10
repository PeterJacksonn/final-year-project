"""
Handles posting NGSI-LD entities to Orion-LD.
Upserts by attempting POST, falling back to PATCH if entity already exists.
"""

import requests
import logging

logger = logging.getLogger(__name__)

ORION_URL = "http://localhost:1026"
HEADERS = {"Content-Type": "application/ld+json"}


def upsert_entity(entity: dict) -> tuple[str, int]:
    """
    POST entity to Orion. If it already exists (409), PATCH its attributes.
    Returns (entity_id, status_code).
    """
    entity_id = entity["id"]
    url = f"{ORION_URL}/ngsi-ld/v1/entities"

    response = requests.post(url, json=entity, headers=HEADERS)

    if response.status_code == 201:
        logger.info(f"Created: {entity_id}")
        return entity_id, 201

    if response.status_code == 409:
        # Entity exists — patch attributes
        attrs = {
            k: v
            for k, v in entity.items()
            if k not in ("id", "type", "@context")
        }
        attrs["@context"] = entity["@context"]

        patch_url = f"{ORION_URL}/ngsi-ld/v1/entities/{entity_id}/attrs"
        patch_response = requests.patch(patch_url, json=attrs, headers=HEADERS)
        logger.info(f"Updated: {entity_id} ({patch_response.status_code})")
        return entity_id, patch_response.status_code

    logger.warning(f"Unexpected response for {entity_id}: {response.status_code} {response.text}")
    return entity_id, response.status_code


def upsert_entities(entities: list[dict]) -> dict:
    """
    Upsert a list of entities. Returns a summary dict.
    """
    results = {"created": 0, "updated": 0, "failed": 0, "total": len(entities)}

    for entity in entities:
        _, status = upsert_entity(entity)
        if status == 201:
            results["created"] += 1
        elif status in (204, 207):
            results["updated"] += 1
        else:
            results["failed"] += 1

    return results
