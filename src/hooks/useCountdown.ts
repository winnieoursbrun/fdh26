import { useEffect, useState } from 'react'

export interface CountdownParts {
  hasStarted: boolean
  days: number
  hours: number
  minutes: number
  seconds: number
}

function computeParts(target: Date, now: number): CountdownParts {
  const diff = target.getTime() - now
  if (diff <= 0) {
    return { hasStarted: true, days: 0, hours: 0, minutes: 0, seconds: 0 }
  }
  const totalSeconds = Math.floor(diff / 1000)
  return {
    hasStarted: false,
    days: Math.floor(totalSeconds / 86400),
    hours: Math.floor((totalSeconds % 86400) / 3600),
    minutes: Math.floor((totalSeconds % 3600) / 60),
    seconds: totalSeconds % 60,
  }
}

export function useCountdown(target: Date): CountdownParts {
  const [parts, setParts] = useState<CountdownParts>(() => computeParts(target, Date.now()))

  useEffect(() => {
    setParts(computeParts(target, Date.now()))
    const id = setInterval(() => {
      setParts(computeParts(target, Date.now()))
    }, 1000)
    return () => clearInterval(id)
  }, [target])

  return parts
}
