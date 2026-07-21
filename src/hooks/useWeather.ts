import { useEffect, useState } from 'react'
import * as Sentry from '@sentry/react'
import { fetchFestivalWeather, type DayWeather } from '../lib/weather'

const STORAGE_KEY = 'fdh26-weather'
const STALE_AFTER_MS = 3 * 60 * 60 * 1000

type WeatherState = {
  status: 'loading' | 'ok' | 'stale' | 'error'
  days: DayWeather[]
}

type CachedWeather = {
  days: DayWeather[]
  fetchedAt: number
}

function loadCache(): CachedWeather | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    return raw ? (JSON.parse(raw) as CachedWeather) : null
  } catch {
    return null
  }
}

function saveCache(days: DayWeather[]) {
  const cached: CachedWeather = { days, fetchedAt: Date.now() }
  localStorage.setItem(STORAGE_KEY, JSON.stringify(cached))
}

export function useWeather() {
  const [state, setState] = useState<WeatherState>(() => {
    const cached = loadCache()
    return cached ? { status: 'stale', days: cached.days } : { status: 'loading', days: [] }
  })

  useEffect(() => {
    const cached = loadCache()
    const isFresh = cached !== null && Date.now() - cached.fetchedAt < STALE_AFTER_MS
    if (isFresh) {
      setState({ status: 'ok', days: cached.days })
      return
    }
    if (!navigator.onLine) {
      Sentry.metrics.count('weather.fetch', 1, { attributes: { result: 'offline' } })
      return
    }

    let cancelled = false
    fetchFestivalWeather()
      .then((days) => {
        if (cancelled) {
          return
        }
        saveCache(days)
        setState({ status: 'ok', days })
        Sentry.metrics.count('weather.fetch', 1, { attributes: { result: 'ok' } })
      })
      .catch(() => {
        if (cancelled) {
          return
        }
        setState((prev) =>
          prev.days.length > 0 ? { status: 'stale', days: prev.days } : { status: 'error', days: [] },
        )
        Sentry.metrics.count('weather.fetch', 1, { attributes: { result: 'error' } })
      })

    return () => {
      cancelled = true
    }
  }, [])

  return state
}
