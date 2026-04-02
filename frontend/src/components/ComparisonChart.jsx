import {
  LineChart, Line, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, Legend
} from 'recharts'

export const TOL_COLOURS = [
  'var(--tol-blue)',
  'var(--tol-red)',
  'var(--tol-green)',
  'var(--tol-yellow)',
  'var(--tol-cyan)',
  'var(--tol-purple)',
]

// Merge separate per-station history arrays onto a shared timestamp axis.
// Stations may have readings at different times, so gaps are left as undefined
// and connectNulls bridges them visually.
function mergeHistories(histories) {
  const map = new Map()
  histories.forEach(({ id, data }) => {
    data.forEach(({ timestamp, value }) => {
      if (!map.has(timestamp)) map.set(timestamp, { timestamp })
      map.get(timestamp)[id] = value
    })
  })
  return Array.from(map.values()).sort((a, b) => a.timestamp.localeCompare(b.timestamp))
}

export default function ComparisonChart({ histories, meta }) {
  const merged = mergeHistories(histories)

  const formatted = merged.map(row => ({
    ...row,
    _date: new Date(row.timestamp).toLocaleDateString('en-GB', {
      day: 'numeric', month: 'short', year: '2-digit',
    }),
  }))

  const tickInterval = Math.max(1, Math.floor(formatted.length / 10))

  return (
    <div style={{
      background: 'white',
      border: '1px solid var(--color-border)',
      borderRadius: '8px',
      padding: '1.5rem',
    }}>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: '0.5rem', marginBottom: '1.5rem' }}>
        <h3 style={{ fontWeight: 600, fontSize: '1rem' }}>{meta.label}</h3>
        <span style={{ color: 'var(--color-text-muted)', fontSize: '0.875rem' }}>{meta.unit}</span>
      </div>

      <ResponsiveContainer width="100%" height={320}>
        <LineChart data={formatted} margin={{ top: 4, right: 24, bottom: 4, left: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
          <XAxis
            dataKey="_date"
            tick={{ fontSize: 11, fill: '#9ca3af' }}
            interval={tickInterval}
          />
          <YAxis
            tick={{ fontSize: 11, fill: '#9ca3af' }}
            domain={['auto', 'auto']}
            width={48}
          />
          <Tooltip
            contentStyle={{ fontSize: 12, borderColor: '#e5e7eb' }}
            formatter={(value, key) => {
              const station = histories.find(h => h.id === key)
              return [`${value} ${meta.unit}`, station?.name || key]
            }}
          />
          <Legend
            formatter={(key) => histories.find(h => h.id === key)?.name || key}
            wrapperStyle={{ fontSize: '0.8rem', paddingTop: '0.75rem' }}
          />
          {histories.map(({ id }, i) => (
            <Line
              key={id}
              type="monotone"
              dataKey={id}
              stroke={TOL_COLOURS[i % TOL_COLOURS.length]}
              strokeWidth={2}
              dot={{ r: 3, fill: TOL_COLOURS[i % TOL_COLOURS.length] }}
              activeDot={{ r: 5 }}
              connectNulls
            />
          ))}
        </LineChart>
      </ResponsiveContainer>
    </div>
  )
}
