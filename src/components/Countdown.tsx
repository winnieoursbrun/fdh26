import { useCountdown } from '../hooks/useCountdown'

interface CountdownProps {
  target: Date
}

const UNITS: { key: 'days' | 'hours' | 'minutes' | 'seconds'; label: string }[] = [
  { key: 'days', label: 'jours' },
  { key: 'hours', label: 'heures' },
  { key: 'minutes', label: 'min' },
  { key: 'seconds', label: 'sec' },
]

export function Countdown({ target }: CountdownProps) {
  const parts = useCountdown(target)

  if (parts.hasStarted) {
    return (
      <div className="countdown-card">
        <p className="countdown-started">🎉 Le festival a commencé, profite bien !</p>
      </div>
    )
  }

  return (
    <div className="countdown-card">
      <p className="countdown-label">Avant l'ouverture du festival</p>
      <div className="countdown-grid">
        {UNITS.map((u) => (
          <div key={u.key} className="countdown-unit">
            <span className="countdown-value">{String(parts[u.key]).padStart(2, '0')}</span>
            <span className="countdown-unit-label">{u.label}</span>
          </div>
        ))}
      </div>
    </div>
  )
}
