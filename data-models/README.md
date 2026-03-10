# Data Models

NGSI-LD entity definitions for the Water Quality Monitoring System.

## Entity Hierarchy

```
WaterBody  (e.g. River Sheaf - WFD water body)
  └── WaterQualityStation  (e.g. EA sampling point NE-49301997)
        └── WaterQualityObserved  (individual timestamped sample)
```

Each entity references its parent via a `Relationship` property, enabling
NGSI-LD linked data traversal up and down the hierarchy.

## Entity Types

### WaterBody
Represents a WFD-classified surface water body.

- ID pattern: `urn:ngsi-ld:WaterBody:{wfdId}`
- Source: EA Catchment Data Explorer
- Key fields: `wfdWaterBodyId`, `wfdWaterBodyType`, `location` (LineString), `hasStation`

### WaterQualityStation
Represents a physical EA water quality sampling point on a water body.

- ID pattern: `urn:ngsi-ld:WaterQualityStation:{eaNotation}`
- Source: EA Water Quality API
- Key fields: `eaNotation`, `samplingPointType`, `location` (Point), `isPartOf`, `monitoredParameters`

### WaterQualityObserved
A single water quality sample - one set of parameter readings at a point in time.
Based on the FIWARE Smart Data Model `WaterQualityObserved`.

- ID pattern: `urn:ngsi-ld:WaterQualityObserved:{stationNotation}:{isoTimestamp}`
- Source: EA survey data / simulated real-time
- Key fields: `dateObserved`, `refStation`, and all parameter properties below

## Monitored Parameters

Derived from actual EA data for the River Sheaf (Sheffield area).
Selected based on WFD classification relevance.

| NGSI-LD Property     | EA Determinand                        | Unit       | UN/CEFACT Code |
|----------------------|---------------------------------------|------------|----------------|
| `pH`                 | pH                                    | pH units   | pH             |
| `temperature`        | Temperature of Water                  | °C         | CEL            |
| `dissolvedOxygen`    | Oxygen, Dissolved as O2               | mg/L       | M1             |
| `oxygenSaturation`   | Oxygen, Dissolved, % Saturation       | %          | P1             |
| `conductivity`       | Conductivity at 25 C                  | µS/cm      | G42            |
| `ammoniacalNitrogen` | Ammoniacal Nitrogen as N              | mg/L       | M1             |
| `phosphate`          | Orthophosphate, reactive as P         | mg/L       | M1             |
| `bod`                | BOD : 5 Day ATU                       | mg/L       | M1             |
| `nitrate`            | Nitrate as N                          | mg/L       | M1             |
| `nitrite`            | Nitrite as N                          | mg/L       | M1             |

## Data Sources

Historical data sourced from the EA Water Quality Explorer:
https://environment.data.gov.uk/water-quality/view/landing

Primary station: **Sheaf at Granville Square South U/S Porter Brook** (NE-49301997)
- Coordinates: -1.4631, 53.374
- 14 sample dates: March 2025 → February 2026

Supporting stations:
- Sheaf at Millhouses Park (NE-49302001): -1.4953, 53.346
- RSN0088 Totley Brook Gillfield Wood (NE-RSN0088): -1.5485, 53.307

## Context

All entities use:
- NGSI-LD core context: `https://uri.etsi.org/ngsi-ld/v1/ngsi-ld-core-context.jsonld`
- Smart Data Models Environment context: `https://raw.githubusercontent.com/smart-data-models/dataModel.Environment/master/context.jsonld`
