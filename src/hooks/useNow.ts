import { useEffect, useState } from 'react'

/**
 * Horloge qui se rafraîchit à intervalle régulier : sert à savoir quels
 * événements sont « en cours » sans re-render à chaque seconde.
 */
export function useNow(intervalMs = 60_000): number {
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), intervalMs)
    return () => {
      clearInterval(timer)
    }
  }, [intervalMs])
  return now
}
