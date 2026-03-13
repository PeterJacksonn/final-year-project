export default function Sidebar({ stations, selectedStation, onSelect }) {
  const getName = (s) =>
    s['https://uri.etsi.org/ngsi-ld/name']?.value || s.name?.value || s.id

  const getId = (s) =>
    s.eaNotation?.value || s.id.split(':').pop()

  return (
    <aside className="w-64 bg-white border-r border-gray-200 overflow-y-auto flex-shrink-0">
      <div className="p-4">
        <p className="text-xs font-medium text-gray-400 uppercase tracking-wide mb-3">
          Monitoring Stations
        </p>
        <div className="space-y-1">
          {stations.map(s => {
            const isSelected = selectedStation?.id === getId(s)
            return (
              <button
                key={s.id}
                onClick={() => onSelect({ id: getId(s), name: getName(s) })}
                className={`w-full text-left px-3 py-2.5 rounded-lg transition-colors ${
                  isSelected
                    ? 'bg-blue-50 border border-blue-200 text-blue-800'
                    : 'hover:bg-gray-50 text-gray-700 border border-transparent'
                }`}
              >
                <div className="flex items-center gap-2">
                  <div className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${
                    isSelected ? 'bg-blue-600' : 'bg-teal-500'
                  }`} />
                  <div>
                    <div className="text-sm font-medium leading-tight">{getName(s)}</div>
                    <div className="text-xs text-gray-400 mt-0.5">{getId(s)}</div>
                  </div>
                </div>
              </button>
            )
          })}
        </div>
      </div>
    </aside>
  )
}
