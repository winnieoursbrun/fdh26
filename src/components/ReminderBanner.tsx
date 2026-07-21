import { useState } from 'react'
import type { ReminderStatus } from '../hooks/useReminders'

const PROMPTED_KEY = 'pdj26-reminders-prompted'

interface ReminderBannerProps {
  status: ReminderStatus
  enable: () => void
  favoritesCount: number
}

export function ReminderBanner({ status, enable, favoritesCount }: ReminderBannerProps) {
  const [prompted, setPrompted] = useState(() => localStorage.getItem(PROMPTED_KEY) === 'true')

  if (prompted || favoritesCount < 1 || status !== 'default') {
    return null
  }

  const dismiss = () => {
    localStorage.setItem(PROMPTED_KEY, 'true')
    setPrompted(true)
  }

  return (
    <div className="reminder-banner" role="status">
      <p>Envie d'un rappel 15 min avant chaque événement de ta timeline ?</p>
      <div className="reminder-banner-actions">
        <button
          type="button"
          className="reminder-banner-enable"
          onClick={() => {
            enable()
            dismiss()
          }}
        >
          Activer les rappels
        </button>
        <button
          type="button"
          className="reminder-banner-dismiss"
          aria-label="Fermer"
          onClick={dismiss}
        >
          ✕
        </button>
      </div>
    </div>
  )
}
