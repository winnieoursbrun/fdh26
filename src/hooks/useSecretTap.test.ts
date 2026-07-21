import { renderHook } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { useSecretTap } from './useSecretTap'

beforeEach(() => {
  vi.useFakeTimers()
  vi.setSystemTime(new Date(2026, 6, 1, 12, 0))
})

afterEach(() => {
  vi.useRealTimers()
})

describe('useSecretTap', () => {
  it('déclenche onUnlock au 5e tap rapproché', () => {
    const onUnlock = vi.fn()
    const { result } = renderHook(() => useSecretTap(onUnlock))

    for (let i = 0; i < 4; i++) {
      result.current()
    }
    expect(onUnlock).not.toHaveBeenCalled()

    result.current()
    expect(onUnlock).toHaveBeenCalledTimes(1)
  })

  it('ne déclenche rien avec moins de taps que requis', () => {
    const onUnlock = vi.fn()
    const { result } = renderHook(() => useSecretTap(onUnlock))

    result.current()
    result.current()
    expect(onUnlock).not.toHaveBeenCalled()
  })

  it('réinitialise le compteur si les taps sont trop espacés', () => {
    const onUnlock = vi.fn()
    const { result } = renderHook(() => useSecretTap(onUnlock))

    result.current()
    result.current()
    vi.advanceTimersByTime(3000)
    result.current()
    result.current()
    result.current()
    expect(onUnlock).not.toHaveBeenCalled()
  })

  it('se réinitialise après déclenchement', () => {
    const onUnlock = vi.fn()
    const { result } = renderHook(() => useSecretTap(onUnlock))

    for (let i = 0; i < 5; i++) {
      result.current()
    }
    expect(onUnlock).toHaveBeenCalledTimes(1)

    result.current()
    result.current()
    expect(onUnlock).toHaveBeenCalledTimes(1)
  })

  it('respecte un nombre de taps requis personnalisé', () => {
    const onUnlock = vi.fn()
    const { result } = renderHook(() => useSecretTap(onUnlock, 3))

    result.current()
    result.current()
    expect(onUnlock).not.toHaveBeenCalled()
    result.current()
    expect(onUnlock).toHaveBeenCalledTimes(1)
  })
})
