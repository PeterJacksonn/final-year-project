## Check that quantumleap has added postgis and timescale extentions:
` ` `
docker exec final-year-project-timescale-1 psql -U quantumleap -d quantumleap -c "\dx"
` ` `
^ change docker name if needed


## Subscribe for WaterQualityObserved updates:
` ` `
  -H "Content-Type: application/ld+json" \
  -d '{
    "type": "Subscription",
    "entities": [{"type": "WaterQualityObserved"}],
    "notification": {
      "format": "normalized",
      "endpoint": {
        "uri": "http://quantumleap:8668/v2/notify",
        "accept": "application/json"
      }
    },
    "@context": "https://uri.etsi.org/ngsi-ld/v1/ngsi-ld-core-context.jsonld"
  }'
` ` `
