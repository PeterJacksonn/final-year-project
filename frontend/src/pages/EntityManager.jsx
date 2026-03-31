import { useState, useEffect, useCallback } from 'react'
import { Link } from 'react-router-dom'
import axios from 'axios'
import Header from '../components/Header'

const api = axios.create({ baseURL: '/api' })

// ─── Entity type config ──────────────────────────────────────────────────────

const ENTITY_TYPES = {
  RiverBasinDistrict: {
    label: 'River Basin Districts',
    singular: 'River Basin District',
    idPrefix: 'urn:ngsi-ld:RiverBasinDistrict:',
    fields: [
      { key: 'name', label: 'Name', type: 'text', placeholder: 'e.g. Humber', required: true },
      { key: 'description', label: 'Description', type: 'text', placeholder: 'Optional description' },
    ],
    toNgsiLd: (id, values) => ({
      id: `urn:ngsi-ld:RiverBasinDistrict:${id}`,
      type: 'RiverBasinDistrict',
      name: { type: 'Property', value: values.name },
      ...(values.description && { description: { type: 'Property', value: values.description } }),
    }),
    displayColumns: ['id', 'name'],
  },

  WaterBody: {
    label: 'Water Bodies',
    singular: 'Water Body',
    idPrefix: 'urn:ngsi-ld:WaterBody:',
    fields: [
      { key: 'name', label: 'Name', type: 'text', placeholder: 'e.g. River Don at Sheffield', required: true },
      { key: 'wbId', label: 'EA Water Body ID', type: 'text', placeholder: 'e.g. GB112071065780', required: true },
      { key: 'riverBasinDistrict', label: 'River Basin District', type: 'relationship', relType: 'RiverBasinDistrict', required: true },
      { key: 'waterBodyType', label: 'Water Body Type', type: 'select', options: ['river', 'lake', 'transitional', 'coastal', 'groundwater'] },
    ],
    toNgsiLd: (id, values) => ({
      id: `urn:ngsi-ld:WaterBody:${id}`,
      type: 'WaterBody',
      name: { type: 'Property', value: values.name },
      wbId: { type: 'Property', value: values.wbId },
      riverBasinDistrict: { type: 'Relationship', object: values.riverBasinDistrict },
      ...(values.waterBodyType && { waterBodyType: { type: 'Property', value: values.waterBodyType } }),
    }),
    displayColumns: ['id', 'name', 'wbId'],
  },

  WaterQualityStation: {
    label: 'Water Quality Stations',
    singular: 'Water Quality Station',
    idPrefix: 'urn:ngsi-ld:WaterQualityStation:',
    fields: [
      { key: 'name', label: 'Station Name', type: 'text', placeholder: 'e.g. Don at Meadowhall', required: true },
      { key: 'eaStationId', label: 'EA Station ID', type: 'text', placeholder: 'e.g. 42435', required: true },
      { key: 'waterBody', label: 'Water Body', type: 'relationship', relType: 'WaterBody', required: true },
      { key: 'latitude', label: 'Latitude', type: 'number', placeholder: 'e.g. 53.4084', required: true },
      { key: 'longitude', label: 'Longitude', type: 'number', placeholder: 'e.g. -1.4612', required: true },
      { key: 'elevation', label: 'Elevation (m)', type: 'number', placeholder: 'Optional' },
    ],
    toNgsiLd: (id, values) => ({
      id: `urn:ngsi-ld:WaterQualityStation:${id}`,
      type: 'WaterQualityStation',
      name: { type: 'Property', value: values.name },
      eaStationId: { type: 'Property', value: values.eaStationId },
      waterBody: { type: 'Relationship', object: values.waterBody },
      location: {
        type: 'GeoProperty',
        value: {
          type: 'Point',
          coordinates: [parseFloat(values.longitude), parseFloat(values.latitude)],
        },
      },
      ...(values.elevation && { elevation: { type: 'Property', value: parseFloat(values.elevation), unitCode: 'MTR' } }),
    }),
    displayColumns: ['id', 'name', 'eaStationId'],
  },
}

// ─── API helpers (all via FastAPI backend) ───────────────────────────────────

async function fetchEntities(type) {
  const res = await api.get(`/entities/${type}`)
  return res.data
}

