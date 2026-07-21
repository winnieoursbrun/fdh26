import { act, renderHook } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { useReminders } from './useReminders'
import type { FestEvent } from '../types'

class MockNotification {
  static permission: NotificationPermission = 'default'
  static requestPermission = vi.fn()
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
  MockNotification.permission = 'default'
  MockNotification.requestPermission = vi.fn()
  MockNotification.instances = []
  vi.stubGlobal('Notification', MockNotification)
})

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('useReminders status', () => {
  it('démarre à "default" quand la permission n\'a jamais été demandée', () => {
    const { result } = renderHook(() => useReminders())
    expect(result.current.status).toBe('default')
  })

  it('passe à "enabled" quand enable() obtient la permission', async () => {
    MockNotification.requestPermission.mockResolvedValue('granted' as NotificationPermission)
    const { result } = renderHook(() => useReminders())

    await act(async () => {
      result.current.enable()
    })

    expect(result.current.status).toBe('enabled')
    expect(localStorage.getItem('fdh26-reminders-enabled')).toBe('true')
  })

  it('envoie une notification de confirmation quand enable() active les rappels', async () => {
    MockNotification.requestPermission.mockResolvedValue('granted' as NotificationPermission)
    const { result } = renderHook(() => useReminders())

    await act(async () => {
      result.current.enable()
    })

    expect(MockNotification.instances).toHaveLength(1)
    expect(MockNotification.instances[0].title).toBe('Rappels activés')
  })

  it('renvoie une notification de confirmation à chaque réactivation', () => {
    MockNotification.permission = 'granted'
    const { result } = renderHook(() => useReminders())

    act(() => {
      result.current.enable()
    })
    expect(MockNotification.instances).toHaveLength(1)

    act(() => {
      result.current.disable()
    })
    act(() => {
      result.current.enable()
    })

    expect(MockNotification.instances).toHaveLength(2)
    expect(MockNotification.instances[1].title).toBe('Rappels activés')
  })

  it('passe à "denied" quand le navigateur refuse la permission', async () => {
    MockNotification.requestPermission.mockResolvedValue('denied' as NotificationPermission)
    const { result } = renderHook(() => useReminders())

    await act(async () => {
      result.current.enable()
    })

    expect(result.current.status).toBe('denied')
  })

  it('ne redemande pas la permission si elle est déjà refusée', () => {
    MockNotification.permission = 'denied'
    const { result } = renderHook(() => useReminders())

    act(() => {
      result.current.enable()
    })

    expect(MockNotification.requestPermission).not.toHaveBeenCalled()
    expect(result.current.status).toBe('denied')
  })

  it('passe de "enabled" à "disabled" via disable()', () => {
    MockNotification.permission = 'granted'
    localStorage.setItem('fdh26-reminders-enabled', 'true')
    const { result } = renderHook(() => useReminders())
    expect(result.current.status).toBe('enabled')

    act(() => {
      result.current.disable()
    })

    expect(result.current.status).toBe('disabled')
    expect(localStorage.getItem('fdh26-reminders-enabled')).toBe('false')
  })

  it('vaut "unsupported" quand l\'API Notification est absente', () => {
    vi.unstubAllGlobals()
    const { result } = renderHook(() => useReminders([]))
    expect(result.current.status).toBe('unsupported')
  })
})

