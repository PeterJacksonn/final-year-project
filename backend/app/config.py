import os

DB_DSN = os.getenv("DB_DSN", "postgresql://quantumleap:quantumleap@localhost:5432/quantumleap")
ORION_URL = os.getenv("ORION_URL", "http://localhost:1026")

NGSI_LD_CONTEXT = "https://uri.etsi.org/ngsi-ld/v1/ngsi-ld-core-context.jsonld"

PARAMETERS = [
    "pH", "temperature", "dissolvedOxygen", "oxygenSaturation",
    "conductivity", "ammoniacalNitrogen", "phosphate", "bod",
    "nitrate", "nitrite",
]

DB_COLUMNS = {
    "pH":                  "ph",
    "temperature":         "temperature",
    "dissolvedOxygen":     "dissolvedoxygen",
    "oxygenSaturation":    "oxygensaturation",
    "conductivity":        "conductivity",
    "ammoniacalNitrogen":  "ammoniacalnitrogen",
    "phosphate":           "phosphate",
    "bod":                 "bod",
    "nitrate":             "nitrate",
    "nitrite":             "nitrite",
}

PARAMETER_META = {
    "pH":                 {"label": "pH",                  "unit": "pH units"},
    "temperature":        {"label": "Temperature",         "unit": "°C"},
    "dissolvedOxygen":    {"label": "Dissolved Oxygen",    "unit": "mg/L"},
    "oxygenSaturation":   {"label": "Oxygen Saturation",   "unit": "%"},
    "conductivity":       {"label": "Conductivity",        "unit": "µS/cm"},
    "ammoniacalNitrogen": {"label": "Ammoniacal Nitrogen", "unit": "mg/L"},
    "phosphate":          {"label": "Phosphate",           "unit": "mg/L"},
    "bod":                {"label": "BOD (5-Day ATU)",     "unit": "mg/L"},
    "nitrate":            {"label": "Nitrate",             "unit": "mg/L"},
    "nitrite":            {"label": "Nitrite",             "unit": "mg/L"},
}

# Valid NGSI-LD entity types for the entity manager
MANAGEABLE_ENTITY_TYPES = [
    "WaterBody",
    "WaterQualityStation",
]