async function createEntity(entity) {
  await api.post('/entities', entity)
}

async function deleteEntity(id) {
  await api.delete(`/entities/${encodeURIComponent(id)}`)
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function shortId(id) {
  // Strip URN prefix for display: urn:ngsi-ld:WaterBody:GB112 → GB112
  return id?.split(':').slice(3).join(':') || id
}

function extractProp(entity, key) {
  const val = entity?.[key]
  if (!val) return '—'
  if (val.type === 'Property') return String(val.value)
  if (val.type === 'Relationship') return shortId(val.object)
  if (val.type === 'GeoProperty') {
    const coords = val.value?.coordinates
    return coords ? `${coords[1].toFixed(4)}, ${coords[0].toFixed(4)}` : '—'
  }
  return String(val)
}

// ─── Entity Form ──────────────────────────────────────────────────────────────

function EntityForm({ typeKey, existingEntities, onSubmit, onCancel, loading }) {
  const config = ENTITY_TYPES[typeKey]
  const [values, setValues] = useState({})
  const [idSuffix, setIdSuffix] = useState('')
  const [error, setError] = useState(null)

  const set = (key, val) => setValues(prev => ({ ...prev, [key]: val }))

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError(null)
    if (!idSuffix.trim()) { setError('Entity ID is required'); return }
    const missing = config.fields.filter(f => f.required && !values[f.key])
    if (missing.length) { setError(`Required: ${missing.map(f => f.label).join(', ')}`); return }
    try {
      const entity = config.toNgsiLd(idSuffix.trim(), values)
      await onSubmit(entity)
    } catch (err) {
      setError(err.message)
    }
  }

  return (
    <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
      {error && <div className="alert alert-error">{error}</div>}

      <div className="form-group">
        <label className="form-label">Entity ID <span style={{ color: 'var(--color-danger)' }}>*</span></label>
        <div style={{ display: 'flex', alignItems: 'center', gap: 0 }}>
          <span style={{
            padding: '0.5rem 0.6rem',
            background: '#f0f3f7',
            border: '1px solid var(--color-border-strong)',
            borderRight: 'none',
            borderRadius: '4px 0 0 4px',
            fontSize: '0.75rem',
            color: 'var(--color-text-muted)',
            fontFamily: 'IBM Plex Mono, monospace',
            whiteSpace: 'nowrap',
          }}>
            {config.idPrefix}
          </span>
          <input
            className="form-input"
            style={{ borderRadius: '0 4px 4px 0' }}
            value={idSuffix}
            onChange={e => setIdSuffix(e.target.value)}
            placeholder="unique-identifier"
            required
          />
        </div>
        <span className="form-hint">Full ID: {config.idPrefix}{idSuffix || '…'}</span>
      </div>

      {config.fields.map(field => {
        if (field.type === 'relationship') {
          const options = existingEntities[field.relType] || []
          return (
            <div className="form-group" key={field.key}>
              <label className="form-label">
                {field.label} {field.required && <span style={{ color: 'var(--color-danger)' }}>*</span>}
              </label>
              <select
                className="form-select"
                value={values[field.key] || ''}
                onChange={e => set(field.key, e.target.value)}
                required={field.required}
              >
                <option value="">— select {field.label.toLowerCase()} —</option>
                {options.map(e => (
                  <option key={e.id} value={e.id}>
                    {extractProp(e, 'name')} ({shortId(e.id)})
                  </option>
                ))}
              </select>
              {options.length === 0 && (
                <span className="form-hint" style={{ color: 'var(--color-warning)' }}>
                  No {field.relType} entities found — create one first
                </span>
              )}
            </div>
          )
        }

        if (field.type === 'select') {
          return (
            <div className="form-group" key={field.key}>
              <label className="form-label">{field.label}</label>
              <select
                className="form-select"
                value={values[field.key] || ''}
                onChange={e => set(field.key, e.target.value)}
              >
                <option value="">— select —</option>
                {field.options.map(opt => (
                  <option key={opt} value={opt}>{opt}</option>
                ))}
              </select>
            </div>
          )
        }

        return (
          <div className="form-group" key={field.key}>
            <label className="form-label">
              {field.label} {field.required && <span style={{ color: 'var(--color-danger)' }}>*</span>}
            </label>
            <input
              className="form-input"
              type={field.type}
              step={field.type === 'number' ? 'any' : undefined}
              placeholder={field.placeholder}
              value={values[field.key] || ''}
              onChange={e => set(field.key, e.target.value)}
              required={field.required}
            />
          </div>
        )
      })}

      <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.5rem' }}>
        <button type="submit" className="btn btn-primary" disabled={loading}>
          {loading ? 'Creating…' : `Create ${config.singular}`}
        </button>
        <button type="button" className="btn btn-secondary" onClick={onCancel}>
          Cancel
        </button>
      </div>
    </form>
  )
}

