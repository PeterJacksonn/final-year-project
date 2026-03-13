import {
    LineChart, Line, XAxis, YAxis, CartesianGrid,
    Tooltip, ResponsiveContainer
} from 'recharts'

export default function ParameterChart({ history }) {
    const { meta, data } = history

    const formatted = data.map(d => ({
        ...d,
        date: new Date(d.timestamp).toLocaleDateString('en-GB', {
            day: 'numeric', month: 'short', year: '2-digit'
        })
    }))

    return (
        <div className="bg-white border border-gray-200 rounded-lg p-6">
            <div className="flex items-baseline gap-2 mb-6">
                <h3 className="font-semibold text-gray-800">{meta.label}</h3>
                <span className="text-sm text-gray-400">{meta.unit}</span>
            </div>
            <ResponsiveContainer width="100%" height={260}>
                <LineChart data={formatted}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                    <XAxis dataKey="date" tick={{ fontSize: 11, fill: '#9ca3af' }} />
                    <YAxis
                        tick={{ fontSize: 11, fill: '#9ca3af' }}
                        domain={['auto', 'auto']}
                    />
                    <Tooltip
                        contentStyle={{ fontSize: 12, borderColor: '#e5e7eb' }}
                        formatter={(v) => [`${v} ${meta.unit}`, meta.label]}
                    />
                    <Line
                        type="monotone"
                        dataKey="value"
                        stroke="#0077BB"
                        strokeWidth={2}
                        dot={{ r: 3, fill: '#0077BB' }}
                        activeDot={{ r: 5 }}
                    />
                </LineChart>
            </ResponsiveContainer>
        </div>
    )
}
