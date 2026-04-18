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

const NICE_STEPS = [
  60e3, 2*60e3, 5*60e3, 10*60e3, 15*60e3, 30*60e3,
  3600e3, 2*3600e3, 4*3600e3, 6*3600e3, 12*3600e3,
  86400e3, 2*86400e3, 7*86400e3, 14*86400e3,
  30*86400e3, 60*86400e3, 90*86400e3,
]

function computeTicks(minTs, maxTs, targetCount = 6) {
  const rawStep = (maxTs - minTs) / targetCount
  const step = NICE_STEPS.find(s => s >= rawStep) ?? NICE_STEPS[NICE_STEPS.length - 1]
  const start = Math.ceil(minTs / step) * step
  const ticks = []
  for (let t = start; t <= maxTs; t += step) ticks.push(t)
  return ticks
}

function formatTick(ts, rangeMs) {
  const d = new Date(ts)
  if (rangeMs <= 6 * 3600e3)   return d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })
  if (rangeMs <= 48 * 3600e3)  return d.toLocaleString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })
  if (rangeMs <= 90 * 86400e3) return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })
  return d.toLocaleDateString('en-GB', { month: 'short', year: '2-digit' })
}

function formatTooltipLabel(ts, rangeMs) {
  const d = new Date(ts)
  if (rangeMs <= 48 * 3600e3) return d.toLocaleString('en-GB', { day: 'numeric', month: 'short', year: '2-digit', hour: '2-digit', minute: '2-digit' })
  return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: '2-digit' })
}

// Merge multiple series onto a shared numeric timestamp axis.
// Each row: { ts, [seriesId]: value, ... }
function mergeToTimeSeries(series) {
  const map = new Map()
  series.forEach(({ id, data }) => {
    data.forEach(({ timestamp, value }) => {
      const ts = new Date(timestamp).getTime()
      if (!map.has(ts)) map.set(ts, { ts })
      map.get(ts)[id] = value
    })
  })
  return Array.from(map.values()).sort((a, b) => a.ts - b.ts)
}

// series: [{ id, name, data: [{ timestamp, value }] }]
// meta:   { label, unit }
export default function Chart({ series, meta, yMin = null, yMax = null }) {
  const MAX_POINTS = 500
  const merged = mergeToTimeSeries(series)
  const downsampled = merged.length <= MAX_POINTS
    ? merged
    : merged.filter((_, i) => i % Math.ceil(merged.length / MAX_POINTS) === 0)

  const minTs   = downsampled[0]?.ts ?? 0
  const maxTs   = downsampled[downsampled.length - 1]?.ts ?? 0
  const rangeMs = maxTs - minTs
  const ticks   = downsampled.length >= 2 ? computeTicks(minTs, maxTs) : []

  const yDomain = [yMin ?? 'auto', yMax ?? 'auto']
  const clipped = (yMin != null || yMax != null)
    ? downsampled.filter(row =>
        series.some(({ id }) => {
          const v = row[id]
          return v != null && ((yMin != null && v < yMin) || (yMax != null && v > yMax))
        })
      ).length
    : 0

  const multi = series.length > 1

  return (
    <div style={{ background: 'white', border: '1px solid var(--color-border)', borderRadius: '8px', padding: '1.5rem' }}>
      <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: '1.5rem' }}>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: '0.5rem' }}>
          <h3 style={{ fontWeight: 600, fontSize: '1rem' }}>{meta.label}</h3>
          <span style={{ color: 'var(--color-text-muted)', fontSize: '0.875rem' }}>{meta.unit}</span>
        </div>
        {clipped > 0 && (
          <span style={{ fontSize: '0.75rem', color: 'var(--tol-yellow)', fontWeight: 500 }}>
            ⚠ {clipped} point{clipped > 1 ? 's' : ''} outside range
          </span>
        )}
      </div>

      <ResponsiveContainer width="100%" height={multi ? 320 : 260}>
        <LineChart data={downsampled} margin={{ top: 4, right: 24, bottom: 4, left: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
          <XAxis
            dataKey="ts"
            type="number"
            scale="time"
            domain={['dataMin', 'dataMax']}
            ticks={ticks}
            tickFormatter={ts => formatTick(ts, rangeMs)}
            tick={{ fontSize: 11, fill: '#9ca3af' }}
          />
          <YAxis
            tick={{ fontSize: 11, fill: '#9ca3af' }}
            domain={yDomain}
            allowDataOverflow
            width={48}
          />
          <Tooltip
            contentStyle={{ fontSize: 12, borderColor: '#e5e7eb' }}
            labelFormatter={ts => formatTooltipLabel(ts, rangeMs)}
            formatter={(value, key) => {
              const s = series.find(s => s.id === key)
              return [`${value} ${meta.unit}`, multi ? (s?.name || key) : meta.label]
            }}
          />
          {multi && (
            <Legend
              formatter={key => series.find(s => s.id === key)?.name || key}
              wrapperStyle={{ fontSize: '0.8rem', paddingTop: '0.75rem' }}
            />
          )}
          {series.map(({ id }, i) => (
            <Line
              key={id}
              type="monotone"
              dataKey={id}
              stroke={TOL_COLOURS[i % TOL_COLOURS.length]}
              strokeWidth={1.5}
              dot={downsampled.length <= 300
                ? { r: downsampled.length <= 60 ? 4 : 2, fill: TOL_COLOURS[i % TOL_COLOURS.length], strokeWidth: 0 }
                : false
              }
              activeDot={{ r: 5, fill: TOL_COLOURS[i % TOL_COLOURS.length] }}
              connectNulls
              isAnimationActive={false}
            />
          ))}
        </LineChart>
      </ResponsiveContainer>
    </div>
  )
}
