import { useState, useEffect } from 'react'
import { useSearchParams, Link } from 'react-router-dom'
import { getStations, getLatest, getHistory } from '../api/client'
import { stationName, stationNotation } from '../utils/station'
import Sidebar from '../components/Sidebar'
import Header from '../components/Header'
import ParameterCard from '../components/ParameterCard'
import Chart, { TOL_COLOURS } from '../components/Chart'

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

const POLL_OPTIONS = [
  { label: '5s',  value: 5000 },
  { label: '10s', value: 10000 },
  { label: '30s', value: 30000 },
  { label: '60s', value: 60000 },
]

const HISTORY_WINDOWS = [
  { label: '1h',  hours: 1 },
  { label: '6h',  hours: 6 },
  { label: '24h', hours: 24 },
  { label: '7d',  hours: 168 },
  null,
  { label: '1M',  hours: 720 },
  { label: '3M',  hours: 2160 },
  { label: '6M',  hours: 4380 },
  { label: '1Y',  hours: 8760 },
  { label: 'All', hours: 87600 },
]

// ─── Y-axis range settings ────────────────────────────────────────────────────

function YAxisSettings({ param, settings, onSave, onReset }) {
  const s = settings[param] || {}
  const hasCustom = s.yMin != null || s.yMax != null
  return (
    <div className="flex items-center gap-2 mb-2">
      <span className="text-xs text-gray-400 shrink-0">Y axis</span>
      <input
        type="number"
        placeholder="min (auto)"
        value={s.yMin ?? ''}
        onChange={e => onSave(param, 'yMin', e.target.value)}
        className="form-input"
        style={{ width: 110, padding: '2px 8px', fontSize: '0.75rem' }}
      />
      <span className="text-xs text-gray-400">–</span>
      <input
        type="number"
        placeholder="max (auto)"
        value={s.yMax ?? ''}
        onChange={e => onSave(param, 'yMax', e.target.value)}
        className="form-input"
        style={{ width: 110, padding: '2px 8px', fontSize: '0.75rem' }}
      />
      {hasCustom && (
        <button onClick={() => onReset(param)} className="btn btn-sm btn-secondary">
          Reset
        </button>
      )}
    </div>
  )
}

// ─── Multi-station comparison view ───────────────────────────────────────────

