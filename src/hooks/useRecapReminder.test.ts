import { act, renderHook } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { useRecapReminder } from './useRecapReminder'

class MockNotification {
  static permission: NotificationPermission = 'default'
  static instances: MockNotification[] = []
  onclick: (() => void) | null = null
  title: string
  options?: NotificationOptions

  constructor(title: string, options?: NotificationOptions) {
    this.title = title
    this.options = options
    MockNotification.instances.push(this)
  }
}

beforeEach(() => {
  localStorage.clear()
  MockNotification.instances = []
  vi.stubGlobal('Notification', MockNotification)
  vi.useFakeTimers()
})

afterEach(() => {
  vi.unstubAllGlobals()
  vi.useRealTimers()
})

describe('useRecapReminder', () => {
  it('ne programme rien tant que le statut n\'est pas "enabled"', () => {
    vi.setSystemTime(new Date(2026, 6, 20, 8, 0))
    renderHook(() => useRecapReminder('disabled'))

    act(() => {
      vi.advanceTimersByTime(2 * 60 * 60 * 1000)
    })
    expect(MockNotification.instances).toHaveLength(0)
  })

  it('déclenche la notification à l\'heure prévue quand le statut est "enabled"', () => {
    vi.setSystemTime(new Date(2026, 6, 20, 8, 59))
    renderHook(() => useRecapReminder('enabled'))

    expect(MockNotification.instances).toHaveLength(0)
    act(() => {
      vi.advanceTimersByTime(60_000)
    })
    expect(MockNotification.instances).toHaveLength(1)
    expect(MockNotification.instances[0].title).toBe('Ton récap du festival est prêt !')
    expect(localStorage.getItem('pdj26-recap-notified')).toBe('true')
  })

  it('rattrape immédiatement si l\'heure prévue est déjà passée', () => {
    vi.setSystemTime(new Date(2026, 6, 21, 10, 0))
    renderHook(() => useRecapReminder('enabled'))

    expect(MockNotification.instances).toHaveLength(1)
  })

  it('ne redéclenche pas si déjà notifié', () => {
    localStorage.setItem('pdj26-recap-notified', 'true')
    vi.setSystemTime(new Date(2026, 6, 21, 10, 0))
    renderHook(() => useRecapReminder('enabled'))

    expect(MockNotification.instances).toHaveLength(0)
  })
})
