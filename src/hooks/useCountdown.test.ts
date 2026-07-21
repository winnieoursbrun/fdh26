import { act, renderHook } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { useCountdown } from './useCountdown'

describe('useCountdown', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('calcule les jours/heures/minutes/secondes restantes avant la cible', () => {
    vi.setSystemTime(new Date(2026, 6, 16, 16, 30, 0))
    const target = new Date(2026, 6, 17, 16, 30, 0)

    const { result } = renderHook(() => useCountdown(target))

    expect(result.current).toEqual({
      hasStarted: false,
      days: 1,
      hours: 0,
      minutes: 0,
      seconds: 0,
    })
  })

  it('décompte les secondes au fil du temps', () => {
    vi.setSystemTime(new Date(2026, 6, 17, 16, 29, 50))
    const target = new Date(2026, 6, 17, 16, 30, 0)

    const { result } = renderHook(() => useCountdown(target))
    expect(result.current.seconds).toBe(10)

    act(() => {
      vi.advanceTimersByTime(3000)
    })
    expect(result.current.seconds).toBe(7)
  })

  it('indique hasStarted une fois la cible atteinte', () => {
    vi.setSystemTime(new Date(2026, 6, 17, 16, 29, 59))
    const target = new Date(2026, 6, 17, 16, 30, 0)

    const { result } = renderHook(() => useCountdown(target))
    expect(result.current.hasStarted).toBe(false)

    act(() => {
      vi.advanceTimersByTime(1000)
    })
    expect(result.current.hasStarted).toBe(true)
    expect(result.current.days).toBe(0)
  })

  it('reste à hasStarted quand la cible est déjà passée', () => {
    vi.setSystemTime(new Date(2026, 6, 18, 10, 0, 0))
    const target = new Date(2026, 6, 17, 16, 30, 0)

    const { result } = renderHook(() => useCountdown(target))
    expect(result.current.hasStarted).toBe(true)
  })
})
