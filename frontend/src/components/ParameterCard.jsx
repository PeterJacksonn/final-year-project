export default function ParameterCard({ data, selected, onClick }) {
    const date = new Date(data.timestamp).toLocaleDateString('en-GB', {
        day: 'numeric', month: 'short', year: '2-digit'
    })

    return (
        <button
            onClick={onClick}
            className={`text-left p-4 rounded-lg border transition-all bg-white
            ${selected ? 'border-blue-400 shadow-sm' : 'border-gray-200 hover:border-gray-300 hover:shadow-sm'}`}
        >
            <div className="text-xs font-medium text-gray-500 mb-2">{data.label}</div>
            <div className="text-2xl font-semibold text-gray-900">{data.value}</div>
            <div className="text-xs text-gray-400 mt-1">{data.unit}</div>
            <div className="text-xs text-gray-300 mt-2">{date}</div>
        </button>
    )
}
