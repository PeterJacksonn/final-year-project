workspace "Water Quality Monitoring System" "FIWARE NGSI-LD real-time water quality monitoring system, River Don catchment." {

    !identifiers hierarchical

    model {

        # ── People ────────────────────────────────────────────────────────────

        officer = person "Environmental Officer" "Monitors water quality data and manages monitoring entities." {
            tags "Person"
        }

        # ── External systems ──────────────────────────────────────────────────

        eaData = softwareSystem "Environment Agency Open Data" "Historical water quality CSV data from EA freshwater monitoring stations." {
            tags "External System"
        }

        openMeteo = softwareSystem "Open-Meteo API" "Weather API providing rainfall and climate data. (Planned)" {
            tags "External System"
        }

        # ── Main system ───────────────────────────────────────────────────────

        wqms = softwareSystem "Water Quality Monitoring System" "Real-time water quality monitoring platform built on FIWARE NGSI-LD." {
            tags "WQMS"

            frontend = container "Frontend" "Dashboard, map view, and entity management UI." "JavaScript, React" {
                tags "Web Browser"
            }

            backend = container "Backend" "REST API: exposes access to Orion-LD and TimescaleDB" "Python, FastAPI" {
                tags "API Server"
            }

            orion = container "Orion-LD" "NGSI-LD context broker managing current entity state. Dispatches notifications on update." "FIWARE" {
                tags "Context Broker"
            }

            mongo = container "MongoDB" "Persistence store for Orion-LD entity state." "MongoDB" {
                tags "Database"
            }

            quantumleap = container "QuantumLeap" "Subscribes to NGSI-LD notifications and writes observations to TimescaleDB." "FIWARE" {
                tags "Message Bridge"
            }

            timescale = container "TimescaleDB" "Time-series store for all historical water quality observations." "PostgreSQL" {
                tags "Database"
            }

            ldcontext = container "LD Context Server" "Serves the JSON-LD @context document for NGSI-LD attribute resolution." "Apache" {
                tags "HTTP Server"
            }

        }

        # ── Relationships ─────────────────────────────────────────────────────

        officer -> wqms "Views and manages water quality data" "HTTPS"
        officer -> eaData "Downloads CSV data for ingestion" "HTTPS"

        wqms -> openMeteo "Fetches rainfall and climate data [planned]" "HTTP/JSON"

        officer -> wqms.frontend "Monitors and manages water quality data"

        wqms.frontend -> wqms.backend "Makes requests to" "HTTP/JSON"

        wqms.backend -> wqms.orion "Entity CRUD and queries" "HTTP / NGSI-LD"
        wqms.backend -> wqms.timescale "Historical parameter queries" "SQL"

        wqms.orion -> wqms.mongo "Persists entity state" "MongoDB Wire Protocol"
        orionToQL = wqms.orion -> wqms.quantumleap "WaterQualityObserved notifications" "HTTP / NGSI-LD"
        wqms.orion -> wqms.ldcontext "Resolves JSON-LD @context" "HTTP"

        wqms.quantumleap -> wqms.timescale "Writes time-series observations" "SQL"

    }

    views {

        systemContext wqms "Diagram1" "Level 1 — System Context" {
            include *
        }

        container wqms "Diagram2" "Level 2 — Containers" {
            include *
        }

        styles {
            element "Element" {
                background #4477AA
                color #ffffff
                stroke #2d5a8a
                strokeWidth 3
                shape RoundedBox
            }
            element "Person" {
                shape Person
                background #4477AA
                color #ffffff
                stroke #2d5a8a
            }
            element "WQMS" {
                background #4477AA
                color #ffffff
                stroke #2d5a8a
                strokeWidth 5
            }
            element "External System" {
                background #888888
                color #ffffff
                stroke #666666
            }
            element "Web Browser" {
                shape WebBrowser
                background #66CCEE
                color #000000
                stroke #44aacc
            }
            element "API Server" {
                background #4477AA
                color #ffffff
                stroke #2d5a8a
            }
            element "Context Broker" {
                shape Hexagon
                background #AA3377
                color #ffffff
                stroke #882255
            }
            element "Database" {
                shape Cylinder
                background #228833
                color #ffffff
                stroke #1a6626
            }
            element "Message Bridge" {
                shape Component
                background #EE6677
                color #000000
                stroke #cc4455
            }
            element "HTTP Server" {
                shape RoundedBox
                background #CCBB44
                color #000000
                stroke #aaa030
            }
            element "Script" {
                shape RoundedBox
                background #BBBBBB
                color #000000
                stroke #999999
            }
            relationship "Relationship" {
                thickness 3
                color #555555
            }
        }

    }

}
