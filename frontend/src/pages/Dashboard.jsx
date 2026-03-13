import { useState, useEffect } from 'react'
import { getWaterBody, getStations, getLatest, getHistory } from '../api/client'
import Sidebar from '../components/Sidebar'
import Header from '../components/Header'
import ParameterCard from '../components/ParameterCard'
import ParameterChart from '../components/ParameterChart'

export default function Dashboard() {
  const [waterBody, setWaterBody] = useState(null)
  const [stations, setStations] = useState([])
  const [selectedStation, setSelectedStation] = useState(null)
  const [readings, setReadings] = useState({})
  const [selectedParam, setSelectedParam] = useState(null)
  const [history, setHistory] = useState(null)

  useEffect(() => {
    getWaterBody().then(r => setWaterBody(r.data[0]))
    getStations().then(r => setStations(r.data))
  }, [])

  // Poll latest readings every 5 seconds when a station is selected
  useEffect(() => {
    if (!selectedStation) return
    const fetch = () =>
      getLatest(selectedStation.id).then(r => setReadings(r.data.readings))
    fetch()
    const interval = setInterval(fetch, 5000)
    return () => clearInterval(interval)
  }, [selectedStation])

  const handleSelectStation = (station) => {
    setSelectedStation(station)
    setSelectedParam(null)
    setHistory(null)
  }

  const handleSelectParam = (param) => {
    setSelectedParam(param)
    getHistory(selectedStation.id, param).then(r => setHistory(r.data))
  }

  return (
    <div className="flex flex-col h-screen bg-gray-50 text-gray-900">
      <Header waterBody={waterBody} />
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
                <h2 className="text-xl font-semibold text-gray-800">
                  {selectedStation.name}
                </h2>
                <p className="text-sm text-gray-500 mt-1">
                  {selectedStation.id} · EA Freshwater Monitoring
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
