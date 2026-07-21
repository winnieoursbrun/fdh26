import { useCallback, useState } from 'react'
import * as Sentry from '@sentry/react'
import eventsData from '../data/events.json'
import type { FestEvent } from '../types'

const STORAGE_KEY = 'fdh26-favorites'

const eventsById = new Map((eventsData as FestEvent[]).map((event) => [event.id, event]))

function load(): Set<string> {
  try {
    return new Set(JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '[]') as string[])
  } catch {
    return new Set()
  }
}

export function useFavorites() {
  const [favorites, setFavorites] = useState<Set<string>>(load)

  const toggle = useCallback((id: string) => {
    setFavorites((prev) => {
      const next = new Set(prev)
      const action = next.has(id) ? 'remove' : 'add'
      if (action === 'remove') {
        next.delete(id)
      } else {
        next.add(id)
      }
      localStorage.setItem(STORAGE_KEY, JSON.stringify([...next]))
      const event = eventsById.get(id)
      Sentry.metrics.count('favorite.toggle', 1, {
        attributes: {
          action,
          eventId: id,
          eventTitle: event?.title ?? id,
          category: event?.category ?? 'unknown',
        },
      })
      return next
    })
  }, [])

  return { favorites, toggle }
}
