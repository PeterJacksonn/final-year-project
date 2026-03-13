const THRESHOLDS = {
  pH:                 { good: [6, 9],    warn: [5.5, 9.5] },
  dissolvedOxygen:    { good: [8, Infinity], warn: [6, Infinity] },
  ammoniacalNitrogen: { good: [0, 0.5],  warn: [0, 1.0] },
  phosphate:          { good: [0, 0.1],  warn: [0, 0.2] },
  nitrate:            { good: [0, 5],    warn: [0, 10] },
}

function getStatus(param, value) {
  const t = THRESHOLDS[param]
  if (!t) return 'neutral'
  const [lo, hi] = t.good
  if (value >= lo && value <= hi) return 'good'
  const [wlo, whi] = t.warn
  if (value >= wlo && value <= whi) return 'warn'
  return 'bad'
}

const STATUS_STYLES = {
  good:    'border-l-4 border-l-teal-500',
  warn:    'border-l-4 border-l-orange-400',
  bad:     'border-l-4 border-l-red-600',
  neutral: 'border-l-4 border-l-transparent',
}

const STATUS_DOT = {
  good:    'bg-teal-500',
  warn:    'bg-orange-400',
  bad:     'bg-red-600',
  neutral: 'bg-gray-300',
}

export default function ParameterCard({ param, data, selected, onClick }) {
  const date = new Date(data.timestamp).toLocaleDateString('en-GB', {
    day: 'numeric', month: 'short', year: '2-digit'
  })

  const status = getStatus(param, data.value)

  return (
    <button
      onClick={onClick}
      className={`text-left p-4 rounded-lg border transition-all bg-white
        ${STATUS_STYLES[status]}
        ${selected
          ? 'border-blue-400 shadow-sm'
          : 'border-gray-200 hover:border-gray-300 hover:shadow-sm'
        }`}
    >
      <div className="flex items-center justify-between mb-2">
        <div className="text-xs font-medium text-gray-500 uppercase tracking-wide">
          {data.label}
        </div>
        <div className={`w-2 h-2 rounded-full ${STATUS_DOT[status]}`} />
      </div>
      <div className="text-2xl font-semibold text-gray-900">{data.value}</div>
      <div className="text-xs text-gray-400 mt-1">{data.unit}</div>
      <div className="text-xs text-gray-300 mt-2">{date}</div>
    </button>
  )
}