// ─── Entity List ──────────────────────────────────────────────────────────────

function EntityList({ typeKey, entities, onDelete, loading }) {
  const config = ENTITY_TYPES[typeKey]
  const [deleting, setDeleting] = useState(null)

  const handleDelete = async (id) => {
    if (!window.confirm(`Delete ${shortId(id)}? This cannot be undone.`)) return
    setDeleting(id)
    try { await onDelete(id) } finally { setDeleting(null) }
  }

  if (loading) {
    return (
      <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--color-text-muted)' }}>
        Loading {config.label.toLowerCase()}…
      </div>
    )
  }

  if (entities.length === 0) {
    return (
      <div style={{
        padding: '2.5rem',
        textAlign: 'center',
        color: 'var(--color-text-muted)',
        border: '2px dashed var(--color-border)',
        borderRadius: '6px',
        background: '#fafbfc',
      }}>
        <div style={{ fontSize: '1.75rem', marginBottom: '0.5rem' }}>∅</div>
        <div>No {config.label.toLowerCase()} found</div>
        <div style={{ fontSize: '0.8rem', marginTop: '0.25rem' }}>Create one using the form above</div>
      </div>
    )
  }

  return (
    <div style={{ overflowX: 'auto' }}>
      <table className="data-table">
        <thead>
          <tr>
            <th>ID</th>
            <th>Name</th>
            {typeKey === 'WaterBody' && <th>EA Water Body ID</th>}
            {typeKey === 'WaterQualityStation' && <th>EA Station ID</th>}
            {typeKey === 'WaterBody' && <th>River Basin</th>}
            {typeKey === 'WaterQualityStation' && <th>Location</th>}
            <th style={{ width: 80 }}>Actions</th>
          </tr>
        </thead>
        <tbody>
          {entities.map(entity => (
            <tr key={entity.id}>
              <td>
                <code className="mono" style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)' }}>
                  {shortId(entity.id)}
                </code>
              </td>
              <td style={{ fontWeight: 500 }}>{extractProp(entity, 'name')}</td>
              {typeKey === 'WaterBody' && <td><code className="mono" style={{ fontSize: '0.75rem' }}>{extractProp(entity, 'wbId')}</code></td>}
              {typeKey === 'WaterQualityStation' && <td><code className="mono" style={{ fontSize: '0.75rem' }}>{extractProp(entity, 'eaStationId')}</code></td>}
              {typeKey === 'WaterBody' && <td style={{ color: 'var(--color-text-muted)', fontSize: '0.8rem' }}>{extractProp(entity, 'riverBasinDistrict')}</td>}
              {typeKey === 'WaterQualityStation' && <td style={{ color: 'var(--color-text-muted)', fontSize: '0.8rem', fontFamily: 'IBM Plex Mono, monospace' }}>{extractProp(entity, 'location')}</td>}
              <td>
                <button
                  className="btn btn-danger btn-sm"
                  onClick={() => handleDelete(entity.id)}
                  disabled={deleting === entity.id}
                >
                  {deleting === entity.id ? '…' : 'Delete'}
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function EntityManager() {
  const [activeType, setActiveType] = useState('RiverBasinDistrict')
  const [entities, setEntities] = useState({
    RiverBasinDistrict: [],
    WaterBody: [],
    WaterQualityStation: [],
  })
  const [loadingState, setLoadingState] = useState({})
  const [showForm, setShowForm] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [message, setMessage] = useState(null)

  const loadType = useCallback(async (type) => {
    setLoadingState(prev => ({ ...prev, [type]: true }))
    try {
      const data = await fetchEntities(type)
      setEntities(prev => ({ ...prev, [type]: data }))
    } catch (err) {
      console.error(err)
    } finally {
      setLoadingState(prev => ({ ...prev, [type]: false }))
    }
  }, [])

  // Load all types on mount (needed for relationship dropdowns)
  useEffect(() => {
    Object.keys(ENTITY_TYPES).forEach(loadType)
  }, [loadType])

  const handleCreate = async (entity) => {
    setSubmitting(true)
    try {
      await createEntity(entity)
      await loadType(activeType)
      setShowForm(false)
      setMessage({ type: 'success', text: `${ENTITY_TYPES[activeType].singular} created successfully` })
      setTimeout(() => setMessage(null), 4000)
    } finally {
      setSubmitting(false)
    }
  }

  const handleDelete = async (id) => {
    await deleteEntity(id)
    setEntities(prev => ({
      ...prev,
      [activeType]: prev[activeType].filter(e => e.id !== id),
    }))
    setMessage({ type: 'success', text: 'Entity deleted' })
    setTimeout(() => setMessage(null), 3000)
  }

  const config = ENTITY_TYPES[activeType]
  const activeEntities = entities[activeType] || []

  return (
    <div className="page-layout">
      <Header />

      <div className="page-content">
        {/* Page title */}
        <div style={{ marginBottom: '1.5rem' }}>
          <h1>Entity Management</h1>
          <p style={{ color: 'var(--color-text-muted)', marginTop: '0.25rem', fontSize: '0.875rem' }}>
            Create and manage NGSI-LD entities in the Orion-LD context broker
          </p>
        </div>

        {message && (
          <div className={`alert alert-${message.type}`} style={{ marginBottom: '1rem' }}>
            {message.text}
          </div>
        )}

        {/* Entity type tabs */}
        <div style={{
          display: 'flex',
          gap: 0,
          marginBottom: '1.5rem',
          borderBottom: '2px solid var(--color-border)',
        }}>
          {Object.entries(ENTITY_TYPES).map(([key, cfg]) => (
            <button
              key={key}
              onClick={() => { setActiveType(key); setShowForm(false) }}
              style={{
                background: 'none',
                border: 'none',
                padding: '0.65rem 1.25rem',
                cursor: 'pointer',
                fontSize: '0.875rem',
                fontWeight: activeType === key ? 600 : 400,
                color: activeType === key ? 'var(--color-primary)' : 'var(--color-text-muted)',
                borderBottom: activeType === key ? '2px solid var(--color-primary)' : '2px solid transparent',
                marginBottom: '-2px',
                transition: 'color 0.15s',
                display: 'flex',
                alignItems: 'center',
                gap: '0.4rem',
              }}
            >
              {cfg.label}
              <span style={{
                background: activeType === key ? 'var(--color-primary-light)' : '#f0f3f7',
                color: activeType === key ? 'var(--color-primary)' : 'var(--color-text-muted)',
                borderRadius: '10px',
                padding: '0.1rem 0.5rem',
                fontSize: '0.75rem',
                fontWeight: 600,
              }}>
                {entities[key]?.length ?? '…'}
              </span>
            </button>
          ))}
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: showForm ? '1fr 380px' : '1fr', gap: '1.5rem', alignItems: 'start' }}>

          {/* Left: list + create button */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <h2 style={{ fontSize: '1rem' }}>
                {activeEntities.length} {config.label}
              </h2>
              {!showForm && (
                <button className="btn btn-primary" onClick={() => setShowForm(true)}>
                  + New {config.singular}
                </button>
              )}
            </div>

            <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
              <EntityList
                typeKey={activeType}
                entities={activeEntities}
                onDelete={handleDelete}
                loading={loadingState[activeType]}
              />
            </div>
          </div>

          {/* Right: create form */}
          {showForm && (
            <div className="card" style={{ position: 'sticky', top: '1rem' }}>
              <h2 style={{ marginBottom: '1.25rem', fontSize: '1rem' }}>
                New {config.singular}
              </h2>
              <EntityForm
                typeKey={activeType}
                existingEntities={entities}
                onSubmit={handleCreate}
                onCancel={() => setShowForm(false)}
                loading={submitting}
              />
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
