import { stationName, stationNotation } from '../utils/station'

export default function Sidebar({ stations, selectedStation, onSelect }) {

  return (
    <aside className="w-64 bg-white border-r border-gray-200 overflow-y-auto flex-shrink-0">
      <div className="p-4">
        <p className="text-xs font-medium text-gray-400 uppercase tracking-wide mb-3">
          Monitoring Stations
        </p>
        <div className="space-y-1">
          {stations.map(s => {
            const notation = stationNotation(s)
            const isSelected = stationNotation(selectedStation) === notation
            return (
              <button
                key={s.id}
                onClick={() => onSelect(s)}
                className={`w-full text-left px-3 py-2.5 rounded-lg transition-colors ${
                  isSelected
                    ? 'bg-blue-50 border border-blue-200 text-blue-800'
                    : 'hover:bg-gray-50 text-gray-700 border border-transparent'
                }`}
              >
                <div className="text-sm font-medium leading-tight">{stationName(s)}</div>
                <div className="text-xs text-gray-400 mt-0.5">{notation}</div>
              </button>
            )
          })}
        </div>
      </div>
    </aside>
  )
}
