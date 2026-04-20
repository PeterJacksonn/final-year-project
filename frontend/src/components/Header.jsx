import { useState, useEffect } from 'react'
import { Link, useLocation } from 'react-router-dom'

export default function Header() {
  const [time, setTime] = useState(new Date())
  const location = useLocation()

  useEffect(() => {
    const t = setInterval(() => setTime(new Date()), 1000)
    return () => clearInterval(t)
  }, [])

  const navLinks = [
    { to: '/dashboard', label: 'Dashboard' },
    { to: '/map',       label: 'Map' },
    { to: '/entities',  label: 'Entities' },
  ]

  return (
    <header style={{
      background: 'var(--color-primary)',
      color: '#fff',
      padding: '0 2rem',
      display: 'flex',
      alignItems: 'center',
      gap: '2rem',
      height: '52px',
      borderBottom: '3px solid var(--color-primary-dark)',
      flexShrink: 0,
    }}>
      {/* Brand */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
        <span style={{ fontWeight: 600, letterSpacing: '0.03em', fontSize: '0.9rem' }}>
          FIWARE Water Quality Monitor
        </span>
      </div>

      {/* Nav */}
      <nav style={{ display: 'flex', gap: '0.25rem' }}>
        {navLinks.map(({ to, label }) => {
          const active = location.pathname.startsWith(to)
          return (
            <Link key={to} to={to} style={{
              color: '#fff',
              textDecoration: 'none',
              padding: '0.3rem 0.75rem',
              borderRadius: '3px',
              fontSize: '0.85rem',
              background: active ? 'rgba(255,255,255,0.2)' : 'transparent',
              transition: 'background 0.15s',
            }}>
              {label}
            </Link>
          )
        })}
      </nav>

      {/* Clock */}
      <span style={{
        marginLeft: 'auto',
        fontFamily: 'IBM Plex Mono, monospace',
        fontSize: '0.75rem',
        color: '#fff',
        letterSpacing: '0.02em',
      }}>
        {time.toISOString().replace('T', ' ').slice(0, 19)} UTC
      </span>

    </header>
  )
}
