import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { renderHook, waitFor } from '@testing-library/react'
import { fetchFestivalWeather, type DayWeather } from '../lib/weather'
import { useWeather } from './useWeather'

vi.mock('@sentry/react', () => ({
  metrics: { count: vi.fn() },
}))

vi.mock('../lib/weather', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../lib/weather')>()),
  fetchFestivalWeather: vi.fn(),
}))

const fetchMock = vi.mocked(fetchFestivalWeather)

function makeDay(overrides: Partial<DayWeather> = {}): DayWeather {
  return {
    date: '2026-07-17',
    weatherCode: 0,
    tempMax: 25,
    tempMin: 14,
    precipitationProbability: 10,
    ...overrides,
  }
}

function seedCache(days: DayWeather[], fetchedAt: number) {
  localStorage.setItem('pdj26-weather', JSON.stringify({ days, fetchedAt }))
}

describe('useWeather', () => {
  beforeEach(() => {
    localStorage.clear()
    fetchMock.mockReset()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('sert le cache frais sans appel réseau', () => {
    const days = [makeDay()]
    seedCache(days, Date.now() - 60_000)
    const { result } = renderHook(() => useWeather())

    expect(result.current).toEqual({ status: 'ok', days })
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('sert le cache périmé en « stale » puis rafraîchit', async () => {
    const cached = [makeDay({ tempMax: 20 })]
    const fresh = [makeDay({ tempMax: 28 })]
    seedCache(cached, Date.now() - 4 * 60 * 60 * 1000)
    fetchMock.mockResolvedValue(fresh)

    const { result } = renderHook(() => useWeather())
    expect(result.current).toEqual({ status: 'stale', days: cached })

    await waitFor(() => expect(result.current).toEqual({ status: 'ok', days: fresh }))
    expect(JSON.parse(localStorage.getItem('pdj26-weather')!).days).toEqual(fresh)
  })

  it('ne tente pas de fetch hors ligne', () => {
    seedCache([makeDay()], Date.now() - 4 * 60 * 60 * 1000)
    Object.defineProperty(navigator, 'onLine', { value: false, configurable: true })

    const { result } = renderHook(() => useWeather())
    expect(result.current.status).toBe('stale')
    expect(fetchMock).not.toHaveBeenCalled()

    Reflect.deleteProperty(navigator, 'onLine')
  })

  it('passe en erreur quand le fetch échoue sans cache', async () => {
    fetchMock.mockRejectedValue(new Error('boom'))
    const { result } = renderHook(() => useWeather())

    await waitFor(() => expect(result.current.status).toBe('error'))
    expect(result.current.days).toEqual([])
  })

  it('conserve le cache en « stale » quand le fetch échoue', async () => {
    const cached = [makeDay()]
    seedCache(cached, Date.now() - 4 * 60 * 60 * 1000)
    fetchMock.mockRejectedValue(new Error('boom'))

    const { result } = renderHook(() => useWeather())
    await waitFor(() => expect(fetchMock).toHaveBeenCalled())
    expect(result.current).toEqual({ status: 'stale', days: cached })
  })
})
