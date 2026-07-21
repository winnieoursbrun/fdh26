import type { ReminderStatus } from '../hooks/useReminders'

interface ReminderToggleProps {
  status: ReminderStatus
  enable: () => void
  disable: () => void
}

export function ReminderToggle({ status, enable, disable }: ReminderToggleProps) {
  if (status === 'unsupported') {
    return (
      <p className="toggle-note">
        Les rappels ne sont pas disponibles sur ce navigateur. Sur iPhone, installe d'abord
        l'appli sur l'écran d'accueil.
      </p>
    )
  }

  const checked = status === 'enabled'

  return (
    <div className="toggle-row">
      <span>Rappel 15 min avant chaque événement de ma timeline</span>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        aria-label="Activer les rappels de notification"
        className={`toggle-switch${checked ? ' is-on' : ''}`}
        disabled={status === 'denied'}
        onClick={() => (checked ? disable() : enable())}
      >
        <span className="toggle-switch-knob" />
      </button>
      {status === 'denied' && (
        <p className="toggle-note">
          Les notifications sont bloquées pour ce site. Réautorise-les depuis les réglages de
          ton navigateur ou de ton téléphone.
        </p>
      )}
      {status !== 'denied' && (
        <p className="toggle-note">
          Les rappels ne fonctionnent que si l'appli reste ouverte ou a été mise en arrière-plan
          récemment, pas après une fermeture complète prolongée.
        </p>
      )}
    </div>
  )
}
