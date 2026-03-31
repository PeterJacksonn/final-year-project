import { useState, useEffect, useCallback } from 'react'
import { Link } from 'react-router-dom'
import { MapContainer, TileLayer, Marker, Popup, FeatureGroup } from 'react-leaflet'
import Header from '../components/Header'
import { EditControl } from 'react-leaflet-draw'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import 'leaflet-draw/dist/leaflet.draw.css'
import axios from 'axios'

const api = axios.create({ baseURL: '/api' })

// ─── Fix Leaflet default icon broken by bundlers ──────────────────────────────
delete L.Icon.Default.prototype._getIconUrl
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png',
})

// ─── Custom marker icons using Tol colours ───────────────────────────────────
function makeIcon(color, selected = false) {
  const size = selected ? 14 : 10
  const svg = encodeURIComponent(`
    <svg xmlns="http://www.w3.org/2000/svg" width="${size * 2}" height="${size * 2}">
      <circle cx="${size}" cy="${size}" r="${size - 1}"
        fill="${color}" stroke="white" stroke-width="2"/>
    </svg>
  `)
  return L.divIcon({
    html: `<img src="data:image/svg+xml,${svg}" />`,
    iconSize: [size * 2, size * 2],
    iconAnchor: [size, size],
    className: '',
  })
}

const ICON_DEFAULT  = makeIcon('#4477AA')
const ICON_SELECTED = makeIcon('#EE6677', true)

// ─── Helpers ──────────────────────────────────────────────────────────────────
function stationName(s) {
  return s['https://uri.etsi.org/ngsi-ld/name']?.value
    || s.name?.value
    || s.id?.split(':').pop()
    || 'Unknown Station'
}

function stationCoords(s) {
  const coords = s.location?.value?.coordinates
  if (!coords) return null
  return [coords[1], coords[0]] // GeoJSON [lng,lat] → Leaflet [lat,lng]
}

function shortId(id) {
  return id?.split(':').slice(3).join(':') || id
}

function pointInPolygon(point, polygon) {
  // Ray casting algorithm
  const [lat, lng] = point
  const latlngs = polygon.getLatLngs()[0]
  let inside = false
  for (let i = 0, j = latlngs.length - 1; i < latlngs.length; j = i++) {
    const xi = latlngs[i].lat, yi = latlngs[i].lng
    const xj = latlngs[j].lat, yj = latlngs[j].lng
    const intersect = ((yi > lng) !== (yj > lng)) &&
      (lat < (xj - xi) * (lng - yi) / (yj - yi) + xi)
    if (intersect) inside = !inside
  }
  return inside
}

// ─── Sidebar: single station ──────────────────────────────────────────────────
function StationSidebar({ station, readings, loadingReadings }) {
  const name = stationName(station)
  const id = shortId(station.id)

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
      <div>
        <div style={{ fontSize: '0.7rem', color: 'var(--color-text-faint)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
          Selected Station
        </div>
        <h3 style={{ fontSize: '0.95rem', marginTop: '0.2rem' }}>{name}</h3>
        <code style={{ fontSize: '0.7rem', color: 'var(--color-text-muted)' }}>{id}</code>
      </div>

      {station.isPartOf && (
        <div style={{ fontSize: '0.8rem', color: 'var(--color-text-muted)' }}>
          <span style={{ fontWeight: 500 }}>Water Body: </span>
          {shortId(station.isPartOf.object)}
        </div>
      )}

      <hr className="divider" />

      <div>
        <div style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--color-text-muted)', marginBottom: '0.5rem', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
          Latest Readings
        </div>

        {loadingReadings ? (
          <div style={{ color: 'var(--color-text-faint)', fontSize: '0.8rem' }}>Loading…</div>
        ) : readings && Object.keys(readings).length > 0 ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
            {Object.entries(readings).map(([param, data]) => (
              <div key={param} style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                padding: '0.35rem 0.6rem',
                background: '#f8fafc',
                borderRadius: '4px',
                border: '1px solid var(--color-border)',
              }}>
                <span style={{ fontSize: '0.78rem', color: 'var(--color-text-muted)' }}>
                  {data.label}
                </span>
                <span style={{ fontSize: '0.82rem', fontWeight: 600, fontFamily: 'IBM Plex Mono, monospace' }}>
                  {data.value.toFixed(2)}
                  <span style={{ fontSize: '0.7rem', fontWeight: 400, color: 'var(--color-text-faint)', marginLeft: '0.2rem' }}>
                    {data.unit}
                  </span>
                </span>
              </div>
            ))}
          </div>
        ) : (
          <div style={{ color: 'var(--color-text-faint)', fontSize: '0.8rem' }}>
            No readings available
          </div>
        )}
      </div>

      <Link
        to={`/dashboard?station=${id}`}
        className="btn btn-primary"
        style={{ textAlign: 'center', marginTop: '0.25rem' }}
      >
        View Full Dashboard →
      </Link>
    </div>
  )
}

