import { useState, useEffect } from 'react'

export default function Header({ waterBody }) {
  const [time, setTime] = useState(new Date())
  useEffect(() => {
    const t = setInterval(() => setTime(new Date()), 1000)
    return () => clearInterval(t)
  }, [])

  const name = waterBody?.['https://uri.etsi.org/ngsi-ld/name']?.value
    || waterBody?.name?.value
    || 'Water Quality Monitor'

  return (
    <header className="flex items-center justify-between px-6 py-3 bg-white border-b border-gray-200 shadow-sm">
      <div className="flex items-center gap-3">
        <div className="w-2 h-2 rounded-full bg-blue-600 animate-pulse" />
        <span className="font-semibold text-gray-800 tracking-tight">{name}</span>
      </div>
      <span className="text-xs text-gray-400 font-mono">
        {time.toISOString().replace('T', ' ').slice(0, 19)} UTC
      </span>
    </header>
  )
}