describe('useReminders scheduling', () => {
  function makeEvent(overrides: Partial<FestEvent> = {}): FestEvent {
    return {
      id: 'evt-1',
      title: 'Concert test',
      artist: null,
      day: 'sam',
      start: '21:00',
      end: '22:00',
      venue: 'Scène test',
      category: 'concert',
      subtype: null,
      description: null,
      ...overrides,
    }
  }

  beforeEach(() => {
    MockNotification.permission = 'granted'
    localStorage.setItem('fdh26-reminders-enabled', 'true')
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('déclenche une notification 15 minutes avant le début d\'un favori', () => {
    vi.setSystemTime(new Date(2026, 8, 12, 20, 44))
    renderHook(({ events }) => useReminders(events), {
      initialProps: { events: [makeEvent()] },
    })

    expect(MockNotification.instances).toHaveLength(0)
    act(() => {
      vi.advanceTimersByTime(60_000)
    })
    expect(MockNotification.instances).toHaveLength(1)
    expect(MockNotification.instances[0].title).toBe('Concert test')
  })

  it('rattrape immédiatement si la fenêtre de rappel est déjà entamée', () => {
    vi.setSystemTime(new Date(2026, 8, 12, 20, 50)) // 10 min avant, fenêtre déjà ouverte
    renderHook(({ events }) => useReminders(events), {
      initialProps: { events: [makeEvent()] },
    })

    expect(MockNotification.instances).toHaveLength(1)
  })

  it('ne déclenche rien si l\'événement a déjà commencé', () => {
    vi.setSystemTime(new Date(2026, 8, 12, 21, 30))
    renderHook(({ events }) => useReminders(events), {
      initialProps: { events: [makeEvent()] },
    })

    act(() => {
      vi.advanceTimersByTime(10 * 60_000)
    })
    expect(MockNotification.instances).toHaveLength(0)
  })

  it('ne redéclenche pas le même événement lors d\'un nouveau visibilitychange', () => {
    vi.setSystemTime(new Date(2026, 8, 12, 20, 50))
    renderHook(({ events }) => useReminders(events), {
      initialProps: { events: [makeEvent()] },
    })
    expect(MockNotification.instances).toHaveLength(1)

    act(() => {
      document.dispatchEvent(new Event('visibilitychange'))
    })
    expect(MockNotification.instances).toHaveLength(1)
  })

  it('annule le rappel en attente si le favori est retiré', () => {
    vi.setSystemTime(new Date(2026, 8, 12, 20, 44))
    const { rerender } = renderHook(({ events }) => useReminders(events), {
      initialProps: { events: [makeEvent()] },
    })

    rerender({ events: [] })
    act(() => {
      vi.advanceTimersByTime(60_000)
    })
    expect(MockNotification.instances).toHaveLength(0)
  })

  it('ne programme rien tant que le statut n\'est pas "enabled"', () => {
    MockNotification.permission = 'default'
    localStorage.removeItem('fdh26-reminders-enabled')
    vi.setSystemTime(new Date(2026, 8, 12, 20, 59))
    renderHook(({ events }) => useReminders(events), {
      initialProps: { events: [makeEvent()] },
    })

    act(() => {
      vi.advanceTimersByTime(5 * 60_000)
    })
    expect(MockNotification.instances).toHaveLength(0)
  })

  it('la transition de statut vers "enabled" via enable() déclenche la programmation', async () => {
    MockNotification.permission = 'default'
    localStorage.removeItem('fdh26-reminders-enabled')
    MockNotification.requestPermission.mockResolvedValue('granted' as NotificationPermission)
    vi.setSystemTime(new Date(2026, 8, 12, 20, 44))

    const { result } = renderHook(({ events }) => useReminders(events), {
      initialProps: { events: [makeEvent()] },
    })
    expect(result.current.status).toBe('default')

    await act(async () => {
      result.current.enable()
    })

    expect(result.current.status).toBe('enabled')
    expect(MockNotification.instances).toHaveLength(1)
    expect(MockNotification.instances[0].title).toBe('Rappels activés')

    act(() => {
      vi.advanceTimersByTime(60_000)
    })
    expect(MockNotification.instances).toHaveLength(2)
    expect(MockNotification.instances[1].title).toBe('Concert test')
  })

  it('annule le rappel en attente si disable() est appelé', () => {
    vi.setSystemTime(new Date(2026, 8, 12, 20, 44))
    const { result } = renderHook(({ events }) => useReminders(events), {
      initialProps: { events: [makeEvent()] },
    })
    expect(result.current.status).toBe('enabled')
    expect(MockNotification.instances).toHaveLength(0)

    act(() => {
      result.current.disable()
    })
    expect(result.current.status).toBe('disabled')

    act(() => {
      vi.advanceTimersByTime(5 * 60_000)
    })
    expect(MockNotification.instances).toHaveLength(0)
  })
})

describe('useReminders permission re-check', () => {
  function setVisibilityState(value: DocumentVisibilityState) {
    Object.defineProperty(document, 'visibilityState', {
      value,
      configurable: true,
    })
  }

  afterEach(() => {
    setVisibilityState('visible')
  })

  it('recalcule le statut quand l\'appli redevient visible après un changement externe de permission', () => {
    MockNotification.permission = 'default'
    const { result } = renderHook(() => useReminders())
    expect(result.current.status).toBe('default')

    // La permission est accordée en arrière-plan (ex. réglages du navigateur), hors de l'appli.
    MockNotification.permission = 'granted'

    setVisibilityState('visible')
    act(() => {
      document.dispatchEvent(new Event('visibilitychange'))
    })

    // Accordée mais pas explicitement activée via enable() => 'disabled' selon computeStatus().
    expect(result.current.status).toBe('disabled')
  })
})