// ─── Sidebar: multiple stations ───────────────────────────────────────────────
function MultiStationSidebar({ stations, onRemove, onClear }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <div style={{ fontSize: '0.7rem', color: 'var(--color-text-faint)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            Selected Area
          </div>
          <h3 style={{ fontSize: '0.95rem', marginTop: '0.2rem' }}>
            {stations.length} station{stations.length !== 1 ? 's' : ''}
          </h3>
        </div>
        <button className="btn btn-secondary btn-sm" onClick={onClear}>
          Clear
        </button>
      </div>

      <hr className="divider" />

      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
        {stations.map(s => (
          <div key={s.id} style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '0.5rem 0.6rem',
            background: '#f8fafc',
            borderRadius: '4px',
            border: '1px solid var(--color-border)',
          }}>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: '0.82rem', fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {stationName(s)}
              </div>
              <div style={{ fontSize: '0.7rem', color: 'var(--color-text-faint)', fontFamily: 'IBM Plex Mono, monospace' }}>
                {shortId(s.id)}
              </div>
            </div>
            <button
              className="btn btn-danger btn-sm"
              style={{ marginLeft: '0.5rem', flexShrink: 0 }}
              onClick={() => onRemove(s.id)}
            >
              ✕
            </button>
          </div>
        ))}
      </div>

      {stations.length > 1 && (
        <Link
          to={`/dashboard?stations=${stations.map(s => shortId(s.id)).join(',')}`}
          className="btn btn-primary"
          style={{ textAlign: 'center' }}
        >
          Compare in Dashboard →
        </Link>
      )}
      {stations.length === 1 && (
        <Link
          to={`/dashboard?station=${shortId(stations[0].id)}`}
          className="btn btn-primary"
          style={{ textAlign: 'center' }}
        >
          View Full Dashboard →
        </Link>
      )}
    </div>
  )
}

// ─── Draw control wrapper ─────────────────────────────────────────────────────
function DrawControl({ onPolygonCreated }) {
  return (
    <FeatureGroup>
      <EditControl
        position="topleft"
        onCreated={(e) => {
          if (e.layerType === 'polygon') {
            onPolygonCreated(e.layer)
            // Remove the drawn layer after selection — we use our own markers
            e.layer.remove()
          }
        }}
        draw={{
          polygon: {
            shapeOptions: {
              color: '#4477AA',
              fillOpacity: 0.1,
              weight: 2,
            },
            showArea: false,
          },
          rectangle: false,
          circle: false,
          circlemarker: false,
          marker: false,
          polyline: false,
        }}
        edit={{ edit: false, remove: false }}
      />
    </FeatureGroup>
  )
}

