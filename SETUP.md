



## Check that quantumleap has added postgis and timescale extentions:
` ` `
docker exec final-year-project-timescale-1 psql -U quantumleap -d quantumleap -c "\dx"
` ` `
^ change docker name if needed

