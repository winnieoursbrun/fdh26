import { useCallback, useEffect, useRef, useState } from 'react'
import * as Sentry from '@sentry/react'
import type { Point } from '../lib/geo'

export type GeoStatus =
  /** Ni `navigator.geolocation` ni contexte sécurisé : rien à proposer. */
  | 'unsupported'
  /** En veille : on n'a rien demandé, donc aucune invite système n'a été montrée. */
  | 'idle'
  /** Demande en cours, ou première position pas encore acquise. */
  | 'locating'
  /** Refus explicite : inutile de réessayer, il faut passer par les réglages. */
  | 'denied'
  /** Le téléphone n'arrive pas à se situer (intérieur, GPS coupé, délai dépassé). */
  | 'unavailable'
  | 'ok'

export interface GeoPosition extends Point {
  /** Rayon de confiance en mètres, tel que rendu par l'appareil. */
  accuracy: number
  at: number
}

const WATCH_OPTIONS: PositionOptions = {
  enableHighAccuracy: true,
  // Sur un site d'un kilomètre, une position d'une minute reste utile, et ça
  // évite de rallumer le GPS en permanence.
  maximumAge: 60_000,
  timeout: 20_000,
}

function isSupported(): boolean {
  return typeof navigator !== 'undefined' && 'geolocation' in navigator
}

/**
 * Suit la position de l'appareil, à la demande seulement : rien ne démarre tant
 * que `start()` n'a pas été appelé, donc l'invite système n'apparaît jamais à
 * l'ouverture de l'app. La position ne quitte pas l'appareil.
 */
export function useGeolocation() {
  const [status, setStatus] = useState<GeoStatus>(() =>
    isSupported() ? 'idle' : 'unsupported',
  )
  const [position, setPosition] = useState<GeoPosition | null>(null)
  const watchId = useRef<number | null>(null)

  const stop = useCallback(() => {
    if (watchId.current !== null) {
      // `isSupported()` a été vrai au démarrage, mais le démontage peut survenir
      // après la disparition de l'API (navigation, teardown) : on ne parie pas dessus.
      if (isSupported()) {
        navigator.geolocation.clearWatch(watchId.current)
      }
      watchId.current = null
    }
    setStatus((prev) => (prev === 'unsupported' ? prev : 'idle'))
  }, [])

  const start = useCallback(() => {
    if (!isSupported()) {
      setStatus('unsupported')
      return
    }
    if (watchId.current !== null) {
      return
    }
    setStatus('locating')
    watchId.current = navigator.geolocation.watchPosition(
      (p) => {
        setPosition({
          lat: p.coords.latitude,
          lng: p.coords.longitude,
          accuracy: p.coords.accuracy,
          at: p.timestamp,
        })
        setStatus('ok')
      },
      (error) => {
        const denied = error.code === error.PERMISSION_DENIED
        setStatus(denied ? 'denied' : 'unavailable')
        Sentry.metrics.count('geolocation.error', 1, {
          attributes: { code: denied ? 'denied' : 'unavailable' },
        })
        // Un refus est définitif pour la session : on relâche la montre.
        if (denied) {
          stop()
          setStatus('denied')
        }
      },
      WATCH_OPTIONS,
    )
  }, [stop])

  // Le suivi ne survit pas au démontage : pas de GPS qui tourne en arrière-plan.
  useEffect(() => stop, [stop])

  return { status, position, start, stop }
}
