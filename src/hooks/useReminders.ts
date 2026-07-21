import { useCallback, useEffect, useState } from 'react'
import * as Sentry from '@sentry/react'
import { eventStartDate } from '../lib/schedule'
import type { FestEvent } from '../types'

export type ReminderStatus = 'unsupported' | 'default' | 'denied' | 'enabled' | 'disabled'

const ENABLED_KEY = 'fdh26-reminders-enabled'
const NOTIFIED_KEY = 'fdh26-reminders-notified'
const REMINDER_LEAD_MS = 15 * 60 * 1000

function isEnabledInStorage(): boolean {
  return localStorage.getItem(ENABLED_KEY) === 'true'
}

function setEnabledInStorage(value: boolean) {
  localStorage.setItem(ENABLED_KEY, value ? 'true' : 'false')
}

function getNotifiedIds(): Set<string> {
  try {
    return new Set(JSON.parse(localStorage.getItem(NOTIFIED_KEY) ?? '[]') as string[])
  } catch {
    return new Set()
  }
}

function markNotified(id: string) {
  const notified = getNotifiedIds()
  notified.add(id)
  localStorage.setItem(NOTIFIED_KEY, JSON.stringify([...notified]))
}

function fireReminder(event: FestEvent) {
  const body = event.end
    ? `${event.start} – ${event.end} · ${event.venue}`
    : `${event.start} · ${event.venue}`
  const notification = new Notification(event.title, { body })
  notification.onclick = () => window.focus()
}

function fireEnabledConfirmation() {
  const notification = new Notification('Rappels activés', {
    body: 'Tu seras prévenu·e 15 min avant chaque événement de ta timeline.',
  })
  notification.onclick = () => window.focus()
}

function computeStatus(): ReminderStatus {
  if (typeof Notification === 'undefined') {
    return 'unsupported'
  }
  if (Notification.permission === 'denied') {
    return 'denied'
  }
  if (Notification.permission === 'default') {
    return 'default'
  }
  return isEnabledInStorage() ? 'enabled' : 'disabled'
}

export function useReminders(favoriteEvents: FestEvent[] = []) {
  const [status, setStatus] = useState<ReminderStatus>(computeStatus)

  const enable = useCallback(() => {
    if (typeof Notification === 'undefined') {
      return
    }
    if (Notification.permission === 'granted') {
      setEnabledInStorage(true)
      setStatus('enabled')
      fireEnabledConfirmation()
      Sentry.metrics.count('reminders.enable', 1, { attributes: { result: 'granted' } })
      return
    }
    if (Notification.permission === 'denied') {
      setStatus('denied')
      Sentry.metrics.count('reminders.enable', 1, { attributes: { result: 'denied' } })
      return
    }
    void Notification.requestPermission().then((permission) => {
      if (permission === 'granted') {
        setEnabledInStorage(true)
        setStatus('enabled')
        fireEnabledConfirmation()
      } else {
        setStatus(permission === 'denied' ? 'denied' : 'default')
      }
      Sentry.metrics.count('reminders.enable', 1, { attributes: { result: permission } })
    })
  }, [])

  const disable = useCallback(() => {
    setEnabledInStorage(false)
    setStatus('disabled')
    Sentry.metrics.count('reminders.disable', 1)
  }, [])

  useEffect(() => {
    function recheckOnVisible() {
      if (document.visibilityState === 'visible') {
        setStatus(computeStatus())
      }
    }

    document.addEventListener('visibilitychange', recheckOnVisible)
    return () => {
      document.removeEventListener('visibilitychange', recheckOnVisible)
    }
  }, [])

  useEffect(() => {
    if (status !== 'enabled') {
      return
    }

    let timers: ReturnType<typeof setTimeout>[] = []

    function schedule() {
      timers.forEach(clearTimeout)
      timers = []
      const notified = getNotifiedIds()
      const now = Date.now()

      for (const event of favoriteEvents) {
        if (notified.has(event.id)) {
          continue
        }
        const start = eventStartDate(event).getTime()
        if (now >= start) {
          continue
        }
        const delay = start - REMINDER_LEAD_MS - now

        if (delay <= 0) {
          fireReminder(event)
          markNotified(event.id)
          continue
        }

        timers.push(
          setTimeout(() => {
            fireReminder(event)
            markNotified(event.id)
          }, delay),
        )
      }
    }

    schedule()
    document.addEventListener('visibilitychange', schedule)

    return () => {
      timers.forEach(clearTimeout)
      document.removeEventListener('visibilitychange', schedule)
    }
  }, [status, favoriteEvents])

  return { status, enable, disable }
}
