import { useState, useEffect, useCallback } from 'react'
import { useSearchParams } from 'react-router-dom'
import { getWaterBody, getStations, getLatest, getHistory } from '../api/client'
import Sidebar from '../components/Sidebar'
import Header from '../components/Header'
import ParameterCard from '../components/ParameterCard'
import ParameterChart from '../components/ParameterChart'

// Station name helper — handles expanded JSON-LD key
function stationName(station) {
  return station?.['https://uri.etsi.org/ngsi-ld/name']?.value
    || station?.name?.value
    || station?.eaNotation?.value
    || station?.id?.split(':').pop()
    || 'Unknown Station'
}

// Extract EA notation from full URN or plain string
function stationNotation(station) {
  return station?.eaNotation?.value || station?.id?.split(':').pop()
}

export default function Dashboard() {
  const [searchParams] = useSearchParams()

  const [waterBody, setWaterBody] = useState(null)
  const [stations, setStations] = useState([])
  const [selectedStation, setSelectedStation] = useState(null)
  const [readings, setReadings] = useState({})
  const [selectedParam, setSelectedParam] = useState(null)
  const [history, setHistory] = useState(null)

  // Load water body + stations
  useEffect(() => {
    getWaterBody().then(r => setWaterBody(r.data[0]))
    getStations().then(r => setStations(r.data))
  }, [])

  // Once stations loaded, check URL params and auto-select
  useEffect(() => {
    if (stations.length === 0) return

    const singleId = searchParams.get('station')
    if (singleId) {
      const match = stations.find(s => stationNotation(s) === singleId)
      if (match) setSelectedStation(match)
      return
    }

    // Multi-station from map — just select the first one for now
    // (full comparison view can come later)
    const multiIds = searchParams.get('stations')
    if (multiIds) {
      const ids = multiIds.split(',')
      const match = stations.find(s => stationNotation(s) === ids[0])
      if (match) setSelectedStation(match)
    }
  }, [stations, searchParams])

  // Poll latest readings every 5 seconds when a station is selected
  useEffect(() => {
    if (!selectedStation) return
    const notation = stationNotation(selectedStation)
    const fetch = () =>
      getLatest(notation).then(r => setReadings(r.data.readings))
    fetch()
    const interval = setInterval(fetch, 5000)
    return () => clearInterval(interval)
  }, [selectedStation])

  const handleSelectStation = useCallback((station) => {
    setSelectedStation(station)
    setSelectedParam(null)
    setHistory(null)
    setReadings({})
  }, [])

  const handleSelectParam = useCallback((param) => {
    if (!selectedStation) return
    setSelectedParam(param)
    const notation = stationNotation(selectedStation)
    getHistory(notation, param).then(r => setHistory(r.data))
  }, [selectedStation])

  const name = stationName(selectedStation)
  const notation = stationNotation(selectedStation)

  // Warn if coming from multi-station map selection
  const multiIds = searchParams.get('stations')
  const isMultiContext = multiIds && multiIds.split(',').length > 1

  return (
    <div className="flex flex-col h-screen bg-gray-50 text-gray-900">
      <Header />
      <div className="flex flex-1 overflow-hidden">
        <Sidebar
          stations={stations}
          selectedStation={selectedStation}
          onSelect={handleSelectStation}
        />
        <main className="flex-1 overflow-y-auto p-6">
          {!selectedStation ? (
            <div className="flex items-center justify-center h-full text-gray-400 text-sm">
              Select a monitoring station
            </div>
          ) : (
            <>
              {isMultiContext && (
                <div className="alert alert-info mb-4" style={{ fontSize: '0.8rem' }}>
                  Showing {multiIds.split(',').length} stations were selected on the map.
                  Multi-station comparison view coming soon — currently showing {name}.
                </div>
              )}

              <div className="mb-6">
                <h2 className="text-xl font-semibold text-gray-800">
                  {name}
                </h2>
                <p className="text-sm text-gray-500 mt-1">
                  {notation} · EA Freshwater Monitoring
                </p>
              </div>

              <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-3">
                Latest Readings
              </p>

              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 mb-8">
                {Object.entries(readings).map(([param, data]) => (
                  <ParameterCard
                    key={param}
                    param={param}
                    data={data}
                    selected={selectedParam === param}
                    onClick={() => handleSelectParam(param)}
                  />
                ))}
              </div>

              {selectedParam && history && (
                <ParameterChart history={history} />
              )}
            </>
          )}
        </main>
      </div>
    </div>
  )
}