// ─── Main MapView page ────────────────────────────────────────────────────────
export default function MapView() {
  const [stations, setStations] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  // Selection state
  const [selectedStation, setSelectedStation] = useState(null)   // single click
  const [selectedGroup, setSelectedGroup] = useState([])          // polygon select
  const [stationReadings, setStationReadings] = useState(null)
  const [loadingReadings, setLoadingReadings] = useState(false)

  // Load all stations
  useEffect(() => {
    api.get('/stations')
      .then(r => setStations(r.data))
      .catch(err => setError(err.message))
      .finally(() => setLoading(false))
  }, [])

  // Load readings when single station selected
  useEffect(() => {
    if (!selectedStation) { setStationReadings(null); return }
    const id = shortId(selectedStation.id)
    setLoadingReadings(true)
    api.get(`/stations/${id}/latest`)
      .then(r => setStationReadings(r.data.readings))
      .catch(() => setStationReadings(null))
      .finally(() => setLoadingReadings(false))
  }, [selectedStation])

  const handleMarkerClick = useCallback((station) => {
    setSelectedGroup([])
    setSelectedStation(station)
  }, [])

  const handlePolygonCreated = useCallback((layer) => {
    const inside = stations.filter(s => {
      const coords = stationCoords(s)
      return coords && pointInPolygon(coords, layer)
    })
    if (inside.length === 0) return
    setSelectedStation(null)
    setSelectedGroup(inside)
  }, [stations])

  const handleRemoveFromGroup = useCallback((id) => {
    setSelectedGroup(prev => {
      const next = prev.filter(s => s.id !== id)
      if (next.length === 0) { return [] }
      return next
    })
  }, [])

  const handleClearSelection = useCallback(() => {
    setSelectedStation(null)
    setSelectedGroup([])
  }, [])

  const selectedIds = new Set([
    ...(selectedStation ? [selectedStation.id] : []),
    ...selectedGroup.map(s => s.id),
  ])

  const hasSidebar = selectedStation || selectedGroup.length > 0

  // Sheffield area default centre
  const mapCenter = [53.38, -1.47]

  return (
    <div className="page-layout">
      <Header />

      {/* Map + sidebar layout */}
      <div style={{ flex: 1, display: 'flex', overflow: 'hidden', minHeight: 0 }}>

        {/* Map */}
        <div style={{ flex: 1, position: 'relative' }}>
          {loading && (
            <div style={{
              position: 'absolute', inset: 0, zIndex: 1000,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              background: 'rgba(255,255,255,0.8)',
              fontSize: '0.875rem', color: 'var(--color-text-muted)',
            }}>
              Loading stations…
            </div>
          )}
          {error && (
            <div style={{
              position: 'absolute', top: '1rem', left: '50%', transform: 'translateX(-50%)',
              zIndex: 1000,
            }}>
              <div className="alert alert-error">{error}</div>
            </div>
          )}

          {/* Hint */}
          <div style={{
            position: 'absolute', bottom: '1.5rem', left: '50%', transform: 'translateX(-50%)',
            zIndex: 1000,
            background: 'rgba(255,255,255,0.92)',
            border: '1px solid var(--color-border)',
            borderRadius: '4px',
            padding: '0.4rem 0.8rem',
            fontSize: '0.75rem',
            color: 'var(--color-text-muted)',
            pointerEvents: 'none',
            whiteSpace: 'nowrap',
          }}>
            Click a station to select · Use the polygon tool (top left) to select an area
          </div>

          <MapContainer
            center={mapCenter}
            zoom={11}
            style={{ height: '100%', width: '100%' }}
            zoomControl={true}
          >
            <TileLayer
              attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
              url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            />

            <DrawControl onPolygonCreated={handlePolygonCreated} />

            {stations.map(station => {
              const coords = stationCoords(station)
              if (!coords) return null
              const isSelected = selectedIds.has(station.id)
              return (
                <Marker
                  key={station.id}
                  position={coords}
                  icon={isSelected ? ICON_SELECTED : ICON_DEFAULT}
                  eventHandlers={{
                    click: () => handleMarkerClick(station),
                  }}
                  zIndexOffset={isSelected ? 1000 : 0}
                >
                  <Popup>
                    <strong>{stationName(station)}</strong><br />
                    <small style={{ fontFamily: 'monospace' }}>{shortId(station.id)}</small>
                  </Popup>
                </Marker>
              )
            })}
          </MapContainer>
        </div>

        {/* Sidebar */}
        {hasSidebar && (
          <div style={{
            width: '300px',
            flexShrink: 0,
            background: 'var(--color-surface)',
            borderLeft: '1px solid var(--color-border)',
            padding: '1.25rem',
            overflowY: 'auto',
            position: 'relative',
          }}>
            <button
              onClick={handleClearSelection}
              style={{
                position: 'absolute',
                top: '0.75rem',
                right: '0.75rem',
                background: 'none',
                border: 'none',
                cursor: 'pointer',
                color: 'var(--color-text-muted)',
                fontSize: '1rem',
                lineHeight: 1,
                padding: '0.2rem',
              }}
              title="Close"
            >
              ✕
            </button>

            {selectedStation && (
              <StationSidebar
                station={selectedStation}
                readings={stationReadings}
                loadingReadings={loadingReadings}
              />
            )}

            {selectedGroup.length > 0 && (
              <MultiStationSidebar
                stations={selectedGroup}
                onRemove={handleRemoveFromGroup}
                onClear={handleClearSelection}
              />
            )}
          </div>
        )}
      </div>
    </div>
  )
}
