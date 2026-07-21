import * as Sentry from '@sentry/react'

const DEVICE_ID_KEY = 'pdj26-device-id'

// Identifiant anonyme stable par appareil (UUID aléatoire, aucune donnée
// personnelle) : attaché via Sentry.setUser, il permet de compter les
// utilisateurs uniques de l'app dans Sentry.
export function getDeviceId(): string {
  try {
    const stored = localStorage.getItem(DEVICE_ID_KEY)
    if (stored) {
      return stored
    }
    const id =
      typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
        ? crypto.randomUUID()
        : `${Math.random().toString(36).slice(2)}-${Date.now().toString(36)}`
    localStorage.setItem(DEVICE_ID_KEY, id)
    return id
  } catch {
    // localStorage indisponible (navigation privée stricte…) : l'appareil
    // sera compté comme anonyme plutôt que de faire planter l'init.
    return 'unknown'
  }
}

export function getDisplayMode(): 'standalone' | 'browser' {
  try {
    const iosStandalone = (navigator as { standalone?: boolean }).standalone === true
    return window.matchMedia('(display-mode: standalone)').matches || iosStandalone
      ? 'standalone'
      : 'browser'
  } catch {
    return 'browser'
  }
}

export function initSentry() {
  Sentry.init({
    dsn: 'https://912feabd33e9998de0fe13ad1c380af3@o4510976802357248.ingest.de.sentry.io/4511730062327888',
    integrations: [
      Sentry.browserTracingIntegration(),
      Sentry.replayIntegration(),
      Sentry.consoleLoggingIntegration({ levels: ['warn', 'error'] }),
    ],
    // Tracing
    tracesSampleRate: 1.0,
    // Session Replay
    replaysSessionSampleRate: 0.1,
    replaysOnErrorSampleRate: 1.0,
    // Logs
    enableLogs: true,
  })

  Sentry.setUser({ id: getDeviceId() })
  Sentry.metrics.count('app.open', 1, {
    attributes: { display_mode: getDisplayMode() },
  })
}