function ComparisonView({ stationsParam }) {
  const [stations, setStations] = useState([])
  const [selectedParam, setSelectedParam] = useState('pH')
  const [historyHours, setHistoryHours] = useState(168)
  const [histories, setHistories] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  useEffect(() => {
    const ids = stationsParam.split(',').filter(Boolean)
    getStations().then(r => {
      const matched = ids
        .map(id => r.data.find(s => stationNotation(s) === id))
        .filter(Boolean)
      setStations(matched)
    })
  }, [stationsParam])

  useEffect(() => {
    if (stations.length === 0) return
    setLoading(true)
    setError(null)
    Promise.all(
      stations.map(s => {
        const id = stationNotation(s)
        return getHistory(id, selectedParam, historyHours).then(r => ({
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
  }, [stations, selectedParam, historyHours])

  const meta = histories[0]?.meta || null

  return (
    <div className="page-layout">
      <Header />
      <div className="page-content">
        <div className="flex items-center gap-3 flex-wrap mb-6">
          <Link to="/map" className="btn btn-secondary btn-sm shrink-0">← Map</Link>
          <div className="flex gap-2 flex-wrap">
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

        <div className="flex items-center justify-between flex-wrap gap-3 mb-6 pb-6" style={{ borderBottom: '1px solid var(--color-border)' }}>
          <div className="flex flex-wrap gap-2">
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
          <div className="flex items-center gap-1">
            {HISTORY_WINDOWS.map((opt, i) =>
              opt === null
                ? <span key="div" style={{ width: 1, height: 20, background: 'var(--color-border)', margin: '0 0.25rem' }} />
                : (
                  <button key={opt.hours} onClick={() => setHistoryHours(opt.hours)}
                    className={`btn btn-sm ${historyHours === opt.hours ? 'btn-primary' : 'btn-secondary'}`}>
                    {opt.label}
                  </button>
                )
            )}
          </div>
        </div>

        {error && <div className="alert alert-error">{error}</div>}
        {loading && (
          <div className="flex items-center justify-center p-16 text-sm" style={{ color: 'var(--color-text-muted)' }}>
            Loading…
          </div>
        )}
        {!loading && !error && histories.length > 0 && meta && (
          <Chart series={histories} meta={meta} />
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
  const [pollInterval, setPollInterval] = useState(5000)
  const [historyHours, setHistoryHours] = useState(24)
  const [ySettings, setYSettings] = useState(() => {
    try { return JSON.parse(localStorage.getItem('wqms_y_settings') || '{}') }
    catch { return {} }
  })

  const saveYSetting = (param, key, val) => {
    setYSettings(prev => {
      const next = { ...prev, [param]: { ...prev[param], [key]: val === '' ? null : Number(val) } }
      localStorage.setItem('wqms_y_settings', JSON.stringify(next))
      return next
    })
  }

  const resetYSetting = (param) => {
    setYSettings(prev => {
      const next = { ...prev, [param]: { yMin: null, yMax: null } }
      localStorage.setItem('wqms_y_settings', JSON.stringify(next))
      return next
    })
  }

  useEffect(() => {
    getStations().then(r => setStations(r.data))
  }, [])

  useEffect(() => {
    if (stations.length === 0 || !stationParam) return
    const match = stations.find(s => stationNotation(s) === stationParam)
    if (match) setSelectedStation(match)
  }, [stations, stationParam])

  useEffect(() => {
    if (!selectedStation) return
    const id = stationNotation(selectedStation)
    const fetchLatest = () => getLatest(id).then(r => setReadings(r.data.readings))
    fetchLatest()
    const interval = setInterval(fetchLatest, pollInterval)
    return () => clearInterval(interval)
  }, [selectedStation, pollInterval])

  useEffect(() => {
    if (!selectedStation || !selectedParam) return
    const id = stationNotation(selectedStation)
    const fetchHistory = () => getHistory(id, selectedParam, historyHours).then(r => setHistory(r.data))
    fetchHistory()
    const interval = setInterval(fetchHistory, pollInterval)
    return () => clearInterval(interval)
  }, [selectedStation, selectedParam, historyHours, pollInterval])

  const name = stationName(selectedStation)
  const notation = stationNotation(selectedStation)

  return (
    <div className="flex flex-col h-screen" style={{ background: 'var(--color-bg)' }}>
      <Header />
      <div className="flex flex-1 overflow-hidden">
        <Sidebar
          stations={stations}
          selectedStation={selectedStation}
          onSelect={station => {
            setSelectedStation(station)
            setSelectedParam(null)
            setHistory(null)
            setReadings({})
          }}
        />
        <main className="flex-1 overflow-y-auto p-6">
          {!selectedStation ? (
            <div className="flex items-center justify-center h-full text-sm" style={{ color: 'var(--color-text-muted)' }}>
              Select a monitoring station
            </div>
          ) : (
            <>
              <div className="mb-6">
                <h2 className="text-xl font-semibold" style={{ color: 'var(--color-text)' }}>{name}</h2>
                <p className="text-sm mt-1" style={{ color: 'var(--color-text-muted)' }}>
                  {notation} · EA Freshwater Monitoring
                </p>
              </div>

              <div className="flex items-center justify-between mb-3">
                <p className="text-xs font-medium uppercase tracking-wide" style={{ color: 'var(--color-text-muted)' }}>
                  Latest Readings
                </p>
                <div className="flex items-center gap-2">
                  <span className="text-xs" style={{ color: 'var(--color-text-muted)' }}>Refresh</span>
                  {POLL_OPTIONS.map(opt => (
                    <button
                      key={opt.value}
                      onClick={() => setPollInterval(opt.value)}
                      className={`btn btn-sm ${pollInterval === opt.value ? 'btn-primary' : 'btn-secondary'}`}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 mb-8">
                {Object.entries(readings).map(([param, data]) => (
                  <ParameterCard
                    key={param}
                    data={data}
                    selected={selectedParam === param}
                    onClick={() => setSelectedParam(param)}
                  />
                ))}
              </div>

              {selectedParam && history && (
                <>
                  <div className="flex items-center justify-between mb-3">
                    <p className="text-xs font-medium uppercase tracking-wide" style={{ color: 'var(--color-text-muted)' }}>
                      History
                    </p>
                    <div className="flex items-center gap-1">
                      {HISTORY_WINDOWS.map((opt, i) =>
                        opt === null
                          ? <span key="div" style={{ width: 1, height: 20, background: 'var(--color-border)', margin: '0 0.25rem' }} />
                          : (
                            <button key={opt.hours} onClick={() => setHistoryHours(opt.hours)}
                              className={`btn btn-sm ${historyHours === opt.hours ? 'btn-primary' : 'btn-secondary'}`}>
                              {opt.label}
                            </button>
                          )
                      )}
                    </div>
                  </div>
                  <YAxisSettings
                    param={selectedParam}
                    settings={ySettings}
                    onSave={saveYSetting}
                    onReset={resetYSetting}
                  />
                  <Chart
                    series={[{ id: 'value', name: '', data: history.data }]}
                    meta={history.meta}
                    yMin={ySettings[selectedParam]?.yMin ?? null}
                    yMax={ySettings[selectedParam]?.yMax ?? null}
                  />
                </>
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
