"""
Parses EA Water Quality CSV into NGSI-LD WaterQualityObserved entities.
Groups rows by (sampling point, observation time)... one entity per visit.
"""

import pandas as pd
from typing import Optional

# Maps Environment Agency determinand labels (from CSV) to NGSI-LD Smart Data Model attribute names
# Each entry: EA label → (NGSI-LD attribute, UNCEFACT unit code)
DETERMINAND_MAP = {
    "pH":                                   ("pH",                  None),
    "Temperature of Water":                 ("temperature",         "CEL"),
    "Oxygen, Dissolved as O2":              ("dissolvedOxygen",     "M1"),
    "Oxygen, Dissolved, % Saturation":      ("oxygenSaturation",    "P1"),
    "Conductivity at 25 C":                 ("conductivity",        "G42"),
    "Ammoniacal Nitrogen as N":             ("ammoniacalNitrogen",  "M1"),
    "Orthophosphate, reactive as P":        ("phosphate",           "M1"),
    "BOD : 5 Day ATU":                      ("bod",                 "M1"),
    "Nitrate as N":                         ("nitrate",             "M1"),
    "Nitrite as N":                         ("nitrite",             "M1"),
}


def _parse_value(raw: str) -> Optional[float]:
    """Strip < prefix (below detection limit) and parse to float. Returns None if unparseable."""
    if pd.isna(raw):
        return None
    cleaned = str(raw).strip().lstrip("<").strip()
    try:
        return float(cleaned)
    except ValueError:
        return None


def parse_csv(filepath: str) -> list[dict]:
    """
    Parse EA CSV file and return a list of NGSI-LD WaterQualityObserved entities.
    One entity per unique (samplingPoint, phenomenonTime) combination.
    """
    df = pd.read_csv(filepath)

    entities = []

    # Group by station + observation time: one NGSI-LD entity per site visit
    # (the EA CSV has one row per determinand, so a single visit produces multiple rows)
    for (station_id, obs_time), group in df.groupby(
        ["samplingPoint.notation", "phenomenonTime"]
    ):
        row = group.iloc[0]  # All rows in group share station metadata

        lon = float(row["samplingPoint.longitude"])
        lat = float(row["samplingPoint.latitude"])
        obs_time_z = obs_time if obs_time.endswith("Z") else obs_time + "Z"

        entity = {
            "id": f"urn:ngsi-ld:WaterQualityObserved:{station_id}:{obs_time_z}",
            "type": "WaterQualityObserved",
            "@context": "https://uri.etsi.org/ngsi-ld/v1/ngsi-ld-core-context.jsonld",
            "dateObserved": {
                "type": "Property",
                "value": {"@type": "DateTime", "@value": obs_time_z},
            },
            "location": {
                "type": "GeoProperty",
                "value": {"type": "Point", "coordinates": [lon, lat]},
            },
            "refStation": {
                "type": "Relationship",
                "object": f"urn:ngsi-ld:WaterQualityStation:{station_id}",
            },
            "eaSamplingPurpose": {
                "type": "Property",
                "value": str(row["samplingPurpose"]),
            },
        }

        # Add each determinand as a property
        for _, obs_row in group.iterrows():
            label = str(obs_row["determinand.prefLabel"]).strip()
            if label not in DETERMINAND_MAP:
                continue  # Skip unmapped determinands

            attr_name, unit_code = DETERMINAND_MAP[label]
            value = _parse_value(obs_row["result"])

            if value is None:
                continue  # Skip unparseable values

            prop = {
                "type": "Property",
                "value": value,
                "observedAt": obs_time_z,
            }
            if unit_code:
                prop["unitCode"] = unit_code

            entity[attr_name] = prop

        entities.append(entity)

    return entities
