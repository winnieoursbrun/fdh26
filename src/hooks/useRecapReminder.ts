import { useEffect } from 'react'
import * as Sentry from '@sentry/react'
import { RECAP_READY_AT } from '../lib/recap'
import type { ReminderStatus } from './useReminders'

const NOTIFIED_KEY = 'fdh26-recap-notified'

function fireRecapReady() {
  const notification = new Notification('Ton récap du festival est prêt !', {
    body: 'Redécouvre les moments forts de ton festival dans l\'appli.',
  })
  notification.onclick = () => window.focus()
}

export function useRecapReminder(status: ReminderStatus) {
  useEffect(() => {
    if (status !== 'enabled') {
      return
    }
    if (localStorage.getItem(NOTIFIED_KEY) === 'true') {
      return
    }

    const delay = RECAP_READY_AT.getTime() - Date.now()

    function notify() {
      fireRecapReady()
      localStorage.setItem(NOTIFIED_KEY, 'true')
      Sentry.metrics.count('recap.notify', 1)
    }

    if (delay <= 0) {
      notify()
      return
    }

    const timer = setTimeout(notify, delay)
    return () => clearTimeout(timer)
  }, [status])
}
