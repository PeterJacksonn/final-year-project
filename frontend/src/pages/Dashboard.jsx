import { useState, useEffect, useCallback } from 'react'
import { useSearchParams, Link } from 'react-router-dom'
import { getStations, getLatest, getHistory } from '../api/client'
import Sidebar from '../components/Sidebar'
import Header from '../components/Header'
import ParameterCard from '../components/ParameterCard'
import ParameterChart from '../components/ParameterChart'
import ComparisonChart, { TOL_COLOURS } from '../components/ComparisonChart'

// ─── Helpers ──────────────────────────────────────────────────────────────────

function stationName(station) {
  return station?.['https://uri.etsi.org/ngsi-ld/name']?.value
    || station?.name?.value
    || station?.eaNotation?.value
    || station?.id?.split(':').pop()
    || 'Unknown Station'
}

function stationNotation(station) {
  return station?.eaNotation?.value || station?.id?.split(':').pop()
}

const PARAMETERS = [
  { key: 'pH',                 label: 'pH' },
  { key: 'temperature',        label: 'Temperature' },
  { key: 'dissolvedOxygen',    label: 'Dissolved Oxygen' },
  { key: 'oxygenSaturation',   label: 'O₂ Saturation' },
  { key: 'conductivity',       label: 'Conductivity' },
  { key: 'ammoniacalNitrogen', label: 'NH₄-N' },
  { key: 'phosphate',          label: 'Phosphate' },
  { key: 'bod',                label: 'BOD' },
  { key: 'nitrate',            label: 'Nitrate' },
  { key: 'nitrite',            label: 'Nitrite' },
]

// ─── Multi-station comparison view ───────────────────────────────────────────

function ComparisonView({ stationsParam }) {
  const [stations, setStations] = useState([])
  const [selectedParam, setSelectedParam] = useState('pH')
  const [histories, setHistories] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  // Match URL IDs to station objects
  useEffect(() => {
    const ids = stationsParam.split(',').filter(Boolean)
    getStations().then(r => {
      const matched = ids
        .map(id => r.data.find(s => stationNotation(s) === id))
        .filter(Boolean)
      setStations(matched)
    })
  }, [stationsParam])

  // Fetch history for all stations whenever stations list or param changes
  useEffect(() => {
    if (stations.length === 0) return
    setLoading(true)
    setError(null)
    Promise.all(
      stations.map(s => {
        const id = stationNotation(s)
        return getHistory(id, selectedParam).then(r => ({
          id,
          name: stationName(s),
          data: r.data.data,
          meta: r.data.meta,
        }))
      })
    )
      .then(setHistories)
      .catch(err => setError(err.message))
      .finally(() => setLoading(false))
  }, [stations, selectedParam])

  const meta = histories[0]?.meta || null

  return (
    <div className="page-layout">
      <Header />
      <div className="page-content">

        {/* Station chips + back link */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap', marginBottom: '1.5rem' }}>
          <Link to="/map" className="btn btn-secondary btn-sm" style={{ flexShrink: 0 }}>
            ← Map
          </Link>
          <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
            {stations.map((s, i) => (
              <span key={s.id} style={{
                display: 'inline-flex', alignItems: 'center', gap: '0.4rem',
                padding: '0.25rem 0.75rem',
                background: 'white',
                border: `2px solid ${TOL_COLOURS[i % TOL_COLOURS.length]}`,
                borderRadius: '20px',
                fontSize: '0.8rem', fontWeight: 500,
              }}>
                <span style={{
                  width: 8, height: 8, borderRadius: '50%',
                  background: TOL_COLOURS[i % TOL_COLOURS.length],
                  flexShrink: 0,
                }} />
                {stationName(s)}
              </span>
            ))}
          </div>
        </div>

        {/* Parameter selector */}
        <div style={{
          display: 'flex', flexWrap: 'wrap', gap: '0.4rem',
          marginBottom: '1.5rem',
          paddingBottom: '1.5rem',
          borderBottom: '1px solid var(--color-border)',
        }}>
          {PARAMETERS.map(p => (
            <button
              key={p.key}
              onClick={() => setSelectedParam(p.key)}
              className={`btn btn-sm ${selectedParam === p.key ? 'btn-primary' : 'btn-secondary'}`}
            >
              {p.label}
            </button>
          ))}
        </div>

        {/* Chart */}
        {error && <div className="alert alert-error">{error}</div>}
        {loading && (
          <div style={{ textAlign: 'center', padding: '4rem', color: 'var(--color-text-muted)' }}>
            Loading…
          </div>
        )}
        {!loading && !error && histories.length > 0 && meta && (
          <ComparisonChart histories={histories} meta={meta} />
        )}

      </div>
    </div>
  )
}

// ─── Single-station view ──────────────────────────────────────────────────────

function SingleStationView({ stationParam }) {
  const [stations, setStations] = useState([])
  const [selectedStation, setSelectedStation] = useState(null)
  const [readings, setReadings] = useState({})
  const [selectedParam, setSelectedParam] = useState(null)
  const [history, setHistory] = useState(null)

  useEffect(() => {
    getStations().then(r => setStations(r.data))
  }, [])

  // Auto-select station from URL param once stations are loaded
  useEffect(() => {
    if (stations.length === 0 || !stationParam) return
    const match = stations.find(s => stationNotation(s) === stationParam)
    if (match) setSelectedStation(match)
  }, [stations, stationParam])

  // Poll latest readings every 5 seconds when a station is selected
  useEffect(() => {
    if (!selectedStation) return
    const id = stationNotation(selectedStation)
    const fetch = () => getLatest(id).then(r => setReadings(r.data.readings))
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
    const id = stationNotation(selectedStation)
    getHistory(id, param).then(r => setHistory(r.data))
  }, [selectedStation])

  const name = stationName(selectedStation)
  const notation = stationNotation(selectedStation)

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
              <div className="mb-6">
                <h2 className="text-xl font-semibold text-gray-800">{name}</h2>
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

// ─── Router ───────────────────────────────────────────────────────────────────

export default function Dashboard() {
  const [searchParams] = useSearchParams()
  const stationsParam = searchParams.get('stations')
  const stationParam  = searchParams.get('station')

  if (stationsParam && stationsParam.split(',').filter(Boolean).length > 1) {
    return <ComparisonView stationsParam={stationsParam} />
  }

  return <SingleStationView stationParam={stationParam} />
}
